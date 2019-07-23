import { EventEmitter } from 'events';
import pTimeout from 'p-timeout';
import { Grammar, NameAddrHeader, ReferClientContext, ReferServerContext } from 'sip.js';

import { audioContext } from './audio-context';
import { SessionStatus } from './enums';
import { log } from './logger';
import { checkAudioConnected } from './session-health';
import { InternalSession, SessionMedia } from './session-media';
import { SessionStats } from './session-stats';
import * as Time from './time';
import { IMedia, IRemoteIdentity } from './types';
import { WrappedInviteClientContext, WrappedInviteServerContext } from './ua';

type ReferContext = ReferClientContext | ReferServerContext;

interface ISession {
  readonly id: string;
  readonly media: SessionMedia;
  readonly stats: SessionStats;
  readonly audioConnected: Promise<void>;

  on(event: 'terminated' | 'statusUpdate', listener: (session: ISession) => void): this;
  on(event: 'callQualityUpdate', listener: () => void): this;
}

export class Session extends EventEmitter implements ISession {
  public readonly id;
  public readonly media;
  public readonly stats;
  public readonly audioConnected;
  public saidBye: boolean;
  public holdState: boolean;
  public status: SessionStatus = SessionStatus.RINGING;

  private session: InternalSession;

  private acceptedPromise: Promise<boolean>;
  private acceptPromise: Promise<void>;
  private rejectPromise: Promise<void>;
  private terminatedPromise: Promise<void>;
  private reinvitePromise: Promise<boolean>;

  constructor({
    session,
    media
  }: {
    session: WrappedInviteClientContext | WrappedInviteServerContext;
    media: IMedia;
  }) {
    super();
    this.session = session as InternalSession;
    this.id = session.request.callId;
    this.media = new SessionMedia(this.session, media);
    this.media.on('mediaFailure', () => {
      // TODO: fix this so it doesn't `reject` the `terminatedPromise`?
      this.session.terminate();
    });

    this.acceptedPromise = new Promise(resolve => {
      const handlers = {
        onAccepted: () => {
          this.session.removeListener('rejected', handlers.onRejected);
          this.status = SessionStatus.ACTIVE;
          this.emit('sessionUpdate', this);
          resolve(true);
        },
        onRejected: () => {
          this.session.removeListener('accepted', handlers.onAccepted);
          resolve(false);
        }
      };

      this.session.once('accepted', handlers.onAccepted);
      this.session.once('rejected', handlers.onRejected);
    });

    // Terminated promise will resolve when the session is terminated. It will
    // be rejected when there is some fault is detected with the session after it
    // has been accepted.
    this.terminatedPromise = new Promise((resolve, reject) => {
      this.session.once('terminated', (message, cause) => {
        this.emit('terminated', this);
        this.status = SessionStatus.TERMINATED;
        this.emit('statusUpdate', this.status);

        // Asterisk specific header that signals that the VoIP account used is not
        // configured for WebRTC.
        if (cause === 'BYE' && message.getHeader('X-Asterisk-Hangupcausecode') === '58') {
          reject(new Error('MisconfiguredAccount'));
        } else {
          resolve();
        }
      });
    });

    // Track if the other side said bye before terminating.
    this.saidBye = false;
    this.session.once('bye', () => {
      this.saidBye = true;
    });

    this.holdState = false;

    // Session stats will calculate a MOS value of the inbound channel every 5
    // seconds.
    // TODO: make this setting configurable.
    this.stats = new SessionStats(this.session, {
      statsInterval: 5 * Time.second
    });
    this.stats.on('statsUpdated', () => {
      this.emit('callQualityUpdate', this.stats);
    });

    // Promise that will resolve when the session's audio is connected.
    // TODO: make these settings configurable.
    this.audioConnected = checkAudioConnected(this.session, {
      checkInterval: 0.5 * Time.second,
      noAudioTimeout: 10 * Time.second
    });
  }

  get remoteIdentity(): IRemoteIdentity {
    const request = this.session.request;
    let identity: NameAddrHeader;
    ['P-Asserted-Identity', 'Remote-Party-Id', 'From'].some(header => {
      if (request.hasHeader(header)) {
        identity = Grammar.nameAddrHeaderParse(request.getHeader(header));
        return true;
      }
    });

    let phoneNumber = this.session.remoteIdentity.uri.user;
    let displayName: string;

    if (identity) {
      phoneNumber = (identity.uri as any).normal.user;
      displayName = identity.displayName;
    }

    return { phoneNumber, displayName };
  }

  get autoAnswer(): boolean {
    const callInfo = this.session.request.headers['Call-Info'];

    if (callInfo && callInfo[0]) {
      const rawString = callInfo[0].raw;
      return rawString.includes('answer-after=0');
    }

    return false;
  }

  public accept(options: any = {}): Promise<void> {
    if (this.rejectPromise) {
      throw new Error('invalid operation: session is rejected');
    }

    if (this.acceptPromise) {
      return this.acceptPromise;
    }

    this.acceptPromise = new Promise((resolve, reject) => {
      const handlers = {
        onAnswered: () => {
          this.session.removeListener('failed', handlers.onFail);
          resolve();
        },
        onFail: (e: Error) => {
          this.session.removeListener('accepted', handlers.onAnswered);
          reject(e);
        }
      };
      this.session.once('accepted', handlers.onAnswered);
      this.session.once('failed', handlers.onFail);

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

  public async reinvite(): Promise<void> {
    const reinvitePromise = this.getReinvitePromise();

    this.session.reinvite();

    await reinvitePromise;
  }

  public hold(): Promise<boolean> {
    return this.setHoldState(true);
  }

  public unhold(): Promise<boolean> {
    return this.setHoldState(false);
  }

  public async blindTransfer(target: string): Promise<boolean> {
    return this.transfer(target);
  }

  public async attendedTransfer(target: Session): Promise<boolean> {
    return this.transfer(target.session);
  }

  /**
   * Reconfigure the WebRTC peerconnection.
   */
  public rebuildSessionDescriptionHandler() {
    this.session.rebuildSessionDescriptionHandler();
  }

  /**
   * Function this.session.bye triggers terminated, so nothing else has to be
   * done here.
   */
  public bye() {
    this.session.bye();
  }

  /**
   * Send one or more DTMF tones.
   * @param tones May only contain the characters `0-9A-D#*,`
   */
  public dtmf(tones: string): void {
    // Unfortunately there is no easy way to give feedback about the DTMF
    // tones. SIP.js uses one of two methods for sending the DTMF:
    //
    // 1. RTP (via the SDH)
    // Internally returns a `boolean` for the whole strong.
    //
    // 2. INFO (websocket)
    //
    // Sends one tone after the other where the timeout is determined by the kind
    // of tone send. If one tone fails, the entire sequence is cleared. There is
    // no feedback about the failure.
    this.session.dtmf(tones);
  }

  private getReinvitePromise(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const handlers = {
        onReinviteAccepted: () => {
          this.session.removeListener('reinviteFailed', handlers.onReinviteFailed);
          // Calling resolve after removeListener, otherwise, when it fails,
          // the resolved promise can not be rejected with an error trace
          // anymore.
          resolve(true);
        },
        onReinviteFailed: (e: Error) => {
          this.session.removeListener('reinviteAccepted', handlers.onReinviteAccepted);
          // Calling reject after removeListener, otherwise, when it fails,
          // reject returns the wrong trace.
          reject(e);
        }
      };

      this.session.once('reinviteAccepted', handlers.onReinviteAccepted);
      this.session.once('reinviteFailed', handlers.onReinviteFailed);
    });
  }

  private setHoldState(flag: boolean) {
    if (this.holdState === flag) {
      return this.reinvitePromise;
    }

    this.reinvitePromise = this.getReinvitePromise();

    if (flag) {
      log.debug('Hold requested', this.constructor.name);
      this.session.hold();
    } else {
      log.debug('Unhold requested', this.constructor.name);
      this.session.unhold();
    }

    this.holdState = flag;
    this.status = flag ? SessionStatus.ON_HOLD : SessionStatus.ACTIVE;
    this.emit('statusUpdate', this);

    return this.reinvitePromise;
  }

  // In the case of a BLIND transfer, a string can be passed along with a
  // number.
  // In the case of an ATTENDED transfer, a NEW call(/session) should be
  // made. This NEW session (a.k.a. InviteClientContext/InviteServerContext
  // depending on whether it is outbound or inbound) should then be passed
  // to this function.
  private async transfer(target: InternalSession | string): Promise<boolean> {
    return pTimeout(this.isTransferredPromise(target), 20000, () => {
      log.error('Could not transfer the call', this.constructor.name);
      return Promise.resolve(false);
    });
  }

  private async isTransferredPromise(target: InternalSession | string) {
    const { referContext, options } = await new Promise(resolve => {
      this.session.once('referRequested', context => {
        log.debug('Refer is requested', this.constructor.name);
        resolve(context);
      });

      this.session.refer(target);
    });

    return new Promise<boolean>(resolve => {
      const handlers = {
        onReferAccepted: () => {
          log.debug('Refer is accepted', this.constructor.name);
          referContext.removeListener('referRejected', handlers.onReferRejected);
          resolve(true);
        },
        // Refer can be rejected with the following responses:
        // - 503: Service Unavailable (i.e. server can't handle one-legged transfers)
        // - 603: Declined
        onReferRejected: () => {
          log.debug('Refer is rejected', this.constructor.name);
          referContext.removeListener('referAccepted', handlers.onReferAccepted);
          resolve(false);
        }
      };

      referContext.once('referAccepted', handlers.onReferAccepted);
      referContext.once('referRejected', handlers.onReferRejected);

      // Refer after the handlers have been set.
      referContext.refer(options);
    });
  }
}
