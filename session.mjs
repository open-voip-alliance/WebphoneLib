import EventEmitter from 'events';

export class SipLibSession extends EventEmitter {
  constructor({ session, constraints }) {
    super();
    this.session = session;
    this.id = 123; // TODO: somehow get id of session (call-id?)
    this.constraints = constraints;

    this.acceptedPromise = new Promise(resolve => {
      this.session.once('accepted', () => resolve(true));
      this.session.once('rejected', () => resolve(false));
    });

    this.terminatedPromise = new Promise(resolve => {
      this.session.once('terminated', () => {
        console.log('on.terminated');
        resolve('ill be back');
      });
    });
  }

  accept() {
    if (this.rejectPromise) {
      throw new Error('invalid operation');
    }

    if (this.acceptPromise) {
      return this.acceptPromise;
    }

    this.acceptPromise = new Promise((resolve, reject) => {
      this.session.once('accepted', () => resolve());
      this.session.once('failed', e => reject(e));

      this.session.accept({ constraints: this.constraints });
    });

    return this.acceptPromise;
  }

  reject() {
    if (this.acceptPromise) {
      throw new Error('invalid operation');
    }

    if (this.rejectPromise) {
      return this.rejectPromise;
    }

    this.rejectPromise = new Promise(resolve => {
      this.session.once('rejected', () => resolve());
      // this.once('failed', (e) => reject(e));

      this.session.reject({ constraints: this.constraints });
    });

    return this.rejectPromise;
  }

  accepted() {
    return this.acceptedPromise;
  }

  terminated() {
    return this.terminatedPromise;
  }

  terminate() {
    this.session.terminate();
    return this.terminatedPromise;
  }
}
