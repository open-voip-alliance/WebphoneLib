import { RegisterContext, UA as UABase, UAStatus } from 'sip.js';

export class UA extends UABase {
  private disconnectPromise: Promise<void>;

  public disconnect(): Promise<void> {
    this.stop();
    return this.disconnectPromise;
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
}
