import { EventEmitter } from 'events';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import { UA as UABase, Web } from 'sip.js';

import { ClientStatus } from './enums';
import { sessionDescriptionHandlerFactory } from './session-description-handler';
import { IClientOptions } from './types';
import { UA, WrappedInviteClientContext, WrappedInviteServerContext, WrappedTransport } from './ua';
import { jitter } from './utils';

// TODO: Implement rest of the types
interface IReconnectableTransport {
  configure(options: IClientOptions): void;
  connect(): void;
  disconnect(options: { hasSocket: boolean; hasRegistered: boolean }): Promise<void>;
  // invite(phoneNumber: string): Promise<WrappedInviteClientContext | WrappedInviteServerContext>;
}

const SIP_PRESENCE_EXPIRE = 3600;

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
      },
      userAgentString: 'vialer-calling-lib'
    };
  }

  public transportConnectedPromise?: Promise<any>;
  public registeredPromise?: Promise<any>;
  public registered: boolean = false;
  public status: ClientStatus = ClientStatus.DISCONNECTED;
  private unregisteredPromise?: Promise<any>;
  private ua: UA;
  private isReconnecting: boolean = false;
  private isRecovering: boolean = false;
  private uaOptions: UABase.Options;
  private dyingCounter: number = 60000;
  private dyingIntervalID: number;

  constructor(options: IClientOptions) {
    super();

    this.configure(options);

    window.addEventListener('offline', this.onWindowOffline.bind(this));
    window.addEventListener('online', this.tryReconnecting.bind(this));
  }

  public configure(options: IClientOptions) {
    const { account, transport } = options;

    this.uaOptions = {
      ...this.defaultOptions,
      authorizationUser: account.user,
      password: account.password,
      sessionDescriptionHandlerFactory,
      sessionDescriptionHandlerFactoryOptions: {
        constraints: { audio: true, video: false },
        modifiers: [Web.Modifiers.stripVideo],
        peerConnectionOptions: {
          rtcConfiguration: {
            iceServers: transport.iceServers.map((s: string) => ({ urls: s }))
          }
        }
      },
      transportConstructor: WrappedTransport,
      transportOptions: {
        maxReconnectionAttempts: 0,
        traceSip: false,
        wsServers: transport.wsServers
      },
      uri: account.uri
    };
  }

  // Connect (and subsequently register) to server
  public async connect() {
    if (this.status === ClientStatus.CONNECTED) {
      console.log('pssh. already registered.');
      return this.registeredPromise;
    }

    this.updateStatus(ClientStatus.CONNECTING);

    if (!this.ua) {
      console.log('configuring ua');
      this.configureUA();
    }

    if (this.unregisteredPromise) {
      console.error(
        'Cannot connect while unregistering takes place. Waiting until unregistering is resolved.'
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
  // false, a call to this function is usually handled by onDisconnected,
  // which then also manages status updates.
  public async disconnect({ hasSocket = true, hasRegistered = true } = {}): Promise<void> {
    if (!this.ua) {
      console.log('pssh. already disconnected.');
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

      console.log('trying to unregister..');
      this.ua.unregister();

      // Little protection to make sure our account is actually unregistered
      // and received an ACK before other functions are called
      // (i.e. ua.disconnect)
      await this.unregisteredPromise;

      console.log('unregistered!');
    }

    await this.ua.disconnect();

    if (hasSocket) {
      this.updateStatus(ClientStatus.DISCONNECTED);
    }

    console.log('disconnected!');

    this.ua.transport.removeAllListeners();
    this.ua.removeAllListeners();

    delete this.ua;
    delete this.unregisteredPromise;
  }

  public invite(phoneNumber: string) {
    if (this.status !== ClientStatus.CONNECTED) {
      throw new Error('Cannot send an invite. Not connected.');
    }

    return this.ua.invite(phoneNumber);
  }

  public subscribe(contact: string) {
    // Introducing a jitter here, to avoid mass-re-subscriptions which spam
    // the server.
    return this.ua.subscribe(contact, 'dialog', {
      expires: SIP_PRESENCE_EXPIRE + jitter(SIP_PRESENCE_EXPIRE, 30)
    });
  }

  public isRegistered() {
    return this.registeredPromise;
  }

  public isOnline({ timeLeft }): Promise<any> {
    const hasConfiguredWsServer =
      this.uaOptions &&
      this.uaOptions.transportOptions &&
      this.uaOptions.transportOptions.wsServers;

    if (!hasConfiguredWsServer || this.dyingCounter === 0) {
      return Promise.resolve(false);
    }

    const tryOpeningSocketWithTimeout = () => {
      // It could happen that this function timed out. Because this is a
      // async function that
      if (this.status === ClientStatus.DISCONNECTED) {
        throw new pRetry.AbortError("It's no use. Stop trying to recover");
      }

      return pTimeout(this.isOnlinePromise(), 500, () => {
        throw new Error('Cannot open socket. Probably DNS failure.');
      });
    };

    const retryOptions = {
      forever: true,
      maxTimeout: 100,
      minTimeout: 100,
      onFailedAttempt: error => {
        console.log(
          `Connection attempt ${error.attemptNumber} failed. There are ${
            error.retriesLeft
          } retries left.`
        );
      }
    };

    const retryForever = pRetry(tryOpeningSocketWithTimeout, retryOptions);

    return pTimeout(retryForever, timeLeft, () => {
      console.log(
        'We could not recover the session(s) within 1 minute. ' +
          'After this time the SIP server has killed the connections.'
      );
      return Promise.resolve(false);
    });
  }

  public async tryReconnecting({ timeLeft }) {
    if (!this.ua) {
      return;
    }

    if ([ClientStatus.RECOVERING, ClientStatus.DISCONNECTED].includes(this.status)) {
      return;
    }

    if (timeLeft) {
      this.dyingCounter = timeLeft;
    }

    this.updateStatus(ClientStatus.RECOVERING);

    clearInterval(this.dyingIntervalID);
    const isOnline = await this.isOnline({ timeLeft: this.dyingCounter });
    if (isOnline) {
      console.log('is really online!');

      await this.ua.transport.disconnect();
      console.log('socket closed');

      await this.ua.transport.connect();
      console.log('socket opened');

      this.updateStatus(ClientStatus.CONNECTED);
      this.emit('revive');

      this.registeredPromise = this.createRegisteredPromise();

      this.ua.register();

      await this.registeredPromise;
      console.log('reregistered!!');

      this.dyingCounter = 60000;
    } else {
      // There is no internet, so skipping unregistering, doesn't make sense
      // without a connection.
      await this.disconnect({ hasSocket: false });

      this.updateStatus(ClientStatus.DISCONNECTED);
    }
  }

  public close() {
    window.removeEventListener('online', this.tryReconnecting.bind(this));
    window.removeEventListener('offline', this.onWindowOffline.bind(this));
  }

  private updateStatus(status: ClientStatus) {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.emit('statusUpdate', status);
  }

  private isOnlinePromise() {
    return new Promise((resolve, reject) => {
      console.log(this.uaOptions.transportOptions.wsServers);

      const checkSocket = new WebSocket(this.uaOptions.transportOptions.wsServers, 'sip');

      const handlers = {
        onError: e => {
          console.log(e);
          console.log('it broke...');
          checkSocket.removeEventListener('open', handlers.onOpen);
          throw new Error('it broke woops');
        },
        onOpen: () => {
          console.log('yay it works');
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
        console.log('transport created');
        this.ua.transport.once('connected', () => {
          console.log('connected');
          resolve();
        });

        this.ua.transport.once('disconnected', this.tryReconnecting);
      });
    });
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
    console.log('OFFLINE NOW');
    this.updateStatus(ClientStatus.DYING);
    this.registeredPromise = undefined;

    const subtractValue = 500;
    const subtractTillDead = () => {
      this.dyingCounter -= subtractValue;

      if (this.dyingCounter === 0) {
        clearInterval(this.dyingIntervalID);
        this.dyingIntervalID = undefined;
        this.updateStatus(ClientStatus.DISCONNECTED);
      }
    };

    this.dyingIntervalID = window.setInterval(subtractTillDead, 500);
  }
}
