import { Core } from 'sip.js';
import { Inviter as SIPInviter } from 'sip.js/lib/api/inviter';

import { ISessionAccept, SessionImpl } from './session';

export class Inviter extends SessionImpl {
  protected session: SIPInviter;
  private progressedPromise: Promise<void>;

  constructor(options) {
    super(options);

    this.progressedPromise = new Promise(progressResolve => {
      this.acceptedPromise = new Promise((acceptedResolve, acceptedReject) => {
        this.inviteOptions = this.makeInviteOptions({
          onAccept: acceptedResolve,
          onReject: acceptedResolve,
          onRejectThrow: acceptedReject,
          onProgress: progressResolve
        });
      });
    });
  }

  public progressed(): Promise<void> {
    return this.progressedPromise;
  }

  public accepted(): Promise<ISessionAccept> {
    return this.acceptedPromise;
  }

  public invite(): Promise<Core.OutgoingInviteRequest> {
    return this.session.invite(this.inviteOptions);
  }

  public async accept() {
    throw new Error('Cannot accept an outgoing call.');
  }

  public async reject() {
    throw new Error('Cannot reject an outgoing call.');
  }
}
