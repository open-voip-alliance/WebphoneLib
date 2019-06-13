import pTimeout from 'p-timeout';
import {
  C as SIPConstants,
  Core,
  InviteClientContext,
  InviteServerContext,
  RegisterContext,
  SessionDescriptionHandlerModifiers,
  SessionStatus,
  UA as UABase,
  UAStatus,
  URI,
  Web
} from 'sip.js';

export class WrappedInviteClientContext extends InviteClientContext {
  public rebuildSessionDescriptionHandler() {
    console.log('session descrioption handler is rebuild!!');
    this.sessionDescriptionHandler = this.sessionDescriptionHandlerFactory(
      this,
      this.ua.configuration.sessionDescriptionHandlerFactoryOptions || {}
    );
  }
}

// tslint:disable-next-line: max-classes-per-file
export class WrappedInviteServerContext extends InviteServerContext {
  public rebuildSessionDescriptionHandler() {
    console.log('session descrioption handler is rebuild!!');
    this.sessionDescriptionHandler = this.sessionDescriptionHandlerFactory(
      this,
      this.ua.configuration.sessionDescriptionHandlerFactoryOptions || {}
    );
  }
}

// tslint:disable-next-line: max-classes-per-file
export class WrappedTransport extends Web.Transport {
  /**
   * Disconnect socket. It could happen that the user switches network
   * interfaces while calling. If this happens, closing a websocket will
   * cause it to be blocked. To make sure that UA gets to the proper internal
   * state so that it is ready to 'switch over' to the new network interface
   * with a new websocket, we call the function that normally causes the
   * disconnectPromise to be resolved after a timeout.
   */
  protected disconnectPromise(options: any = {}): Promise<any> {
    return pTimeout(super.disconnectPromise(), 5000, () => {
      console.log('calling on close by myself!');
      (this as any).onClose({ code: 'fake', reason: 'Artificial timeout' });
    }).then(() => ({ overrideEvent: true }));
  }
}

// tslint:disable-next-line: max-classes-per-file
export class UA extends UABase {
  private disconnectPromise: Promise<void>;

  constructor(configuration: UABase.Options) {
    super(configuration);

    this.configureUADelegate();
  }

  public disconnect(): Promise<void> {
    this.stop();
    return this.disconnectPromise;
  }

  /**
   * Make an outgoing call.
   *
   * @param {String} target
   * @param {Object} views
   * @param {Object} [options.media] gets passed to SIP.sessionDescriptionHandler.getDescription as mediaHint
   *
   * @throws {TypeError}
   *
   */
  public invite(
    target: string | URI,
    options?: InviteClientContext.Options,
    modifiers?: SessionDescriptionHandlerModifiers
  ): WrappedInviteClientContext {
    const context: WrappedInviteClientContext = new WrappedInviteClientContext(
      this,
      target,
      options,
      modifiers
    );
    // Delay sending actual invite until the next 'tick' if we are already
    // connected, so that API consumers can register to events fired by the
    // the session.
    this.transport.afterConnected(() => {
      context.invite();
      this.emit('inviteSent', context);
    });
    return context;
  }
  /**
   * Gracefully close.
   */
  public stop(): this {
    console.log('user requested closure...');

    if (this.status === UAStatus.STATUS_USER_CLOSED) {
      console.log('UA already closed');
      return this;
    }

    // Not unregistering here as opposed to in UABase.stop

    // Run terminate on every Session
    for (const session in this.sessions) {
      if (this.sessions[session]) {
        console.log('closing session ' + session);
        this.sessions[session].terminate();
      }
    }

    // Run unsubscribe on every Subscription
    for (const subscription in this.subscriptions) {
      if (this.subscriptions[subscription]) {
        console.log('unsubscribe ' + subscription);
        this.subscriptions[subscription].unsubscribe();
      }
    }

    // Run close on every Publisher
    for (const publisher in this.publishers) {
      if (this.publishers[publisher]) {
        console.log('unpublish ' + publisher);
        this.publishers[publisher].close();
      }
    }

    // Run close on every applicant
    for (const applicant in this.applicants) {
      if (this.applicants[applicant]) {
        this.applicants[applicant].close();
      }
    }

    this.status = UAStatus.STATUS_USER_CLOSED;

    // Disconnect the transport, store the promise and reset user agent core
    this.disconnectPromise = this.transport.disconnect();
    this.userAgentCore.reset();

    if (typeof window.removeEventListener === 'function') {
      // Google Chrome Packaged Apps don't allow 'unload' listeners:
      // unload is not available in packaged apps
      if (
        !(
          (window as any).chrome &&
          (window as any).chrome.app &&
          (window as any).chrome.app.runtime
        )
      ) {
        // Changed this.environListener() to this.stop() as environListener
        // is a private attribute, which is set to this.stop in start().
        window.removeEventListener('unload', this.stop);
      }
    }

    return this;
  }

  private configureUADelegate() {
    // The Replaces header contains information used to match an existing
    // SIP dialog (call-id, to-tag, and from-tag).  Upon receiving an INVITE
    // with a Replaces header, the User Agent (UA) attempts to match this
    // information with a confirmed or early dialog.
    // https://tools.ietf.org/html/rfc3891#section-3
    const handleInviteWithReplacesHeader = (
      context: InviteServerContext,
      request: Core.IncomingRequestMessage
    ): void => {
      if (this.configuration.replaces !== SIPConstants.supported.UNSUPPORTED) {
        const replaces = request.parseHeader('replaces');
        if (replaces) {
          const targetSession =
            this.sessions[replaces.call_id + replaces.replaces_from_tag] ||
            this.sessions[replaces.call_id + replaces.replaces_to_tag] ||
            undefined;
          if (!targetSession) {
            this.userAgentCore.replyStateless(request, { statusCode: 481 });
            return;
          }
          if (targetSession.status === SessionStatus.STATUS_TERMINATED) {
            this.userAgentCore.replyStateless(request, { statusCode: 603 });
            return;
          }
          const targetDialogId =
            replaces.call_id + replaces.replaces_to_tag + replaces.replaces_from_tag;
          const targetDialog = this.userAgentCore.dialogs.get(targetDialogId);
          if (!targetDialog) {
            this.userAgentCore.replyStateless(request, { statusCode: 481 });
            return;
          }
          if (!targetDialog.early && replaces.early_only) {
            this.userAgentCore.replyStateless(request, { statusCode: 486 });
            return;
          }
          context.replacee = targetSession;
        }
      }
    };

    this.userAgentCore.delegate.onInvite = (
      incomingInviteRequest: Core.IncomingInviteRequest
    ): void => {
      // FIXME: Ported - 100 Trying send should be configurable.
      // Only required if TU will not respond in 200ms.
      // https://tools.ietf.org/html/rfc3261#section-17.2.1
      incomingInviteRequest.trying();
      incomingInviteRequest.delegate = {
        onCancel: (cancel: Core.IncomingRequestMessage): void => {
          context.onCancel(cancel);
        },
        onTransportError: (error: Core.TransportError): void => {
          context.onTransportError();
        }
      };
      const context = new WrappedInviteServerContext(this, incomingInviteRequest);
      // Ported - handling of out of dialog INVITE with Replaces.
      handleInviteWithReplacesHeader(context, incomingInviteRequest.message);
      // Ported - make the first call to progress automatically.
      if (context.autoSendAnInitialProvisionalResponse) {
        context.progress();
      }
      console.log('incoming request being delegated.');
      this.emit('invite', context);
    };
  }
}
