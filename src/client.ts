import { EventEmitter } from 'events';

import { Core } from 'sip.js';
import { Notification } from 'sip.js/lib/api/notification';
import { Publisher } from 'sip.js/lib/api/publisher';
import { PublisherOptions } from 'sip.js/lib/api/publisher-options';
import { Subscriber } from 'sip.js/lib/api/subscriber';
import { SubscriptionState } from 'sip.js/lib/api/subscription-state';
import { UserAgent } from 'sip.js/lib/api/user-agent';
import { UserAgentOptions } from 'sip.js/lib/api/user-agent-options';

import { ClientStatus, ReconnectionMode } from './enums';
import * as Features from './features';
import { Invitation } from './invitation';
import { Inviter } from './inviter';
import { createFrozenProxy } from './lib/freeze';
import { log } from './logger';
import { ISession, SessionImpl } from './session';
import { statusFromDialog, cseqFromDialog } from './subscription';
import { second } from './time';
import { ITransport, ReconnectableTransport, TransportFactory, UAFactory } from './transport';
import { IClientOptions, IMedia } from './types';

// TODO: use EventTarget instead of EventEmitter.

export interface IClient {
  /**
   * To setup a different voip account, sipserver or media devices. If you want
   * to adapt media devices it is better to do it on-the-fly by adapting the
   * media property on client (to change it globally) or by adapting the media
   * property on session.
   */
  reconfigure(options: IClientOptions): Promise<void>;

  /**
   * Connect (and subsequently register) to server.
   */
  connect(): Promise<boolean>;

  /**
   * Unregister (and subsequently disconnect) to server.
   */
  disconnect(): Promise<void>;

  /**
   * Call this before you want to delete an instance of this class.
   */
  close(): Promise<void>;

  isConnected(): boolean;

  /**
   * Make an outgoing call. Requires you to be registered to a sip server.
   *
   * Returns a promise which resolves as soon as the connected sip server
   * emits a progress response, or rejects when something goes wrong in that
   * process.
   *
   * @param uri  For example "sip:497920039@voipgrid.nl"
   */
  invite(uri: string): Promise<ISession>;

  subscribe(uri: string): Promise<void>;
  unsubscribe(uri: string): void;

  getSession(id: string): ISession;
  getSessions(): ISession[];

  /**
   * Do an attended transfer from session a to session b.
   *
   * ```typescript
   * const sessionA = await client.invite(uri);
   * const sessionB = await client.invite(uri);
   *
   * if (await sessionA.accepted()) {
   *   await client.attendedTransfer(sessionA, sessionB);
   * }
   * ```
   */
  attendedTransfer(a: { id: string }, b: { id: string }): Promise<boolean>;

  createPublisher(contact: string, options: PublisherOptions): Publisher;

  setDoNotDisturb(enabled: boolean);

  setShouldIgnoreDoNotDisturb(func: any);

  /* tslint:disable:unified-signatures */
  /**
   * When receiving an invite, a (frozen) proxy session is returned which can be
   * used to display what is needed in your interface.
   *
   * ```typescript
   * client.on('invite', session => {
   *   const { number, displayName } = session.remoteIdentity;
   *
   *   // accept the incoming session after 5 seconds.
   *   setTimeout(() => session.accept(), 5000)
   *
   *   await session.accepted();
   *
   *   // session is accepted!
   *
   *   // terminate the session after 5 seconds.
   *   setTimeout(() => session.terminate(), 5000)
   * })
   *
   * ```
   */
  on(event: 'invite', listener: (session: ISession) => void): this;

  /**
   * When a notify event for a specific subscription occurs, the status is
   * parsed from the XML request body and forwarded through the
   * `subscriptionNotify` event.
   *
   * ```typescript
   * const contact: string = 'sip:12345678@voipgrid.nl';
   *
   * client.on('subscriptionNotify', (contact, status) => {
   *   console.log(`${contact}: ${notification}`);
   * })
   *
   * await client.subscribe(contact);
   * ```
   */
  on(event: 'subscriptionNotify', listener: (contact: string, status: string) => void): this;

  /**
   * When a session is added to the sessions by an incoming or outgoing
   * call, a sessionAdded event is emitted.
   */
  on(event: 'sessionAdded', listener: ({ id }) => void): this;

  /**
   * When a session is removed because it is terminated  a sessionRemoved event
   * is emitted.
   */
  on(event: 'sessionRemoved', listener: ({ id }) => void): this;
  /* tslint:enable:unified-signatures */
}

/**
 * @hidden
 */
export class ClientImpl extends EventEmitter implements IClient {
  public defaultMedia: IMedia;

  private readonly sessions: { [index: string]: SessionImpl } = {};
  private subscriptions: { [index: string]: Subscriber } = {};
  private subscriptionSequenceNumbers: { [index: string]: number } = {};
  private connected = false;

  private transportFactory: TransportFactory;
  private transport?: ITransport;

  constructor(uaFactory: UAFactory, transportFactory: TransportFactory, options: IClientOptions) {
    super();

    if (!Features.checkRequired()) {
      throw new Error('unsupported_browser');
    }

    this.defaultMedia = options.media;

    this.transportFactory = transportFactory;
    this.configureTransport(uaFactory, options);
  }

  public async reconfigure(options: IClientOptions): Promise<void> {
    await this.disconnect();

    this.defaultMedia = options.media;
    this.transport.configure(options);

    await this.connect();
  }

  public connect(): Promise<boolean> {
    return this.transport.connect();
  }

  public async disconnect(): Promise<void> {
    // Actual unsubscribing is done in ua.stop
    await this.transport.disconnect({ hasRegistered: true });
    this.subscriptions = {};
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async invite(uri: string): Promise<ISession> {
    if (!this.transport.registeredPromise) {
      throw new Error('Register first!');
    }

    await this.transport.registeredPromise;

    let session: SessionImpl;
    try {
      // Retrying this once if it fails. While the socket seems healthy, it
      // might in fact not be. In that case the act of sending data over the
      // socket (the act of inviting in this case) will cause us to detect
      // that the socket is broken. In that case getConnection will try to
      // regain connection, to quickly re-invite over the newly created
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

    return session.freeze();
  }

  public async close(): Promise<void> {
    await this.disconnect();

    this.transport.close();
    this.transport.removeAllListeners();

    delete this.transport;
  }

  public subscribe(uri: string): Promise<void> {
    if (!this.transport.registeredPromise) {
      throw new Error('Register first!');
    }

    return new Promise<void>((resolve, reject) => {
      if (this.subscriptions[uri]) {
        log.info('Already subscribed', this.constructor.name);

        resolve();
        return;
      }

      this.subscriptions[uri] = this.transport.createSubscriber(uri);

      this.subscriptions[uri].delegate = {
        onNotify: (notification: Notification) => {
          notification.accept();
          // oldSequenceNumber will be defaulted to -1 if it is not set yet.
          const oldSequenceNumber = this.subscriptionSequenceNumbers[uri] || -1;
          const currentSequenceNumber = cseqFromDialog(notification);

          if (currentSequenceNumber > oldSequenceNumber) {
            this.subscriptionSequenceNumbers[uri] = currentSequenceNumber;
            this.emit('subscriptionNotify', uri, statusFromDialog(notification));
          }
        }
      };

      this.subscriptions[uri].stateChange.on((newState: SubscriptionState) => {
        switch (newState) {
          case SubscriptionState.Subscribed:
            resolve();
            break;
          case SubscriptionState.Terminated:
            delete this.subscriptions[uri];
            this.emit('subscriptionTerminated', uri);
            break;
        }
      });

      this.subscriptions[uri].on('failed', (response: Core.IncomingResponseMessage) => {
        if (!response) {
          this.removeSubscription({ uri });
          reject();
          return;
        }

        let waitTime = 100;

        const retryAfter = response.getHeader('Retry-After');
        if (retryAfter) {
          log.info(
            `Subscription rate-limited. Retrying after ${retryAfter} seconds.`,
            this.constructor.name
          );
          waitTime = Number(retryAfter) * second;
        }

        setTimeout(() => {
          this.removeSubscription({ uri });
          this.subscribe(uri)
            .then(resolve)
            .catch(reject);
        }, waitTime);
      });

      this.subscriptions[uri].subscribe();
    });
  }
  public async resubscribe(uri: string): Promise<void> {
    if (!this.subscriptions[uri]) {
      throw new Error('Cannot resubscribe to nonexistent subscription.');
    }

    this.removeSubscription({ uri });
    await this.subscribe(uri);
    log.debug(`Resubscribed to ${uri}`, this.constructor.name);
  }

  public unsubscribe(uri: string): void {
    if (!this.subscriptions[uri]) {
      return;
    }

    this.removeSubscription({ uri, unsubscribe: true });
  }

  public getSession(id: string): ISession {
    const session = this.sessions[id];
    if (session) {
      return session.freeze();
    }
  }

  public getSessions(): ISession[] {
    return Object.values(this.sessions).map(session => session.freeze());
  }

  public attendedTransfer(a: ISession, b: ISession): Promise<boolean> {
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

  public createPublisher(contact: string, options: PublisherOptions): Publisher {
    if (!this.transport.registeredPromise) {
      throw new Error('Register first!');
    }

    return this.transport.createPublisher(contact, options);
  }

  public setDoNotDisturb(enabled: boolean): void {
    this.transport.setDoNotDisturb(enabled);
  }

  public setShouldIgnoreDoNotDisturb(func: any): void {
    this.transport.shouldIgnoreDoNotDisturb = func;
  }

  private configureTransport(uaFactory: UAFactory, options: IClientOptions) {
    this.transport = this.transportFactory(uaFactory, options);

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

    this.transport.on('invite', ({ invitation, cancelled }) => {
      const session = new Invitation({
        media: this.defaultMedia,
        session: invitation,
        onTerminated: this.onSessionTerminated.bind(this),
        cancelled,
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
    if (!(sessionId in this.sessions)) {
      log.info(
        `Broken session (probably due to failed invite) ${sessionId} is terminated.`,
        this.constructor.name
      );
      return;
    }

    const session = this.sessions[sessionId];
    log.info(`Session ${sessionId} is terminated.`, this.constructor.name);
    this.removeSession(session);
  }

  private async tryInvite(phoneNumber: string): Promise<SessionImpl> {
    const outgoingSession = this.transport.createInviter(phoneNumber);

    const session = new Inviter({
      media: this.defaultMedia,
      session: outgoingSession,
      onTerminated: this.onSessionTerminated.bind(this),
      isIncoming: false
    });

    this.addSession(session);

    let rejectWithError;
    const disconnectedPromise = new Promise((resolve, reject) => {
      rejectWithError = () => reject(new Error('Socket broke during inviting'));
      this.transport.once('transportDisconnected', rejectWithError);
    });

    try {
      await Promise.race([
        Promise.all([session.invite(), session.tried()]),
        session.accepted(), // trying might not always emitted, in that case accepted might have < not sure anymore
        disconnectedPromise
      ]);
    } catch (e) {
      this.removeSession(session);
      log.error('Could not send an invite. Socket could be broken.', this.constructor.name);
      return Promise.reject(new Error('Could not send an invite. Socket could be broken.'));
    } finally {
      this.transport.removeListener('transportDisconnected', rejectWithError);
    }

    return session;
  }

  private removeSubscription({ uri, unsubscribe = false }) {
    if (!(uri in this.subscriptions)) {
      return;
    }

    this.subscriptions[uri].removeAllListeners();

    if (unsubscribe) {
      this.subscriptions[uri].unsubscribe();
    } else {
      this.subscriptions[uri].dispose();
    }

    delete this.subscriptionSequenceNumbers[uri];
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

type ClientCtor = new (options: IClientOptions) => IClient;

/**
 * A (frozen) proxy object for ClientImpl.
 * Only the properties listed here are exposed to the proxy.
 *
 * See [[IClient]] interface for more details on these properties.
 *
 * Typescript users of this library don't strictly need this, as Typescript
 * generally prevents using private attributes. But, even in Typescript there
 * are ways around this.
 */
export const Client: ClientCtor = (function(clientOptions: IClientOptions) {
  const uaFactory = (options: UserAgentOptions) => {
    return new UserAgent(options);
  };

  const transportFactory = (factory: UAFactory, options: IClientOptions) => {
    return new ReconnectableTransport(factory, options);
  };

  const impl = new ClientImpl(uaFactory, transportFactory, clientOptions);
  createFrozenProxy(this, impl, [
    'attendedTransfer',
    'connect',
    'disconnect',
    'getSession',
    'getSessions',
    'invite',
    'createPublisher',
    'isConnected',
    'on',
    'once',
    'reconfigure',
    'removeAllListeners',
    'removeListener',
    'subscribe',
    'resubscribe',
    'setDoNotDisturb',
    'unsubscribe',
    'defaultMedia',
    'setShouldIgnoreDoNotDisturb'
  ]);
} as any) as ClientCtor;
