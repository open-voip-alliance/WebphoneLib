import { Invitation as SIPInvitation } from 'sip.js/lib/api/invitation';
import { ISessionAccept, SessionImpl } from './session';

export class Invitation extends SessionImpl {
  protected session: SIPInvitation;
  private acceptedRef: any;

  constructor(options) {
    super(options);

    this.acceptedPromise = new Promise(resolve => {
      this.acceptedRef = resolve;
    });
  }

  public accept(): Promise<void> {
    return (this.session as SIPInvitation)
      .accept()
      .then(() => this.acceptedRef({ accepted: true }));
  }

  public accepted(): Promise<ISessionAccept> {
    return this.acceptedPromise;
  }

  public reject(): Promise<void> {
    return this.session.reject().then(() => this.acceptedRef({ accepted: false }));
  }
}
