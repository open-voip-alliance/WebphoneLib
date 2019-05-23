import { UA } from "sip.js";
import EventEmitter from "eventemitter3";

export class SipLibClient extends EventEmitter {
  constructor(options) {
    super();
    options.register = false;
    options.autostart = false;
    options.autostop = false;
    this.ua = new UA(options);
    this.ua.on("invite", session => {
      this.emit("invite", new SipLibSession({ session }));
    });
  }

  register() {
    if (this.registeredPromise) {
      return this.registeredPromise;
    }

    this.registeredPromise = new Promise((resolve, reject) => {
      this.ua.once("registered", () => resolve(true));
      this.ua.once("registrationFailed", e => reject(e));
    });

    this.ua.start();

    return this.registeredPromise;
  }
}

class SipLibSession extends EventEmitter {
  constructor({ session, constraints }) {
    super();
    this.session = session;
    this.id = 123; // TODO: somehow get id of session (call-id?)
    this.constraints = constraints;

    this.acceptedPromise = new Promise(resolve => {
      this.session.once("accepted", () => resolve(true));
      this.session.once("rejected", () => resolve(false));
    });

    this.terminatedPromise = new Promise(resolve => {
      this.once("bye", () => resolve("ill be back"));
    });
  }

  accept() {
    if (this.rejectPromise) {
      throw new Error("invalid operation");
    }

    if (this.acceptPromise) {
      return this.acceptPromise;
    }

    this.acceptPromise = new Promise((resolve, reject) => {
      this.session.once("accepted", () => resolve());
      this.session.once("failed", e => reject(e));

      this.session.accept({ constraints: this.constraints });
    });

    return this.acceptPromise;
  }

  reject() {
    if (this.acceptPromise) {
      throw new Error("invalid operation");
    }

    if (this.rejectPromise) {
      return this.rejectPromise;
    }

    this.rejectPromise = new Promise(resolve => {
      this.session.once("rejected", () => resolve());
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
}
