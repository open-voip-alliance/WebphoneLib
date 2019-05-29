import { UA } from 'sip.js';
import { EventEmitter } from 'events';
import { WebCallingSession } from './session';


export class WebCallingClient extends EventEmitter {
  public options: any;
  public ua: UA;

  private transportConnectedPromise: Promise<any> | undefined;
  private unregisteredPromise: Promise<any> | undefined;
  private registeredPromise: Promise<any> | undefined;

  constructor(options: any) {
    super();

    const { account, transport, media } = options;

    this.options = {
      authorizationUser: account.user,
      password: account.password,
      uri: account.uri,
      displayName: account.name,
      log: {
        level: 'warn'
      },
      noanswertimeout: 60,
      transportOptions: {
        maxReconnectAttempts: 0,
        wsServers: transport.wsServers,
        traceSip: true
      },
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionOptions: {
          rtcConfiguration: {
            iceServers: transport.iceServers.map((s: string) => ({ urls: s }))
          }
        },
        constraints: { audio: true, video: false }
      },
      media,
      register: false,
      autostart: false,
      autostop: false,
      userAgentString: 'vialer-calling-lib',
      registerOptions: {
        expires: 3600
      }
    };

    console.log(this.options);
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

        this.ua.transport.on('disconnected', () => {
          console.log('disconnected');
        });
      });
    });

    this.ua.on('invite', session => {
      // TODO don't hardcode these..
      const constraints = { audio: true, video: false };
      const media = this.options.media;
      this.emit('invite', new WebCallingSession({ session, constraints, media }));
    });
  }

  // Connect (and subsequently register) to server
  async connect() {
    if (!this.ua) {
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
  async disconnect(): Promise<void> {
    if (this.unregisteredPromise) {
      return this.unregisteredPromise;
    }

    if (!this.ua) {
      throw new Error('not connected');
    }

    this.unregisteredPromise = new Promise(resolve => {
      this.ua.once('unregistered', () => resolve(true));
    });

    // 'disconnect' event is not actually emitted by ua.transport as it is
    // only used for unexpected disconnect events for ua's internal
    // reconnection strategy. Active subscriptions are gracefully killed by
    // ua.stop().
    console.log('stopping ua');
    this.ua.stop();

    // Little protection to make sure our account is actually unregistered
    // before other functions are called (i.e. connect)
    await this.unregisteredPromise;

    this.ua.transport.removeAllListeners();
    this.ua.removeAllListeners();

    delete this.ua;
    delete this.unregisteredPromise;
  }

  async invite(number: string, options: any = {}) {
    if (!this.registeredPromise) {
      throw new Error('Register first!');
    }

    await this.registeredPromise;

    return new WebCallingSession({
      session: this.ua.invite(number, options),
      constraints: { audio: true },
      media: this.options.media
    });
  }
}
