import * as CONF from '../config.mjs';
import * as sipClient from '../lib/calling.mjs';
import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';

window.customElements.define(
  'c-voip-account',
  class extends HTMLElement {
    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);
    }

    handleEvent(e) {
      e.preventDefault();

      switch (e.type) {
        case 'click':
          const {
            target: { dataset }
          } = e;

          if (dataset.action) {
            switch (dataset.action) {
              case 'register':
                const userId = this.nodes.userIdInput.value;
                const password = this.nodes.passwordInput.value;
                sipClient.setAccount(userId, password);
                sipClient.setClient();
                sipClient.registerAccount();
                console.log('register');
                break;
              case 'unregister':
                sipClient.unregisterAccount();
                console.log('unregister');
                break;
              case 'reconfigure':
                sipClient.reconfigure();
                console.log('reconfigure');
                break;
              default:
                break;
            }
          }
          break;
        case 'clientStatusUpdate':
          const {
            detail: { status }
          } = e;
          this.nodes.clientStatus.textContent = status;
          break;
        default:
          console.log(e);
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-voip-account]');
      this.appendChild(template.content.cloneNode(true));

      [this.actions.register, this.actions.unregister, this.actions.reconfigure].forEach(n => {
        n.addEventListener('click', this);
      });

      this.nodes.passwordInput.value = CONF.password;
      this.nodes.userIdInput.value = CONF.authorizationUserId;

      sipClient.callingEvents.addEventListener('clientStatusUpdate', this);
    }

    disconnectedCallback() {
      [this.actions.register, this.actions.unregister, this.actions.reconfigure].forEach(n => {
        n.removeEventListener('click', this);
      });
      sipClient.callingEvents.removeEventListener('clientStatusUpdate', this);
    }
  }
);
