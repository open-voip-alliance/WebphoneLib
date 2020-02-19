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

    this.cancelled = options.cancelled;

    this.status = SessionStatus.RINGING;
    this.emit('statusUpdate', { id: this.id, status: this.status });
  }

  public accept(): Promise<void> {
    return (this.session as SIPInvitation).accept().then(() => {
      this.status = SessionStatus.ACTIVE;
      this.emit('statusUpdate', { id: this.id, status: this.status });
      this.acceptedRef({ accepted: true });

      this.session.delegate = {
        onInvite: request => {
          this._remoteIdentity = this.extractRemoteIdentity();
          this.emit('remoteIdentityUpdate', this, this.remoteIdentity);
        }
      };
    });
  }

  public accepted(): Promise<ISessionAccept> {
    return this.acceptedPromise;
  }

  public reject(): Promise<void> {
    return this.session.reject().then(() => this.acceptedRef({ accepted: false }));
  }

  public async tried() {
    throw new Error('Not applicable for incoming calls.');
  }

  public async cancel() {
    throw new Error('Cannot cancel an incoming call.');
  }
}
