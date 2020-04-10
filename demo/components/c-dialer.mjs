import './c-keypad.mjs';
import './c-session.mjs';
import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import * as sipClient from '../lib/calling.mjs';

window.customElements.define(
  'c-dialer',
  class extends HTMLElement {
    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);

      this._sessions = [];
    }

    handleEvent({ currentTarget, target }) {
      switch (currentTarget) {
        case this.nodes.keypad:
          this.nodes.input.value += target.dataset.key;
          break;
        case this.actions.call:
          const { value } = this.nodes.input;
          sipClient.invite(value);
          break;
        default:
          break;
      }
    }

    handleInputKeyDownEvent(e) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          const { value } = this.nodes.input;
          sipClient.invite(value);
          break;
        default:
          break;
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-dialer]');
      this.appendChild(template.content.cloneNode(true));

      this.sessions = sipClient.getSessions();

      this.nodes.keypad.addEventListener('click', this);
      this.nodes.input.addEventListener('keydown', this.handleInputKeyDownEvent.bind(this), true);

      this.actions.call.addEventListener('click', this);

      sipClient.callingEvents.addEventListener('sessionsUpdated', this);
    }

    disconnectedCallback() {
      this.nodes.keypad.removeEventListener('click', this);
      this.nodes.input.removeEventListener(
        'keydown',
        this.handleInputKeyDownEvent.bind(this),
        true
      );

      this.actions.call.removeEventListener('click', this);

      sipClient.callingEvents.removeEventListener('sessionsUpdated', this);
    }
  }
);
