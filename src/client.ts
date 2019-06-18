import { EventEmitter } from 'events';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import { UA as UABase, Web } from 'sip.js';
import { ReconnectableTransport } from './reconnectable-transport';
import { WebCallingSession } from './session';
import { IWebCallingClientOptions } from './types';
import { UA } from './ua';

// TODO: BLF

export interface ISessions {
  [index: string]: WebCallingSession;
}

export class WebCallingClient extends EventEmitter {
  public readonly sessions: ISessions = {};

  private transport?: ReconnectableTransport;

  constructor(options: IWebCallingClientOptions) {
    super();

    this.configureTransport(options);
  }

  // In the case you want to switch to another account
  public async reconfigure(options: IWebCallingClientOptions) {
    await this.disconnect();

    this.transport.configure(options);

    await this.connect();
  }

  // Connect (and subsequently register) to server
  public async connect() {
    if (this.transport.registered) {
      throw new Error('already connected');
    }

    await this.transport.connect();
  }

  // Unregister (and subsequently disconnect) to server
  public async disconnect({ unregister = true } = {}): Promise<void> {
    await this.transport.disconnect({ unregister });

    this.transport.close();
  }

  // - It probably is not needed to unsubscribe/subscribe to every contact again (VERIFY THIS!).
  // - Is it neccessary that all active sessions are terminated? (VERIFY THIS)
  public async invite(phoneNumber: string) {
    if (!this.transport || !this.transport.registeredPromise) {
      throw new Error('Register first!');
    }

    await this.transport.registeredPromise;

    const session = new WebCallingSession({
      session: this.transport.invite(phoneNumber)
    });

    this.sessions[session.id] = session;

    session.once('terminated', () => delete this.sessions[session.id]);

    return session;
  }

  private configureTransport(options) {
    this.transport = new ReconnectableTransport(options);
    this.transport.on('reviveSessions', () => {
      Object.values(this.sessions).forEach(session => {
        console.log(session);
        session.rebuildSessionDescriptionHandler();
        session.reinvite();
      });
    });

    this.transport.on('invite', uaSession => {
      const session = new WebCallingSession({
        session: uaSession
      });

      this.sessions[session.id] = session;

      this.emit('invite', session);

      session.once('terminated', () => delete this.sessions[session.id]);
    });
  }
}
