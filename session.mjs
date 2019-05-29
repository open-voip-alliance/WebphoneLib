import EventEmitter from 'events';
import { Grammar } from 'sip.js';

// TODO: make design decision:
// - patch (like ring central)
// - or wrap (like this is now)

// TODO: media handling
// see: https://github.com/onsip/SIP.js/blob/e40892a63adb3622c154cb4f9343d693846288b8/src/Web/Simple.ts#L327
// and: https://github.com/onsip/SIP.js/blob/e40892a63adb3622c154cb4f9343d693846288b8/src/Web/Simple.ts#L294
// and: https://github.com/ringcentral/ringcentral-web-phone/blob/49a07377ac319217e0a95affb57d2d0b274ca01a/src/session.ts#L656
export class WebCallingSession extends EventEmitter {
  constructor({ session, constraints, media }) {
    super();
    this.session = session;
    this.id = session.request.callId;
    this.constraints = constraints;
    this.media = media;

    this.acceptedPromise = new Promise(resolve => {
      this.session.once('accepted', () => resolve(true));
      this.session.once('rejected', () => resolve(false));
      // this.session.once('bye', () => resolve(false));
    });

    this.terminatedPromise = new Promise(resolve => {
      this.session.once('terminated', () => {
        console.log('on.terminated');
        resolve('ill be back');
      });
    });

    this.onHoldState = false;

    this.session.on('trackAdded', this.addTrack.bind(this));
  }

  getIdentityFromRequest(request) {
    let identity;
    ['P-Asserted-Identity', 'Remote-Party-Id', 'From'].some(header => {
      if (request.hasHeader(header)) {
        identity = Grammar.nameAddrHeaderParse(request.getHeader(header));
        return true;
      }
    });
    return identity;
  }

  getIdentity() {
    console.log(this.session);
    let identity = this.getIdentityFromRequest(this.session.request);
    let number = this.session.remoteIdentity.uri.user;
    let displayName;

    if (identity) {
      number = identity.uri.normal.user;
      displayName = identity.displayName;
    }

    return { number, displayName };
  }

  accept() {
    if (this.rejectPromise) {
      throw new Error('invalid operation: session is rejected');
    }

    if (this.acceptPromise) {
      return this.acceptPromise;
    }

    this.acceptPromise = new Promise((resolve, reject) => {
      const onAnswered = () => {
        resolve(this);
        this.session.removeListener('failed', onFail);
      };

      const onFail = e => {
        reject(e);
        this.session.removeListener('accepted', onAnswered);
      };

      this.session.once('accepted', onAnswered);
      this.session.once('failed', onFail);

      this.session.accept({ constraints: this.constraints });
    });

    return this.acceptPromise;
  }

  reject(options = {}) {
    if (this.acceptPromise) {
      throw new Error('invalid operation: session is accepted');
    }

    if (this.rejectPromise) {
      return this.rejectPromise;
    }

    this.rejectPromise = new Promise(resolve => {
      this.session.once('rejected', () => resolve());
      // reject is immediate, it doesn't fail.
      this.session.reject(options);
    });

    return this.rejectPromise;
  }

  accepted() {
    return this.acceptedPromise;
  }

  terminated() {
    return this.terminatedPromise;
  }

  terminate(options = {}) {
    this.session.terminate(options);
    return this.terminatedPromise;
  }

  hold() {
    return this.setHoldState(true);
  }

  unhold() {
    return this.setHoldState(false);
  }

  async setHoldState(flag) {
    if (flag) {
      await this.session.hold();
    } else {
      await this.session.unhold();
    }
  }

  dtmf(key) {
    this.session.dtmf(key);
  }

  transfer() {}

  addTrack() {
    const pc = this.session.sessionDescriptionHandler.peerConnection;
    console.log('addTrack', arguments);

    let remoteStream = new MediaStream();
    if (pc.getReceivers) {
      pc.getReceivers().forEach(receiver => {
        const rtrack = receiver.track;
        if (rtrack) {
          remoteStream.addTrack(rtrack);
        }
      });
    } else {
      remoteStream = pc.getRemoteStream()[0];
    }

    this.media.remoteAudio.srcObject = remoteStream;
    this.media.remoteAudio.play().catch(() => {
      console.error('local play was rejected');
    });

    let localStream = new MediaStream();
    if (pc.getSenders) {
      pc.getSenders().forEach(sender => {
        const strack = sender.track;
        if (strack && strack.kind === 'audio') {
          localStream.addTrack(strack);
        }
      });
    } else {
      localStream = pc.getLocalStreams()[0];
    }
    this.media.localAudio.srcObject = localStream;
    this.media.localAudio.play().catch(() => {
      console.error('local play was rejected');
    });
  }
}
