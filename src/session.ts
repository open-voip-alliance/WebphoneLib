import { EventEmitter } from 'events';
import {
  Grammar,
  InviteClientContext,
  InviteServerContext,
  ReferClientContext,
  ReferServerContext
} from 'sip.js';

interface IRTCPeerConnectionLegacy extends RTCPeerConnection {
  getRemoteStreams: () => MediaStream[];
  getLocalStreams: () => MediaStream[];
}

type InternalSession = InviteClientContext &
  InviteServerContext & {
    sessionDescriptionHandler: {
      peerConnection: IRTCPeerConnectionLegacy;
    };
  };

interface IRemoteIdentity {
  phoneNumber: string;
  displayName: string;
}

type ReferContext = ReferClientContext | ReferServerContext;

// TODO: media handling
// see: https://github.com/onsip/SIP.js/blob/e40892a63adb3622c154cb4f9343d693846288b8/src/Web/Simple.ts#L327
// and: https://github.com/onsip/SIP.js/blob/e40892a63adb3622c154cb4f9343d693846288b8/src/Web/Simple.ts#L294
// and: https://github.com/ringcentral/ringcentral-web-phone/blob/49a07377ac319217e0a95affb57d2d0b274ca01a/src/session.ts#L656
export class WebCallingSession extends EventEmitter {
  public readonly id: string;
  public saidBye: boolean;
  private session: InternalSession;
  private constraints: any;
  private media: any;
  private acceptedPromise: Promise<boolean>;
  private acceptPromise: Promise<void>;
  private rejectPromise: Promise<void>;
  private terminatedPromise: Promise<void>;
  private reinvitePromise: Promise<boolean>;
  private referRequestedPromise: Promise<ReferContext>;
  private referRequestPromise: Promise<boolean>;
  private referContext: ReferClientContext | ReferServerContext;

  constructor({ session, constraints, media }) {
    super();
    this.session = session;
    this.id = session.request.callId;
    this.constraints = constraints;
    this.media = media;

    this.acceptedPromise = new Promise(resolve => {
      // Explicitly using var here to make use of hoisting to enable a
      // 2-way-reference.
      // tslint:disable-next-line:prefer-const no-var-keyword
      var onAccepted = () => {
        this.session.removeListener('rejected', onRejected);
        resolve(true);
      };

      // tslint:disable-next-line:prefer-const no-var-keyword
      var onRejected = () => {
        this.session.removeListener('accepted', onAccepted);
        resolve(false);
      };

      this.session.once('accepted', onAccepted);
      this.session.once('rejected', onRejected);
    });

    this.terminatedPromise = new Promise(resolve => {
      this.session.once('terminated', () => {
        console.log('on.terminated');
        this.emit('terminated', this.session);
        resolve();
      });
    });

    this.saidBye = false;
    this.session.once('bye', () => (this.saidBye = true));

    this.session.on('trackAdded', this.addTrack.bind(this));
  }

  get remoteIdentity(): IRemoteIdentity {
    const request = this.session.request;
    let identity;
    ['P-Asserted-Identity', 'Remote-Party-Id', 'From'].some(header => {
      if (request.hasHeader(header)) {
        identity = Grammar.nameAddrHeaderParse(request.getHeader(header));
        return true;
      }
    });

    let phoneNumber = this.session.remoteIdentity.uri.user;
    let displayName: string;

    if (identity) {
      phoneNumber = identity.uri.normal.user;
      displayName = identity.displayName;
    }

    return { phoneNumber, displayName };
  }

  public accept(options: any = {}): Promise<void> {
    if (this.rejectPromise) {
      throw new Error('invalid operation: session is rejected');
    }

    if (this.acceptPromise) {
      return this.acceptPromise;
    }

    this.acceptPromise = new Promise((resolve, reject) => {
      // Explicitly using var here to make use of hoisting to enable a
      // 2-way-reference.
      //
      // tslint:disable-next-line:prefer-const no-var-keyword
      var onAnswered = () => {
        this.session.removeListener('failed', onFail);
        resolve();
      };

      // tslint:disable-next-line:prefer-const no-var-keyword
      var onFail = e => {
        this.session.removeListener('accepted', onAnswered);
        reject(e);
      };

      this.session.once('accepted', onAnswered);
      this.session.once('failed', onFail);

      this.session.accept(options);
    });

    return this.acceptPromise;
  }

  public reject(options: any = {}): Promise<void> {
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

  public accepted(): Promise<boolean> {
    return this.acceptedPromise;
  }

  public terminated(): Promise<void> {
    return this.terminatedPromise;
  }

  public terminate(options = {}): Promise<void> {
    this.session.terminate(options);
    return this.terminatedPromise;
  }

  public hold(): Promise<boolean> {
    this.reinvitePromise = this.getReinvitePromise();

    console.log('hold is clicked!');
    this.session.hold();

    return this.reinvitePromise;
  }

  public unhold(): Promise<boolean> {
    this.reinvitePromise = this.getReinvitePromise();

    console.log('unhold is clicked!');
    this.session.unhold();

    return this.reinvitePromise;
  }

  // In the case of a BLIND transfer, a string can be passed along with a
  // number.
  // In the case of an ATTENDED transfer, a NEW call(/session) should be
  // made. This NEW session (a.k.a. InviteClientContext/InviteServerContext
  // depending on whether it is outbound or inbound) should then be passed
  // to this function.
  public async transfer(
    target: InviteClientContext | InviteServerContext | string
  ): Promise<boolean> {
    this.referRequestedPromise = new Promise((resolve, rejected) =>
      this.session.once('referRequested', referContext => {
        console.log('refer is requested');
        resolve(referContext);
      })
    );

    this.session.refer(target);

    this.referContext = await this.referRequestedPromise;

    this.referRequestPromise = new Promise((resolve, rejected) => {
      this.referContext.once('referAccepted', () => {
        console.log('refer is accepted!');
        resolve(true);
      });
    });

    return this.referRequestPromise;
  }

  /**
   * Function this.session.bye triggers terminated, so nothing else has to be
   * done here.
   */
  public bye() {
    this.session.bye();
  }

  public dtmf(key) {
    this.session.dtmf(key);
  }

  // public transfer() {}

  public addTrack() {
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
      remoteStream = pc.getRemoteStreams()[0];
    }

    this.media.remoteAudio.srcObject = remoteStream;
    // this.media.remoteAudio.play().catch(() => {
    //   console.error('local play was rejected');
    // });

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
    // this.media.localAudio.play().catch(() => {
    //   console.error('local play was rejected');
    // });
  }

  private getReinvitePromise(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Explicitly using var here to make use of hoisting to enable a
      // 2-way-reference.
      //
      // tslint:disable-next-line:prefer-const no-var-keyword
      var onReinviteAccepted = e => {
        console.log('reinviteaccepted called!', e);
        this.session.removeListener('reinviteFailed', onReinviteFailed);
        // Calling resolve after removeListener, otherwise, when it fails,
        // the resolved promise can not be rejected with an error trace
        // anymore.
        resolve(true);
      };

      // tslint:disable-next-line:prefer-const no-var-keyword
      var onReinviteFailed = e => {
        console.log(onReinviteAccepted);
        this.session.removeListener('reinviteAccepted', onReinviteAccepted);
        // Calling reject after removeListener, otherwise, when it fails,
        // reject returns the wrong trace.
        reject(e);
      };

      this.session.once('reinviteAccepted', onReinviteAccepted);
      this.session.once('reinviteFailed', onReinviteFailed);
    });
  }
}
