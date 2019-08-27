import { EventEmitter } from 'events';

import { ClientStatus, ReconnectionMode } from './enums';
import * as Features from './features';
import { log } from './logger';
import { ReconnectableTransport } from './reconnectable-transport';
import { Session, SessionImpl } from './session';
import { Subscription, statusFromDialog } from './subscription';
import { second } from './time';
import { IClientOptions, IMedia } from './types';
import { frozenClass } from './lib/freeze';

import { Core } from 'sip.js';

// TODO: use EventTarget instead of EventEmitter.

interface IClient {
  reconfigure(options: IClientOptions): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  invite(uri: string): Promise<Session>;
  subscribe(uri: string): Promise<void>;
  unsubscribe(uri: string): void;

  getSession(id: string): Session;
  getSessions(): Session[];

  attendedTransfer(a: { id: string }, b: { id: string }): Promise<boolean>;

  /* tslint:disable:unified-signatures */
  on(event: 'invite', listener: (session: Session) => void): this;
  on(event: 'subscriptionNotify', listener: (contact: string, state: string) => void): this;
  on(event: 'sessionAdded', listener: ({ id }) => void): this;
  on(event: 'sessionRemoved', listener: ({ id }) => void): this;
  /* tslint:enable:unified-signatures */
}

type SubscriptionNotification = { request: Core.IncomingRequestMessage };

export class ClientImpl extends EventEmitter implements IClient {
  public defaultMedia: IMedia;

  private readonly sessions: { [index: string]: SessionImpl } = {};
  private subscriptions: { [index: string]: Subscription } = {};
  private connected: boolean = false;

  private transport?: ReconnectableTransport;

  constructor(options: IClientOptions) {
    super();

    if (!Features.checkRequired()) {
      throw new Error('unsupported_browser');
    }

    this.defaultMedia = options.media;

    this.configureTransport(options);
  }

  /**
   * In the case you want to switch to another account
   */
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

  public isConnected(): boolean {
    return this.connected;
  }

  public async invite(uri: string): Promise<Session> {
    if (!this.transport.registeredPromise) {
      throw new Error('Register first!');
    }

    await this.transport.registeredPromise;

    let session: SessionImpl;
    try {
      // Retrying this once if it fails. While the socket seems healthy, it
      // might in fact not be. In that case the act of sending data over the
      // socket (the act of inviting) will cause us to detect that the
      // socket is broken somehow. In that case getConnection will try
      // to regain connection, to quickly re-invite over the newly created
      // socket (or not).
      session = await this.tryInvite(uri).catch(async () => {
        log.error('The WebSocket broke during the act of inviting.', this.constructor.name);
        await this.transport.getConnection(ReconnectionMode.ONCE);

        if (this.transport.status !== ClientStatus.CONNECTED) {
          throw new Error('Not sending out invite. It appears we are not connected.');
        }

        log.debug('New WebSocket is created.', this.constructor.name);
        return await this.tryInvite(uri);
      });
    } catch (e) {
      log.error(e, this.constructor.name);
      return;
    }

    this.addSession(session);

    return session.freeze();
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
        onFailed: (response: Core.IncomingResponseMessage) => {
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
        onNotify: (dialog: SubscriptionNotification) =>
          this.emit('notify', uri, statusFromDialog(dialog))
      };

      this.subscriptions[uri].on('failed', handlers.onFailed);
      this.subscriptions[uri].on('notify', handlers.onNotify);
      this.subscriptions[uri].once('notify', handlers.onFirstNotify);

      this.subscriptions[uri].subscribe();
    });
  }

  public async resubscribe(uri: string) {
    if (!this.subscriptions[uri]) {
      throw new Error('Cannot resubscribe to nonexistant subscription.');
      return;
    }

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

  public getSession(id: string): Session {
    const session = this.sessions[id];
    if (session) {
      return session.freeze();
    }
  }

  public getSessions(): Session[] {
    return Object.values(this.sessions).map(session => session.freeze());
  }

  public attendedTransfer(a: { id: string }, b: { id: string }): Promise<boolean> {
    const sessionA = this.sessions[a.id];
    if (!sessionA) {
      return Promise.reject('Session A not found');
    }

    const sessionB = this.sessions[b.id];
    if (!sessionB) {
      return Promise.reject('Session B not found');
    }

    return sessionA.attendedTransfer(sessionB);
  }

  private configureTransport(options: IClientOptions) {
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
      const session = new SessionImpl({
        media: this.defaultMedia,
        session: uaSession,
        onTerminated: this.onSessionTerminated.bind(this),
        isIncoming: true
      });

      this.addSession(session);

      this.emit('invite', session.freeze());
    });

    this.transport.on('statusUpdate', status => {
      log.debug(`Status change to: ${status}`, this.constructor.name);

      if (status === 'connected') {
        this.connected = true;
      }
      if (status === 'disconnected') {
        this.connected = false;
      }
      this.emit('statusUpdate', status);
    });
  }

  private onSessionTerminated(sessionId: string) {
    const session = this.sessions[sessionId];
    log.info(`Incoming session ${sessionId} is terminated.`, this.constructor.name);
    this.removeSession(session);
  }

  private async tryInvite(phoneNumber: string): Promise<SessionImpl> {
    return new Promise((resolve, reject) => {
      // Transport invite just creates a ClientContext, it doesn't send the
      // actual invite. We need to bind the event handlers below before we can
      // send out the actual invite. Otherwise we might miss the events.
      const uaSession = this.transport.invite(phoneNumber);
      const session = new SessionImpl({
        media: this.defaultMedia,
        session: uaSession,
        onTerminated: this.onSessionTerminated.bind(this),
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
    } else {
      this.subscriptions[uri].dispose();
    }

    delete this.subscriptions[uri];
  }

  private addSession(session: SessionImpl) {
    this.sessions[session.id] = session;
    this.emit('sessionAdded', { id: session.id });
    this.updatePriority();
  }

  private removeSession(session: SessionImpl) {
    delete this.sessions[session.id];
    this.emit('sessionRemoved', { id: session.id });
    this.updatePriority();
  }

  private updatePriority() {
    if (!this.transport) {
      return;
    }

    this.transport.updatePriority(Object.entries(this.sessions).length !== 0);
  }
}

/**
 * Never expose a reference to our internal classes/fields by wrapping the
 * ClientImpl class into a proxy object that is frozen. Only the properties
 * listed here are exposed on the proxy.
 *
 * Typescript users of this library don't strictly need this, as Typescript
 * generally prevents using private attributes. But, even in Typescript there
 * are ways around this.
 */
export const Client = frozenClass<IClient>(ClientImpl, [
  'attendedTransfer',
  'connect',
  'disconnect',
  'getSession',
  'getSessions',
  'invite',
  'isConnected',
  'on',
  'once',
  'removeAllListeners',
  'removeListener',
  'subscribe',
  'unsubscribe'
]);
