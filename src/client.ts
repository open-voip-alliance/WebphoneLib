import { EventEmitter } from 'events';
import { UA as UABase } from 'sip.js';
import { WebCallingSession } from './session';
import { UA } from './ua';

// TODO: BLF
// TODO: media devices (discovery, selection, and checking of the getUserMedia permission?)

interface ISessions {
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
  public options: IWrappedUAOptions;
  public ua: UA;

  public readonly sessions: ISessions = {};

  private transportConnectedPromise?: Promise<any>;
  private unregisteredPromise?: Promise<any>;
  private registeredPromise?: Promise<any>;
  private disconnectPromise?: Promise<any>;

  constructor(options: IWebCallingClientOptions) {
    super();

    const { account, transport, media } = options;

    this.options = {
      authorizationUser: account.user,
      autostart: false,
      autostop: false,
      displayName: account.name,
      log: {
        builtinEnabled: true,
        connector: undefined,
        level: 'warn'
      },
      media,
      noAnswerTimeout: 60,
      password: account.password,
      register: false,
      registerOptions: {
        expires: 3600
      },
      sessionDescriptionHandlerFactoryOptions: {
        constraints: { audio: true, video: false },
        peerConnectionOptions: {
          rtcConfiguration: {
            iceServers: transport.iceServers.map((s: string) => ({ urls: s }))
          }
        }
      },
      transportOptions: {
        maxReconnectAttempts: 0,
        traceSip: true,
        wsServers: transport.wsServers
      },
      uri: account.uri,
      userAgentString: 'vialer-calling-lib'
    };

    console.log(this.options);
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
      this.ua.once('registered', () => resolve(true));
      this.ua.once('registrationFailed', e => reject(e));
    });

    this.ua.start();

    await this.transportConnectedPromise;

    this.ua.register();

    return this.registeredPromise;
  }

  // Unregister (and subsequently disconnect) to server
  public async disconnect(): Promise<void> {
    if (this.disconnectPromise) {
      return this.disconnectPromise;
    }

    if (!this.ua) {
      throw new Error('not connected');
    }

    this.unregisteredPromise = new Promise(resolve =>
      this.ua.once('unregistered', () => resolve(true))
    );

    delete this.registeredPromise;

    this.ua.unregister();

    // Little protection to make sure our account is actually unregistered
    // and received an ACK before other functions are called
    // (i.e. ua.disconnect)
    await this.unregisteredPromise;

    console.log('unregistered!');

    await this.ua.disconnect();

    console.log('disconnected!');

    this.ua.transport.removeAllListeners();
    this.ua.removeAllListeners();

    delete this.ua;
    delete this.unregisteredPromise;
  }

  // TODO: consider having a separate register/unregister to support the usecase
  // of switching voip accounts.
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
    // TODO: remove from _sessions when session is terminated. (bind handler?)
    return session;
  }

  private configureUA() {
    this.ua = new UA(this.options);

    this.transportConnectedPromise = new Promise(resolve => {
      this.ua.on('transportCreated', () => {
        console.log('transport created');
        this.ua.transport.on('connected', () => {
          console.log('connected');
          resolve();
        });

        // TODO: Implement reconnection strategies here
        this.ua.transport.on('disconnected', () => {
          console.log('unexpected disconnect');
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
}
