import { EventEmitter } from 'events';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import { Core, UA as UABase, Web } from 'sip.js';

import { ClientStatus, ReconnectionMode } from './enums';
import * as Features from './features';
import { log } from './logger';
import { sessionDescriptionHandlerFactory } from './session-description-handler';
import { hour } from './time';
import { IClientOptions, IRetry } from './types';
import { UA, WrappedTransport } from './ua';
import { increaseTimeout, jitter } from './utils';

// TODO: Implement rest of the types
interface IReconnectableTransport {
  configure(options: IClientOptions): void;
  connect(): void;
  disconnect(options: { hasSocket: boolean; hasRegistered: boolean }): Promise<void>;
  // invite(phoneNumber: string): Promise<WrappedInviteClientContext | WrappedInviteServerContext>;
}

const SIP_PRESENCE_EXPIRE = hour;

const logLevelConversion = {
  [Core.Levels.debug]: 'debug',
  [Core.Levels.log]: 'info',
  [Core.Levels.warn]: 'warn',
  [Core.Levels.error]: 'error'
};

const connector = (level, category, label, content) => {
  const convertedLevel = logLevelConversion[level] || 'debug';
  log.log(convertedLevel, content, category);
};

export class ReconnectableTransport extends EventEmitter implements IReconnectableTransport {
  private get defaultOptions() {
    return {
      autostart: false,
      autostop: false,
      log: {
        builtinEnabled: true,
        connector: undefined,
        level: 'warn'
      },
      noAnswerTimeout: 60,
      register: false,
      registerOptions: {
        expires: 3600
      }
    };
  }

  public transportConnectedPromise?: Promise<any>;
  public registeredPromise?: Promise<any>;
  public registered: boolean = false;
  public status: ClientStatus = ClientStatus.DISCONNECTED;
  private priority: boolean = false;
  private unregisteredPromise?: Promise<any>;
  private ua: UA;
  private uaOptions: UABase.Options;
  private dyingCounter: number = 60000;
  private dyingIntervalID: number;
  private retry: IRetry = { interval: 2000, limit: 30000, timeout: 250 };
  private boundOnWindowOffline: EventListenerOrEventListenerObject;
  private boundOnWindowOnline: EventListenerOrEventListenerObject;
  private wasWindowOffline: boolean = false;

  constructor(options: IClientOptions) {
    super();

    this.configure(options);

    this.boundOnWindowOffline = this.onWindowOffline.bind(this);
    this.boundOnWindowOnline = this.tryUntilConnected.bind(this);

    window.addEventListener('offline', this.boundOnWindowOffline);
    window.addEventListener('online', this.boundOnWindowOnline);
  }

  public configure(options: IClientOptions) {
    const { account, transport, userAgent } = options;

    const modifiers = [Web.Modifiers.stripVideo];
    if (Features.isSafari) {
      modifiers.push(Web.Modifiers.stripG722);
    }

    this.uaOptions = {
      ...this.defaultOptions,
      authorizationUser: account.user,
      log: {
        builtinEnabled: false,
        connector,
        level: 'debug'
      },
      password: account.password,
      sessionDescriptionHandlerFactory,
      sessionDescriptionHandlerFactoryOptions: {
        alwaysAcquireMediaFirst: Features.isFirefox,
        constraints: { audio: true, video: false },
        modifiers,
        peerConnectionOptions: {
          rtcConfiguration: {
            iceServers: transport.iceServers.map((s: string) => ({ urls: s }))
          }
        }
      },
      transportConstructor: WrappedTransport,
      transportOptions: {
        maxReconnectionAttempts: 0,
        traceSip: true,
        wsServers: transport.wsServers
      },
      uri: account.uri,
      userAgentString: userAgent || 'vialer-calling-lib'
    };
  }

  // Connect (and subsequently register) to server
  public async connect() {
    if (this.status === ClientStatus.RECOVERING) {
      return Promise.reject(
        new Error(
          'Can not connect while trying to recover. (this is to avoid spamming the sip server)'
        )
      );
    }

    if (this.status === ClientStatus.CONNECTED) {
      log.info('Already registered.', this.constructor.name);
      return this.registeredPromise;
    }

    this.updateStatus(ClientStatus.CONNECTING);

    if (!this.ua) {
      log.debug('Configuring UA.', this.constructor.name);
      this.configureUA();
    }

    if (this.unregisteredPromise) {
      log.info(
        'Cannot connect while unregistering takes place. Waiting until unregistering is resolved.',
        this.constructor.name
      );

      await this.unregisteredPromise;
    }

    if (this.registeredPromise) {
      return this.registeredPromise;
    }

    this.registeredPromise = this.createRegisteredPromise();

    this.ua.start();

    await pTimeout(this.transportConnectedPromise, 10000, () =>
      Promise.reject(new Error('Could not connect the websocket in time.'))
    );

    this.ua.register();

    return this.registeredPromise;
  }

  // Unregister (and subsequently disconnect) to server. When hasSocket is
  // false, a call to this function is usually handled by getConnection,
  // which then also manages status updates.
  public async disconnect({ hasSocket = true, hasRegistered = true } = {}): Promise<void> {
    if (!this.ua) {
      log.info('Already disconnected.', this.constructor.name);
      return;
    }

    if (hasSocket) {
      this.updateStatus(ClientStatus.DISCONNECTING);
    }

    delete this.registeredPromise;

    // Unregistering is not possible when the socket connection is closed/interrupted
    // - by the server during a call
    // - by a network node during a call
    // - by the client during a call (browser accidentally killing ws)
    if (hasSocket && hasRegistered) {
      this.unregisteredPromise = new Promise(resolve =>
        this.ua.once('unregistered', () => {
          this.registered = false;
          resolve(true);
        })
      );

      log.debug('Trying to unregister.', this.constructor.name);
      this.ua.unregister();

      // Little protection to make sure our account is actually unregistered
      // and received an ACK before other functions are called
      // (i.e. ua.disconnect)
      await this.unregisteredPromise;

      log.debug('Unregistered.', this.constructor.name);
    }

    await this.ua.disconnect();

    if (hasSocket) {
      this.updateStatus(ClientStatus.DISCONNECTED);
    }

    log.debug('Disconnected.', this.constructor.name);

    this.ua.transport.removeAllListeners();
    this.ua.removeAllListeners();

    delete this.ua;
    delete this.unregisteredPromise;
  }

  public invite(phoneNumber: string) {
    if (this.status !== ClientStatus.CONNECTED) {
      log.info('Could not send an invite. Not connected.', this.constructor.name);
      throw new Error('Cannot send an invite. Not connected.');
    }

    return this.ua.invite(phoneNumber);
  }

  public subscribe(contact: string) {
    // Introducing a jitter here, to avoid thundering herds.
    return this.ua.subscribe(contact, 'dialog', {
      expires: SIP_PRESENCE_EXPIRE + jitter(SIP_PRESENCE_EXPIRE, 30)
    });
  }

  public isRegistered() {
    return this.registeredPromise;
  }

  public async getConnection(mode: ReconnectionMode = ReconnectionMode.ONCE) {
    if (!this.ua) {
      return false;
    }

    if (ClientStatus.DISCONNECTED === this.status) {
      return false;
    }

    const isOnline = await this.isOnline(mode);

    log.debug(`isOnline: ${isOnline}`, this.constructor.name);
    if (isOnline) {
      await this.ua.transport.disconnect();
      log.debug('Socket closed', this.constructor.name);

      await this.ua.transport.connect();
      log.debug('Socket opened', this.constructor.name);

      // Before the dyingCounter reached 0, there is a decent chance our
      // sessions are still alive and kicking. Let's try to revive them.
      if (this.dyingCounter !== 0) {
        this.emit('reviveSessions');
      }

      this.emit('reviveSubscriptions');

      this.registeredPromise = this.createRegisteredPromise();

      this.ua.register();

      await this.registeredPromise;
      log.debug('Reregistered!', this.constructor.name);

      this.updateStatus(ClientStatus.CONNECTED);
      this.retry.timeout = 250;
    }

    return isOnline;
  }

  public updatePriority(flag) {
    this.priority = flag;
    log.debug(`Priority is ${flag}`, this.constructor.name);
  }

  public close() {
    window.removeEventListener('online', this.boundOnWindowOnline);
    window.removeEventListener('offline', this.boundOnWindowOffline);
  }

  private updateStatus(status: ClientStatus) {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.emit('statusUpdate', status);
  }

  private isOnlinePromise(mode: ReconnectionMode) {
    return new Promise((resolve, reject) => {
      const checkSocket = new WebSocket(this.uaOptions.transportOptions.wsServers, 'sip');

      const handlers = {
        onError: e => {
          log.debug(e, this.constructor.name);
          checkSocket.removeEventListener('open', handlers.onOpen);
          // In the case that mode is BURST, throw an error which can be
          // catched by pRetry.
          if (mode === ReconnectionMode.BURST) {
            throw new Error('it broke woops');
            return;
          }

          resolve(false);
        },
        onOpen: () => {
          log.debug('Opening a socket to sip server worked.', this.constructor.name);
          checkSocket.close();
          checkSocket.removeEventListener('error', handlers.onError);
          resolve(true);
        }
      };

      checkSocket.addEventListener('open', handlers.onOpen);
      checkSocket.addEventListener('error', handlers.onError);
    });
  }

  private configureUA() {
    this.ua = new UA(this.uaOptions);
    this.ua.on('invite', uaSession => this.emit('invite', uaSession));

    this.transportConnectedPromise = new Promise(resolve => {
      this.ua.once('transportCreated', () => {
        log.debug('Transport created.', this.constructor.name);
        this.ua.transport.once('connected', () => {
          log.debug('Transport connected.', this.constructor.name);
          resolve();
        });

        this.ua.transport.on('disconnected', this.onTransportDisconnected.bind(this));
      });
    });
  }

  private isOnline(mode: ReconnectionMode): Promise<any> {
    const hasConfiguredWsServer =
      this.uaOptions &&
      this.uaOptions.transportOptions &&
      this.uaOptions.transportOptions.wsServers;

    if (!hasConfiguredWsServer) {
      return Promise.resolve(false);
    }

    const tryOpeningSocketWithTimeout = () =>
      pTimeout(this.isOnlinePromise(mode), 500, () => {
        // In the case that mode is BURST, throw an error which can be
        // catched by pRetry.
        if (mode === ReconnectionMode.BURST) {
          throw new Error('Cannot open socket. Probably DNS failure.');
          return;
        }

        return Promise.resolve(false);
      });

    // In the case that mode is ONCE, a new socket is created once, also with
    // a timeout of 500 ms.
    if (mode === ReconnectionMode.ONCE) {
      log.debug('Trying to reconnect once.', this.constructor.name);
      return tryOpeningSocketWithTimeout();
    }

    log.debug('Trying to reconnect asap.', this.constructor.name);
    // In the case that mode is BURST, a new socket is created roughly every
    // 500 ms to be able to quickly revive our connection once that succeeds.
    const retryOptions = {
      forever: true,
      maxTimeout: 100,
      minTimeout: 100,
      onFailedAttempt: error => {
        log.debug(
          `Connection attempt ${error.attemptNumber} failed. There are ${
            error.retriesLeft
          } retries left.`,
          this.constructor.name
        );
      }
    };

    const retryForever = pRetry(() => {
      // It could happen that this function timed out. Because this is a
      // async function we check the client status to stop this loop.
      if (this.status === ClientStatus.DISCONNECTED) {
        throw new pRetry.AbortError("It's no use. Stop trying to recover");
      }

      return tryOpeningSocketWithTimeout();
    }, retryOptions);

    return pTimeout(retryForever, this.dyingCounter, () => {
      log.info(
        'We could not recover the session(s) within 1 minute. ' +
          'After this time the SIP server has terminated the session(s).',
        this.constructor.name
      );
      return Promise.resolve(false);
    });
  }

  /**
   * This function is generally called after a window 'online' event or
   * after an ua.transport 'disconnected' event.
   *
   * In the scenario where the SIP server goes offline, or a socket stops
   * working, ua.transport emits a 'disconnected' event. When this happens
   * for a multitude of clients, all of those clients would be
   * reconnecting at the same time.
   *
   * To avoid this, we divide those clients in two groups:
   *  - Clients that are in a call (priority === true)
   *  - Clients that are not in a call (priority === false)
   *
   *  Clients that are in a call can recover as soon as possible, where
   *  clients that are not in a call have to wait between 1~3 minutes
   *  before reconnecting to the server.
   */
  private async tryUntilConnected({ skipCheck }: { skipCheck: boolean } = { skipCheck: false }) {
    // To avoid triggering multiple times, return if status is recovering.
    if (ClientStatus.RECOVERING === this.status && !skipCheck) {
      return;
    }

    this.updateStatus(ClientStatus.RECOVERING);

    if (this.priority) {
      const connected = await this.getConnection(ReconnectionMode.BURST);

      this.onAfterGetConnection(connected);
      return;
    }

    setTimeout(async () => {
      // Only trigger this function if we haven't reconnected in the same time.
      if (this.status !== ClientStatus.CONNECTED) {
        const connected = await this.getConnection(ReconnectionMode.ONCE);

        this.onAfterGetConnection(connected);
      }
    }, this.retry.timeout);

    this.retry = increaseTimeout(this.retry);
    log.debug('Delaying reconnecting to avoid thundering herd.', this.constructor.name);
  }

  private createRegisteredPromise() {
    return new Promise((resolve, reject) => {
      const handlers = {
        onRegistered: () => {
          this.ua.removeListener('registrationFailed', handlers.onRegistrationFailed);
          this.updateStatus(ClientStatus.CONNECTED);
          resolve(true);
        },
        onRegistrationFailed: async e => {
          this.ua.removeListener('registered', handlers.onRegistered);

          await this.disconnect({ hasRegistered: false });

          this.updateStatus(ClientStatus.DISCONNECTED);
          reject(e);
        }
      };

      this.ua.once('registered', handlers.onRegistered);
      // TODO: find a way to simulate this
      this.ua.once('registrationFailed', handlers.onRegistrationFailed);
    });
  }

  private onWindowOffline() {
    log.info('We appear to be offline.', this.constructor.name);

    this.wasWindowOffline = true;
    this.updateStatus(ClientStatus.DYING);
    this.registeredPromise = undefined;

    if (this.dyingIntervalID) {
      return;
    }

    const subtractValue = 500;
    const subtractTillDead = () => {
      this.dyingCounter -= subtractValue;

      if (this.dyingCounter === 0) {
        clearInterval(this.dyingIntervalID);
        this.dyingIntervalID = undefined;
        // As the counter reached 0, there are no calls left over. Thus the
        // reconnection strategy does not have to prioritize this client
        // anymore.
        log.debug(
          'Priority set to false. Our call was probably terminated by the SIP server.',
          this.constructor.name
        );
        this.priority = false;
      }
    };

    this.dyingIntervalID = window.setInterval(subtractTillDead, subtractValue);
  }

  private onTransportDisconnected() {
    // There are different scenarios in place for when the transport might
    // have disconnected. One is loss of internet, this is detected by the
    // offline listener on window. Whenever this happens, it is inevitable that
    // the transport disconnected event will trigger. In that case we do not
    // want to try to reconnect, because there is no internet so it will be
    // futile. In this scenario, when internet comes back, tryUntilConnected
    // will be triggered by the window online event. The
    // 'wasWindowOffline' should account for these events. If internet
    // connectivity is lost and the transport disconnected event triggers,
    // we make sure to avoid triggering this function 2 times.
    //
    // Then there is another scenario that we have to account for, namely the
    // scenario where the transport is disconnected because the socket
    // connection to the sip server is lost somehow, while there still was
    // internet. In that case, the 'window' events won't help us. That is why
    // we can call tryUntilConnected in that case, because the
    // 'wasWindowOffline' will be false.
    log.debug('Transport disconnected..', this.constructor.name);

    if (!this.wasWindowOffline) {
      log.debug(
        'Transport disconnected while there is internet, trying to reconnect',
        this.constructor.name
      );
      this.tryUntilConnected();
    }

    this.wasWindowOffline = false;
  }

  private async onAfterGetConnection(connected: boolean) {
    if (connected) {
      // To make sure that the dying counter can be used again.
      clearInterval(this.dyingIntervalID);
      this.dyingIntervalID = undefined;

      this.dyingCounter = 60000;

      log.info('We appear to be connected.', this.constructor.name);
      return;
    }

    this.tryUntilConnected({ skipCheck: true });
  }
}
