import { EventEmitter } from 'events';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import { Subscription, UA as UABase, Web } from 'sip.js';

import { ClientStatus } from './enums';
import { ReconnectableTransport } from './reconnectable-transport';
import { Session } from './session';
import { statusFromDialog } from './subscription';
import { second } from './time';
import { IClientOptions, IMedia } from './types';
import { UA } from './ua';

export interface ISessions {
  [index: string]: Session;
}

export interface IClient {
  reconfigure(options: IClientOptions): Promise<void>;
}

export interface ISubscriptions {
  [index: string]: Subscription;
}

export interface IWebCallingClient {
  reconfigure(options: IClientOptions): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  invite(uri: string): Promise<Session>;
  subscribe(uri: string): Promise<void>;
  unsubscribe(uri: string): void;

  on(event: 'invite', listener: (session: Session) => void): this;
  on(event: 'subscriptionNotify', listener: (contact: string, state: string) => void): this;
}

export class Client extends EventEmitter implements IClient {
  public readonly sessions: ISessions = {};
  public defaultMedia: IMedia;

  private subscriptions: ISubscriptions = {};
  private ua: UA;
  private uaOptions: UABase.Options;

  private transport?: ReconnectableTransport;

  constructor(options: IClientOptions) {
    super();

    this.defaultMedia = options.media;

    this.configureTransport(options);
  }

  // In the case you want to switch to another account
  public async reconfigure(options: IClientOptions) {
    await this.disconnect();

    this.defaultMedia = options.media;
    this.transport.configure(options);

    await this.connect();
  }

  // Connect (and subsequently register) to server
  public async connect() {
    await this.transport.connect();
  }

  // Unregister (and subsequently disconnect) to server
  public async disconnect(): Promise<void> {
    // Actual unsubscribing is done in ua.stop
    await this.transport.disconnect();

    this.subscriptions = {};
  }

  public async invite(uri: string): Promise<Session> {
    if (!this.transport.registeredPromise) {
      throw new Error('Register first!');
    }

    await this.transport.registeredPromise;

    let session;
    try {
      // Retrying this once if it fails. While the socket seems healthy, it
      // might in fact not be. In that case the act of sending data over the
      // socket (the act of inviting) will cause us to detect that the
      // socket is broken somehow. In that case onDisconnected will trigger
      session = await this.tryInvite(uri).catch(async e => {
        console.log('something went wrong here. trying to recover.');
        await this.transport.tryReconnecting({ timeLeft: 2000 });

        if (this.transport.status !== ClientStatus.CONNECTED) {
          throw new Error('Not sending out invite. It appears we are not connected. =(');
        }

        console.log('it appears we are back!');
        return await this.tryInvite(uri);
      });
    } catch (e) {
      console.error('', e);
      return;
    }

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

  public subscribe(uri: string) {
    return new Promise<void>((resolve, reject) => {
      if (this.subscriptions[uri]) {
        console.log('Already subscribed!');

        resolve();
        return;
      }

      this.subscriptions[uri] = this.transport.subscribe(uri);

      const handlers = {
        onFailed: (response, cause) => {
          if (!response) {
            this.removeSubscription({ uri });
            reject();
            return;
          }

          const retryAfter = response.getHeader('Retry-After');
          if (!retryAfter) {
            this.removeSubscription({ uri });
            reject();
            return;
          }

          console.log(`Subscription rate-limited. Retrying after ${retryAfter} seconds.`);

          setTimeout(() => {
            this.removeSubscription({ uri });
            this.subscribe(uri)
              .then(resolve)
              .catch(reject);
          }, Number(retryAfter) * second);
        },
        onFirstNotify: () => {
          this.subscriptions[uri].removeListener('failed', handlers.onFailed);
          resolve();
        },
        onNotify: dialog => this.emit('notify', uri, statusFromDialog(dialog))
      };

      this.subscriptions[uri].on('failed', handlers.onFailed);
      this.subscriptions[uri].on('notify', handlers.onNotify);
      this.subscriptions[uri].once('notify', handlers.onFirstNotify);

      this.subscriptions[uri].subscribe();
    });
  }

  public async resubscribe(uri: string) {
    this.removeSubscription({ uri });
    await this.subscribe(uri);
    console.log(`Resubscribed to ${uri}`);
  }

  public unsubscribe(uri: string) {
    if (!this.subscriptions[uri]) {
      return;
    }

    this.removeSubscription({ uri, unsubscribe: true });
  }

  private configureTransport(options) {
    this.transport = new ReconnectableTransport(options);

    this.transport.on('revive', () => {
      Object.values(this.sessions).forEach(session => {
        session.rebuildSessionDescriptionHandler();
        session.reinvite();
      });

      Object.keys(this.subscriptions).forEach(async uri => {
        // Awaiting each uri, because if a uri cannot be resolved
        // 'immediately' due to rate-limiting, there is a big chance that
        // the next re-subscribe will also be rate-limited. To avoid spamming
        // the server with a bunch of asynchronous requests, we handle them
        // one by one.
        await this.resubscribe(uri);
      });
    });

    this.transport.on('invite', uaSession => {
      const session = new Session({
        media: this.defaultMedia,
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

  private async tryInvite(phoneNumber: string): Promise<Session> {
    return new Promise((resolve, reject) => {
      // Transport invite just creates a ClientContext, it doesn't send the
      // actual invite. We need to bind the event handlers below before we can
      // send out the actual invite. Otherwise we might miss the events.
      const uaSession = this.transport.invite(phoneNumber);
      const session = new Session({
        media: this.defaultMedia,
        session: uaSession
      });

      const handlers = {
        onFailed: () => {
          console.log('something went wrong here...');
          uaSession.removeListener('progress', handlers.onProgress);
          reject(new Error('Could not send an invite. Socket could be broken.'));
        },
        onProgress: () => {
          console.log('lib emitted progress');
          uaSession.removeListener('failed', handlers.onFailed);
          resolve(session);
        }
      };

      uaSession.once('failed', handlers.onFailed);
      uaSession.once('progress', handlers.onProgress);

      uaSession.invite();
    });
  }

  private removeSubscription({ uri, unsubscribe = false }) {
    this.subscriptions[uri].removeAllListeners();

    if (unsubscribe) {
      this.subscriptions[uri].unsubscribe();
    }

    delete this.subscriptions[uri];
  }
}
