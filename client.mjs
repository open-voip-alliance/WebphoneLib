import { UA } from 'sip.js';
import EventEmitter from 'events';
import { SipLibSession } from './session.mjs';


export class SipLibClient extends EventEmitter {
  constructor(options) {
    super();

    const {account, transport, media} = options;

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
            iceServers: transport.iceServers.map(s => {return {urls: s};})
          }
        },
        constraints: {audio: true, video: false},
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

    this.ua = new UA(this.options);

    this.connectedPromise = new Promise((resolve, reject) => {
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
      this.emit('invite', new SipLibSession({ session, constraints, media }));
    });
  }

  async register() {
    if (this.registeredPromise) {
      return this.registeredPromise;
    }

    this.registeredPromise = new Promise((resolve, reject) => {
      this.ua.once('registered', () => resolve(true));
      this.ua.once('registrationFailed', e => reject(e));
    });

    this.ua.start();

    await this.connectedPromise;

    this.ua.register();

    return this.registeredPromise;
  }

  async unregister() {
    // TODO: wait for unregistered event.
    this.ua.unregister();
  }

  invite(number, options = {}) {
    return new SipLibSession({
      session: this.ua.invite(number, options),
      constraints: {audio: true},
      media: this.options.media,
    });
  }
}

