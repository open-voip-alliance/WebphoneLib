import { EventEmitter } from 'events';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import { UA as UABase, Web } from 'sip.js';
import { ClientStatus } from './enums';
import { IWebCallingClientOptions } from './types';
import { UA, WrappedTransport } from './ua';

export class ReconnectableTransport extends EventEmitter {
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
  private retries: number = 3;
  private isReconnecting: boolean = false;
  private isRecovering: boolean = false;
  private uaOptions: UABase.Options;
  private dyingCounter: number = 60000;
  private dyingIntervalID: number;

  constructor(options: IWebCallingClientOptions) {
    super();

    this.configure(options);

    window.addEventListener('offline', this.onWindowOffline.bind(this));
    window.addEventListener('online', this.onWindowOnline.bind(this));
  }

  public configure(options: IWebCallingClientOptions) {
    const { account, transport } = options;

    this.uaOptions = {
      ...this.defaultOptions,
      authorizationUser: account.user,
      password: account.password,
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

    try {
      await this.transportConnectedPromise;
    } catch (e) {
      throw new Error(`Tried to connect ${this.retries + 1} times, didn't work. Sorry.`);
    }

    this.ua.register();

    return this.registeredPromise;
  }

  // Unregister (and subsequently disconnect) to server. When isOnline is
  // false, status updates are not triggered, because in that case,
  // the status updates are managed by our reconnection routines.
  public async disconnect({ isOnline = false } = {}): Promise<void> {
    if (!this.ua) {
      console.log('pssh. already disconnected.');
      return;
    }

    if (isOnline) {
      this.updateStatus(ClientStatus.DISCONNECTING);
    }

    delete this.registeredPromise;

    if (isOnline) {
      this.unregisteredPromise = new Promise(resolve =>
        this.ua.once('unregistered', () => {
          resolve(true);
        })
      );

      console.log('trying to unregister..');
      this.ua.unregister();

      // Little protection to make sure our account is actually unregistered
      // and received an ACK before other functions are called
      // (i.e. ua.disconnect)
      await this.unregisteredPromise;
    }

    console.log('unregistered!');

    await this.ua.disconnect();

    if (isOnline) {
      this.updateStatus(ClientStatus.DISCONNECTED);
    }

    console.log('disconnected!');

    this.ua.transport.removeAllListeners();
    this.ua.removeAllListeners();

    delete this.ua;
    delete this.unregisteredPromise;
  }

  public invite(phoneNumber: string) {
    return this.ua.invite(phoneNumber);
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

  public close() {
    window.removeEventListener('online', this.onWindowOnline.bind(this));
    window.removeEventListener('offline', this.onWindowOffline.bind(this));
  }

  private updateStatus(status: ClientStatus) {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.emit('statusUpdate', status);
  }

  private async reconnect(): Promise<boolean> {
    this.isReconnecting = true;

    try {
      await pRetry(this.connect.bind(this, { reconnect: true }), {
        maxTimeout: 30000,
        minTimeout: 500,
        onFailedAttempt: error => {
          console.log(
            `Connection attempt ${error.attemptNumber} failed. There are ${
              error.retriesLeft
            } retries left.`
          );
        },
        randomize: true,
        retries: this.retries
      });
      return true;
    } catch (e) {
      console.log('Not attempting to reconnect anymore');
      return false;
    }
  }

  private isOnlinePromise() {
    return new Promise((resolve, reject) => {
      console.log(this.uaOptions.transportOptions.wsServers);

      const checkSocket = new WebSocket(this.uaOptions.transportOptions.wsServers, 'sip');
      checkSocket.onopen = () => {
        console.log('yay it works');
        checkSocket.close();
        resolve(true);
      };

      checkSocket.onerror = e => {
        console.log(e);
        console.log('it broke...');
        throw new Error('it broke woops');
      };
    });
  }

  private configureUA() {
    console.log(this.uaOptions);
    this.ua = new UA(this.uaOptions);
    this.ua.on('invite', uaSession => this.emit('invite', uaSession));

    this.transportConnectedPromise = new Promise((resolve, reject) => {
      this.ua.once('transportCreated', () => {
        console.log('transport created');
        this.ua.transport.once('connected', () => {
          console.log('connected');
          resolve();
        });

        this.ua.transport.once('disconnected', async e => {
          console.log('unexpected disconnect');

          await this.disconnect({ isOnline: false });

          if (this.isReconnecting) {
            // Rejecting here to make sure that the reconnect promise in
            // pRetry is catched and can be properly retried.
            reject(e);

            // Returning here to make sure that reconnect is not called again.
            return;
          }

          const connected = await this.reconnect();

          this.isReconnecting = false;

          if (connected) {
            resolve();
          } else {
            this.updateStatus(ClientStatus.DISCONNECTED);

            reject(e);
          }
        });
      });
    });
  }

  private createRegisteredPromise() {
    return new Promise((resolve, reject) => {
      this.ua.once('registered', () => {
        this.updateStatus(ClientStatus.CONNECTED);
        resolve(true);
      });
      this.ua.once('registrationFailed', async e => {
        await this.disconnect({ isOnline: false });

        this.updateStatus(ClientStatus.DISCONNECTED);
        reject(e);
      });
    });
  }

  private async onWindowOnline() {
    if ([ClientStatus.RECOVERING, ClientStatus.DISCONNECTED].includes(this.status)) {
      return;
    }
    console.log('ONLINE NOW');

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
      this.emit('reviveSessions');

      this.registeredPromise = this.createRegisteredPromise();

      this.ua.register();

      await this.registeredPromise;
      console.log('reregistered!!');
    } else {
      // There is no internet, so skipping unregistering, doesn't make sense
      // without a connection.
      await this.disconnect({ isOnline: false });

      this.updateStatus(ClientStatus.DISCONNECTED);
    }
  }

  private onWindowOffline() {
    console.log('OFFLINE NOW');
    this.updateStatus(ClientStatus.DYING);

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
