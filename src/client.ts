import { EventEmitter } from 'events';
import pRetry from 'p-retry';
import { Subscription, UA as UABase, Web } from 'sip.js';

import { ClientStatus, ReconnectionMode } from './enums';
import * as Features from './features';
import { log } from './logger';
import { ReconnectableTransport } from './reconnectable-transport';
import { Session } from './session';
import { statusFromDialog } from './subscription';
import { second } from './time';
import { IClientOptions, IMedia } from './types';
import { UA } from './ua';

export interface ISessions {
  [index: string]: Session;
}

export interface ISubscriptions {
  [index: string]: Subscription;
}

export interface IClient {
  reconfigure(options: IClientOptions): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  invite(uri: string): Promise<Session>;
  subscribe(uri: string): Promise<void>;
  unsubscribe(uri: string): void;

  on(event: 'invite', listener: (session: Session) => void): this;
  on(event: 'subscriptionNotify', listener: (contact: string, state: string) => void): this;
  on(event: 'sessionsUpdate', listener: (sessions: ISessions) => void): this;
}

export class Client extends EventEmitter implements IClient {
  public readonly sessions: ISessions = {};
  public defaultMedia: IMedia;

  private subscriptions: ISubscriptions = {};
  private ua: UA;
  private uaOptions: UABase.Options;
  private connected: boolean = false;

  private transport?: ReconnectableTransport;

  constructor(options: IClientOptions) {
    super();

    if (!Features.checkRequired()) {
      throw new Error('Your browser is not supported by this library');
    }

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
    this.connected = true;
  }

  // Unregister (and subsequently disconnect) to server
  public async disconnect(): Promise<void> {
    // Actual unsubscribing is done in ua.stop
    await this.transport.disconnect();

    this.connected = false;
    this.subscriptions = {};
  }

  public isConnected(): boolean {
    return this.connected;
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
      // socket is broken somehow. In that case getConnection will try
      // to regain connection, to quickly re-invite over the newly created
      // socket (or not).
      session = await this.tryInvite(uri).catch(async e => {
        log.error('The WebSocket broke during the act of inviting.', this.constructor.name);
        await this.transport.getConnection(ReconnectionMode.ONCE);

        if (this.transport.status !== ClientStatus.CONNECTED) {
          throw new Error('Not sending out invite. It appears we are not connected. =(');
        }

        log.debug('New WebSocket is created.', this.constructor.name);
        return await this.tryInvite(uri);
      });
    } catch (e) {
      log.error(e, this.constructor.name);
      return;
    }

    this.sessions[session.id] = session;
    this.emit('sessionsUpdate', this.sessions);
    this.updatePriority();

    session.once('terminated', () => {
      log.info(`Outgoing session ${session.id} is terminated.`, this.constructor.name);
      delete this.sessions[session.id];
      this.emit('sessionsUpdate', this.sessions);
      this.updatePriority();
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
        log.info('Already subscribed', this.constructor.name);

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

          log.info(
            `Subscription rate-limited. Retrying after ${retryAfter} seconds.`,
            this.constructor.name
          );

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
    log.debug(`Resubscribed to ${uri}`, this.constructor.name);
  }

  public unsubscribe(uri: string) {
    if (!this.subscriptions[uri]) {
      return;
    }

    this.removeSubscription({ uri, unsubscribe: true });
  }

  private configureTransport(options) {
    this.transport = new ReconnectableTransport(options);

    this.transport.on('reviveSessions', () => {
      Object.values(this.sessions).forEach(async session => {
        session.rebuildSessionDescriptionHandler();
        await session.reinvite();
      });
    });

    this.transport.on('reviveSubscriptions', () => {
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
        session: uaSession,
        isIncoming: true
      });

      this.sessions[session.id] = session;
      this.emit('sessionsUpdate', this.sessions);
      this.updatePriority();
      this.emit('invite', session);
      session.once('terminated', () => {
        log.info(`Incoming session ${session.id} is terminated.`, this.constructor.name);
        delete this.sessions[session.id];
        this.emit('sessionsUpdate', this.sessions);
        this.updatePriority();
      });
    });

    this.transport.on('statusUpdate', status => {
      log.debug(`Status change to: ${ClientStatus[status]}`, this.constructor.name);
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
        session: uaSession,
        isIncoming: false
      });

      const handlers = {
        onFailed: () => {
          log.error('Session emitted failed after an invite.', this.constructor.name);
          uaSession.removeListener('progress', handlers.onProgress);
          reject(new Error('Could not send an invite. Socket could be broken.'));
        },
        onProgress: () => {
          log.debug('Session emitted progress after an invite.', this.constructor.name);
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

  private updatePriority() {
    if (!this.transport) {
      return;
    }

    this.transport.updatePriority(Object.entries(this.sessions).length !== 0);
  }
}
