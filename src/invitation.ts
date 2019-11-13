import { ISessionAccept, SessionImpl } from './session';

export class Invitation extends SessionImpl {
  private acceptedRef: any;

  constructor(options) {
    super(options);

    this.acceptedPromise = new Promise(resolve => {
      this.acceptedRef = resolve;
    });
  }

  public accept(): Promise<void> {
    return (this.session as any).accept().then(this.acceptedRef);
  }

  public accepted(): Promise<ISessionAccept> {
    return this.acceptedPromise;
  }
}
