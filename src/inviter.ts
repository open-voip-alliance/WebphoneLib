import { Core } from 'sip.js';

import { ISessionAccept, SessionImpl } from './session';

export class Inviter extends SessionImpl {
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
}
