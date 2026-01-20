import * as sipClient from '../lib/calling.mjs';
import { empty } from '../lib/dom.mjs';
import { Logger } from '../lib/logging.mjs';
import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import './c-transfer.mjs';

const logger = new Logger('c-session');

function handleSessionStatusUpdate({ status }) {
  this.status = status;
}

window.customElements.define(
  'c-session',
  class extends HTMLElement {
    static get observedAttributes() {
      return ['session-id'];
    }

    set status(_status) {
      this._status = _status;
      this.className = `status-${_status}`;

      this.nodes.sessionStatus.textContent = _status;
    }

    get status() {
      return this._status;
    }

    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);
    }

    async handleEvent(e) {
      const {
        target: { dataset }
      } = e;

      if (dataset.action) {
        logger.info(`Clicked ${dataset.action}`);

        switch (dataset.action) {
          case 'accept':
            this.session && (await this.session.accept());
            break;
          case 'reject':
            this.session && (await this.session.reject());
            break;
          case 'cancel':
            if (this.session) {
              // Cancel can only be used on outgoing calls in early states (trying/ringing)
              // Once established, use terminate() instead
              if (this.session.isIncoming) {
                logger.warn('Cannot cancel an incoming call. Use reject instead.');
              } else if (this.session.status === 'active' || this.session.status === 'on_hold') {
                logger.warn('Cannot cancel an established call. Using terminate instead.');
                await this.session.terminate();
              } else {
                try {
                  await this.session.cancel();
                } catch (error) {
                  logger.warn(`Failed to cancel: ${error.message}. Using terminate instead.`);
                  await this.session.terminate();
                }
              }
            }
            break;
          case 'toggleTransfer':
            if (!this.querySelectorAll('c-transfer').length > 0) {
              const transfer = document.createElement('c-transfer');
              transfer.setAttribute('session-id', this.session.id);
              this.appendChild(transfer);

              this.session.hold();
            } else {
              empty(this.nodes.additionalInterface);
            }
            break;
          case 'toggleDTMF':
            if (!this.querySelectorAll('c-keypad').length > 0) {
              const node = document.createElement('c-keypad');
              node.setAttribute('session-id', this.session.id);
              this.nodes.additionalInterface.appendChild(node);
            } else {
              empty(this.nodes.additionalInterface);
            }
            break;
          case 'hold':
            this.setMute(true);
            this.session && this.session.hold();
            break;
          case 'unhold':
            this.setMute(false);
            this.session && this.session.unhold();
            break;
          case 'toggleMute':
            this.toggleMute();
            break;
          case 'hangup':
            this.session && (await this.session.terminate());
            break;
          default:
            break;
        }
      } else if (dataset.key) {
        logger.info(`Pressed: ${dataset.key}`);
        if (this.session && this.session.status === 'active') {
          try {
            this.session.dtmf(dataset.key);
          } catch (error) {
            logger.warn(`Failed to send DTMF: ${error.message}`);
          }
        } else {
          const sessionStatus =
            this.session && this.session.status ? this.session.status : 'undefined';
          logger.warn(`Cannot send DTMF: session is not active (status: ${sessionStatus})`);
        }
      }
    }

    toggleMute() {
      if (this.session) {
        this.session.media.input.muted = !this.session.media.input.muted;
      }
    }

    setMute(mute) {
      this.session.media.input.muted = mute;
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-session]');
      this.appendChild(template.content.cloneNode(true));

      this.nodes.phoneNumber.innerText = this.session.phoneNumber;
      this.nodes.sessionDirection.innerText = this.session.isIncoming
        ? 'incoming call'
        : 'outgoing call';

      [
        this.actions.accept,
        this.actions.reject,
        this.actions.cancel,
        this.actions.toggleTransfer,
        this.actions.toggleDTMF,
        this.actions.hold,
        this.actions.unhold,
        this.actions.hangup,
        this.nodes.additionalInterface
      ].forEach(n => {
        n.addEventListener('click', this);
      });

      this.session.on('statusUpdate', handleSessionStatusUpdate.bind(this));
    }

    disconnectedCallback() {
      [
        this.actions.accept,
        this.actions.reject,
        this.actions.cancel,
        this.actions.toggleTransfer,
        this.actions.toggleDTMF,
        this.actions.hold,
        this.actions.unhold,
        this.actions.hangup,
        this.nodes.additionalInterface
      ].forEach(n => {
        n.removeEventListener('click', this);
      });
      this.session.removeListener('statusUpdate', handleSessionStatusUpdate.bind(this));
    }

    attributeChangedCallback(name, oldValue, newValue) {
      this.session = sipClient.getSession(newValue);
    }
  }
);
