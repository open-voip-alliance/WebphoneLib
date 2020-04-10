import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import * as sipClient from '../lib/calling.mjs';
import { Logger } from '../lib/logging.mjs';

const logger = new Logger('c-transfer');

export async function attendedTransfer(session, number) {
  // Holding the first session
  session.hold();

  const toSession = await sipClient.invite(number);

  sipClient.sessionAccepted(toSession).then(() => {
    logger.info('Second session got accepted, waiting 3 seconds before transferring.');
    window.setTimeout(() => {
      sipClient.attendedTransfer(session, toSession);
    }, 3000); // Waiting 3 seconds before transferring.
  });

  sipClient.sessionRejected(toSession).then(({ rejectCause }) => {
    logger.info('Second session was rejected ');
  });
}

window.customElements.define(
  'c-transfer',
  class extends HTMLElement {
    static get observedAttributes() {
      return ['session-id'];
    }

    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);
    }

    handleEvent(e) {
      const { type, currentTarget } = e;
      switch (type) {
        case 'attendedTransferStatusUpdated':
          const { detail } = e;
          this.transferToSession = detail.b;
          break;
        case 'change':
          switch (currentTarget) {
            case this.nodes.input:
              break;
            case this.nodes.selectTransferMethod:
              this.transferMethod = this.nodes.selectTransferMethod.value;
              break;
            default:
              break;
          }
          break;
        case 'click':
          switch (currentTarget) {
            case this.actions.transferCall:
              this.transferCall();
              break;
            default:
              break;
          }
          break;
        default:
          break;
      }
    }

    transferCall(value = this.nodes.input.value) {
      if (!value) {
        return;
      }
      const number = value;

      switch (this.transferMethod) {
        case 'attended':
          // Note: will initiate an invite and will do an attended transfer after that invite is accepted.
          attendedTransfer(this.session, number);
          break;
        case 'blind':
          sipClient.blindTransfer(this.session, number);
          break;
        default:
          break;
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-transfer]');
      this.appendChild(template.content.cloneNode(true));

      this.nodes.selectTransferMethod.addEventListener('change', this);
      this.nodes.input.addEventListener('change', this);

      this.actions.transferCall.addEventListener('click', this);

      sipClient.callingEvents.addEventListener('attendedTransferStatusUpdated', this);

      this.transferMethod = this.nodes.selectTransferMethod.value;
    }

    disconnectedCallback() {
      this.nodes.selectTransferMethod.removeEventListener('change', this);
      this.nodes.input.removeEventListener('change', this);

      this.actions.transferCall.removeEventListener('click', this);

      sipClient.callingEvents.removeEventListener('attendedTransferStatusUpdated', this);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      this.session = sipClient.getSession(newValue);
    }
  }
);
