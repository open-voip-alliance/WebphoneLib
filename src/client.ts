import { EventEmitter } from 'events';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';

import { UA as UABase } from 'sip.js';
import { WebCallingSession } from './session';
import { UA, WrappedTransport } from './ua';

// TODO: BLF
// TODO: media devices (discovery, selection, and checking of the getUserMedia permission?)

export interface ISessions {
  [index: string]: WebCallingSession;
}

interface IAccount {
  user: string;
  password: string;
  uri: string;
  name: string;
}

interface ITransport {
  wsServers: string;
  iceServers: string[];
}

interface IMedia {
  remoteAudio: HTMLElement;
  localAudio: HTMLElement;
}

interface IWebCallingClientOptions {
  account: IAccount;
  transport: ITransport;
  media: IMedia;
}

interface IWrappedUAOptions extends UABase.Options {
  media: IMedia;
}

export class WebCallingClient extends EventEmitter {
  public ua: UA;

  public sessions: ISessions = {};

  private options: IWrappedUAOptions;
  private transportConnectedPromise?: Promise<any>;
  private unregisteredPromise?: Promise<any>;
  private registeredPromise?: Promise<any>;
  private disconnectPromise?: Promise<any>;
  private registered: boolean = false;
  private isReconnecting: boolean = false;
  private retries: number = 10;
  private isRecovering: boolean = false;

  constructor(options: IWebCallingClientOptions) {
    super();

    this.configure(options);

    window.addEventListener('offline', async () => {
      console.log('OFFLINE NOW');
    });

    window.addEventListener('online', async () => {
      if (this.isRecovering) {
        return;
      }

      this.isRecovering = true;
      console.log('ONLINE NOW');

      const isOnline = await this.isOnline();
      if (isOnline && this.registered) {
        console.log('is really online!');

        await this.ua.transport.disconnect();
        console.log('socket closed');

        await this.ua.transport.connect();
        console.log('socket opened');

        Object.values(this.sessions).forEach(async session => {
          console.log(session);
          session.session.rebuildSessionDescriptionHandler();
          session.reinvite();
        });
      } else {
        // There is no internet, so skipping unregistering, doesn't make sense
        // without a connection.
        await this.disconnect({ unregister: false });

        this.registered = false;
      }
      this.isRecovering = false;
      // }, 1000);
    });
  }

  public isOnline(): Promise<any> {
    const hasConfiguredWsServer =
      this.options && this.options.transportOptions && this.options.transportOptions.wsServers;

    if (!hasConfiguredWsServer) {
      return Promise.resolve(false);
    }

    const tryOpeningSocketWithTimeout = () => {
      // It could happen that this function timed out. Because this is a
      // async function that
      if (!this.isRecovering) {
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

    return pTimeout(retryForever, 55000, () => {
      console.log(
        'We could not recover the session(s) within 1 minute. ' +
          'After this time the SIP server has killed the connections.'
      );
      Promise.resolve(false);
    });
  }

  // In the case you want to switch to another account
  public async reconfigure(options: IWebCallingClientOptions) {
    await this.disconnect();

    this.configure(options);

    await this.connect();
  }

  // Connect (and subsequently register) to server
  public async connect() {
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

    this.registeredPromise = new Promise((resolve, reject) => {
      this.ua.once('registered', () => {
        this.registered = true;
        resolve(true);
      });
      this.ua.once('registrationFailed', e => reject(e));
    });

    this.ua.start();

    try {
      await this.transportConnectedPromise;
    } catch (e) {
      throw new Error(`Tried to connect ${this.retries + 1} times, didn't work. Sorry.`);
    }

    this.ua.register();

    return this.registeredPromise;
  }

  // Unregister (and subsequently disconnect) to server
  public async disconnect({ unregister = true } = {}): Promise<void> {
    if (this.disconnectPromise) {
      console.log('returning disconnectpromise');
      return this.disconnectPromise;
    }

    if (!this.ua) {
      throw new Error('not connected');
    }

    delete this.registeredPromise;

    if (this.registered && unregister) {
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
    }

    console.log('unregistered!');

    await this.ua.disconnect();

    console.log('disconnected!');

    this.ua.transport.removeAllListeners();
    this.ua.removeAllListeners();

    delete this.ua;
    delete this.unregisteredPromise;
  }

  // - It probably is not needed to unsubscribe/subscribe to every contact again (VERIFY THIS!).
  // - Is it neccessary that all active sessions are terminated? (VERIFY THIS)
  public async invite(phoneNumber: string, options: any = {}) {
    if (!this.registeredPromise) {
      throw new Error('Register first!');
    }

    await this.registeredPromise;

    const session = new WebCallingSession({
      constraints: { audio: true },
      media: this.options.media,
      session: this.ua.invite(phoneNumber, options)
    });

    this.sessions[session.id] = session;

    session.once('terminated', () => delete this.sessions[session.id]);

    return session;
  }

  private async reconnect(): Promise<boolean> {
    this.isReconnecting = true;

    try {
      await pRetry(this.connect.bind(this), {
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

  private configureUA() {
    this.ua = new UA(this.options);

    this.transportConnectedPromise = new Promise((resolve, reject) => {
      this.ua.once('transportCreated', () => {
        console.log('transport created');
        this.ua.transport.once('connected', () => {
          console.log('connected');
          resolve();
        });

        this.ua.transport.once('disconnected', async e => {
          console.log('unexpected disconnect');

          await this.disconnect();

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
            reject(e);
          }
        });
      });
    });

    this.ua.on('invite', uaSession => {
      // TODO don't hardcode these..
      const constraints = { audio: true, video: false };
      const media = this.options.media;

      const session = new WebCallingSession({
        constraints,
        media: this.options.media,
        session: uaSession
      });

      this.sessions[session.id] = session;

      this.emit('invite', session);

      session.once('terminated', () => delete this.sessions[session.id]);
    });
  }

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

  private configure(options: IWebCallingClientOptions) {
    const { account, transport, media } = options;

    this.options = {
      ...this.defaultOptions,
      authorizationUser: account.user,
      media,
      password: account.password,
      sessionDescriptionHandlerFactoryOptions: {
        constraints: { audio: true, video: false },
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

  private isOnlinePromise() {
    return new Promise((resolve, reject) => {
      console.log(this.options.transportOptions.wsServers);

      const checkSocket = new WebSocket(this.options.transportOptions.wsServers, 'sip');
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
}
