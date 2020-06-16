import { Core } from 'sip.js';
import { Inviter as SIPInviter } from 'sip.js/lib/api/inviter';

import { SessionStatus } from './enums';
import { ISessionAccept, SessionImpl } from './session';

export class Inviter extends SessionImpl {
  protected session: SIPInviter;
  private progressedPromise: Promise<void>;
  private triedPromise: Promise<void>;

  constructor(options) {
    super(options);

    this.triedPromise = new Promise(tryingResolve => {
      this.progressedPromise = new Promise(progressResolve => {
        this.acceptedPromise = new Promise((acceptedResolve, acceptedReject) => {
          this.inviteOptions = this.makeInviteOptions({
            onAccept: acceptedResolve,
            onReject: acceptedResolve,
            onRejectThrow: acceptedReject,
            onProgress: progressResolve,
            onTrying: tryingResolve
          });
        });
      });
    });
  }

  public progressed(): Promise<void> {
    return this.progressedPromise;
  }

  public tried(): Promise<void> {
    return this.triedPromise;
  }

  public accepted(): Promise<ISessionAccept> {
    return this.acceptedPromise;
  }

  public invite(): Promise<Core.OutgoingInviteRequest> {
    return this.session.invite(this.inviteOptions).then((request: Core.OutgoingInviteRequest) => {
      this.status = SessionStatus.RINGING;
      this.emit('statusUpdate', { id: this.id, status: this.status });
      return request;
    });
  }

  public async accept(): Promise<void> {
    throw new Error('Cannot accept an outgoing call.');
  }

  public async reject(): Promise<void> {
    throw new Error('Cannot reject an outgoing call.');
  }

  public cancel(): Promise<void> {
    return this.session.cancel();
  }
}
