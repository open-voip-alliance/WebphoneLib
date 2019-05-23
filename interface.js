class SipLibClient {
  constructor({
    proxy,
    userMediaFlags,
    username,
    password,
  }) {
  }

  /**
   * Register the client. If it already was called before, returns the Promise.
   */
  register() {
    // In order: 
    // - transportCreated
    // - connected
    // - registered
    // - unregistered
    // - disconnected
    return new Promise((resolve, reject) {
    });
  }

  unregister() {
  }

  on('invite', (session) => {
    return patchSession(session);
  });

  on('registered', () => void;
  on('connected', () => void;
  on('disconnected', () => void;
  on('unregistered', () => void;
}


class SipLibSession {
  constructor({id, constraints}) {
    this.id = id;
    this.constraints = constraints;
  }

  accept() {
    if (this.acceptPromise) {
      return this.acceptPromise;
    }

    this.acceptPromise = new Promise((resolve, reject) {
      this.once('accepted', resolve());
      this.once('failed', reject());

      this._accept({constraints: this.constraints});
    });
  }

  active() {}
}
