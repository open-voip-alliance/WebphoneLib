import { UA } from 'sip.js';
import EventEmitter from 'events';
import { SipLibSession } from './session.mjs';


export class SipLibClient extends EventEmitter {
  constructor(options) {
    super();

    options.register = false;
    options.autostart = false;
    options.autostop = false;

    this.ua = new UA(options);

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
      this.emit('invite', new SipLibSession({ session, constraints }));
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
}

