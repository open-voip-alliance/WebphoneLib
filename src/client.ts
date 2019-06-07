import { EventEmitter } from 'events';
import { UA } from './ua';
import { UA as UABase } from 'sip.js';
import { Web, SessionDescriptionHandlerModifier } from 'sip.js';
import { WebCallingSession } from './session';
import { IWebCallingClientOptions, IMedia, MediaInput, MediaOutput } from './types';
import { sessionDescriptionHandlerFactory } from './session-description-handler';

// TODO: BLF

interface ISessions {
  [index: string]: WebCallingSession;
}


export class WebCallingClient extends EventEmitter {
  public readonly sessions: ISessions = {};

  private ua: UA;
  private uaOptions: UABase.Options;
  private defaultMedia: IMedia;

  private transportConnectedPromise?: Promise<any>;
  private unregisteredPromise?: Promise<any>;
  private registeredPromise?: Promise<any>;
  private disconnectPromise?: Promise<any>;

  constructor(options: IWebCallingClientOptions) {
    super();

    const { account, transport, media } = options;

    this.defaultMedia = media;

    this.uaOptions = {
      authorizationUser: account.user,
      autostart: false,
      autostop: false,
      displayName: account.name,
      log: {
        builtinEnabled: true,
        connector: undefined, // console.log,
        level: 'warn'
      },
      noAnswerTimeout: 60,
      password: account.password,
      register: false,
      registerOptions: {
        expires: 3600
      },
      sessionDescriptionHandlerFactory: sessionDescriptionHandlerFactory,
      sessionDescriptionHandlerFactoryOptions: {
        media: media,
        constraints: { audio: true, video: false },
        peerConnectionOptions: {
          rtcConfiguration: {
            iceServers: transport.iceServers.map((s: string) => ({ urls: s }))
          }
        },
        modifiers: [
          Web.Modifiers.stripVideo,
          // stripPrivateIps
        ]
      },
      transportOptions: {
        maxReconnectAttempts: 0,
        traceSip: true,
        wsServers: transport.wsServers
      },
      uri: account.uri,
      userAgentString: 'vialer-calling-lib'
    };
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
  public async invite(phoneNumber: string) {
    if (!this.registeredPromise) {
      throw new Error('Register first!');
    }

    await this.registeredPromise;

    const session = new WebCallingSession({
      media: this.defaultMedia,
      session: this.ua.invite(phoneNumber)
    });

    this.sessions[session.id] = session;
    session.once('terminated', () => delete this.sessions[session.id]);

    return session;
  }

  private configureUA() {
    this.ua = new UA(this.uaOptions);

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
      const session = new WebCallingSession({
        media: this.defaultMedia,
        session: uaSession
      });

      this.sessions[session.id] = session;

      this.emit('invite', session);
      session.once('terminated', () => delete this.sessions[session.id]);
    });

  }
}
