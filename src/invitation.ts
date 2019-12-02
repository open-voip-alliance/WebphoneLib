import { Invitation as SIPInvitation } from 'sip.js/lib/api/invitation';
import { SessionStatus } from './enums';
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
    return (this.session as SIPInvitation).accept().then(() => {
      this.status = SessionStatus.ACTIVE;
      this.emit('statusUpdate', { id: this.id, status: this.status });
      this.acceptedRef({ accepted: true });
    });
  }

  public accepted(): Promise<ISessionAccept> {
    return this.acceptedPromise;
  }

  public reject(): Promise<void> {
    return this.session.reject().then(() => this.acceptedRef({ accepted: false }));
  }
}
