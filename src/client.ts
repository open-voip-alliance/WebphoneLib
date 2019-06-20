import { EventEmitter } from 'events';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import { UA as UABase, Web } from 'sip.js';
import { ClientStatus } from './enums';
import { ReconnectableTransport } from './reconnectable-transport';
import { WebCallingSession } from './session';
import { IWebCallingClientOptions } from './types';
import { UA } from './ua';

export interface ISessions {
  [index: string]: WebCallingSession;
}

export interface IWebCallingClient {
  reconfigure(options: IWebCallingClientOptions): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  invite(contact: string): Promise<WebCallingSession>;
  subscribe(contact: string): Promise<void>;
  unsubscribe(contact: string): Promise<void>;

  on(event: 'invite', listener: (session: WebCallingSession) => void): this;
  on(event: 'subscriptionNotify', listener: (contact: string, state: string) => void): this;
}

export class WebCallingClient extends EventEmitter implements IWebCallingClient {
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
    await this.transport.connect();
  }

  // Unregister (and subsequently disconnect) to server
  public async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  public async invite(phoneNumber: string) {
    if (!this.transport.registeredPromise) {
      throw new Error('Register first!');
    }

    await this.transport.registeredPromise;
    let uaSession;
    try {
      // Retrying this once if it fails. While the socket seems healthy, it
      // might in fact not be. In that case the act of sending data over the
      // socket (the act of inviting) will cause us to detect that the
      // socket is broken somehow. In that case onDisconnected will trigger
      uaSession = await this.transport.invite(phoneNumber).catch(async e => {
        console.log('something went wrong here. trying to recover.');

        await this.transport.tryReconnecting({ timeLeft: 2000 });

        if (this.transport.status !== ClientStatus.CONNECTED) {
          throw new Error('Not sending out invite. It appears we are not connected. =(');
        }

        console.log('it appears we are back!');
        return await this.transport.invite(phoneNumber);
      });
    } catch (e) {
      console.error('', e);
      return;
    }

    console.log(uaSession);

    const session = new WebCallingSession({ session: uaSession });

    this.sessions[session.id] = session;

    session.once('terminated', () => {
      console.log('terminated....');
      delete this.sessions[session.id];
    });

    return session;
  }

  /**
   * Call this before you want to delete an instance of this class.
   */
  public async close() {
    await this.disconnect();

    this.transport.close();
    this.transport.removeAllListeners();

    delete this.transport;
  }

  public async subscribe(contact: string): Promise<void> {
    return Promise.reject('not implemented');
  }

  public async unsubscribe(contact: string): Promise<void> {
    return Promise.reject('not implemented');
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

    this.transport.on('statusUpdate', status => {
      console.log(`Status change to: ${ClientStatus[status]}`);
      this.emit('statusUpdate', status);
    });
  }
}
