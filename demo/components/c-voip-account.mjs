import * as CONF from '../config.mjs';
import * as sipClient from '../lib/calling.mjs';
import { setOndevicesChanged, setInputsAndOutputs } from '../lib/media.mjs';
import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import { updateDndPublisher, removeDndPublisher } from '../lib/dndPublisher.mjs';

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
          {
            const {
              target: { dataset },
            } = e;

            if (dataset.action) {
              switch (dataset.action) {
                case 'register':
                  {
                    const userId = this.nodes.userIdInput.value;
                    const password = this.nodes.passwordInput.value;
                    const websocketUrl = this.nodes.websocketUrlInput.value;
                    const realm = this.nodes.realmInput.value;
                    sipClient.setAccount(userId, password, realm);
                    sipClient.setTransport(websocketUrl);
                    sipClient.setClient();
                    setOndevicesChanged();
                    setInputsAndOutputs();
                    sipClient.registerAccount();
                    console.log('register');
                  }
                  break;
                case 'unregister':
                  sipClient.unregisterAccount();
                  console.log('unregister');
                  break;
                case 'reconfigure':
                  sipClient.reconfigure();
                  console.log('reconfigure');
                  break;
              }
            }
          }
          break;

        case 'clientStatusUpdate':
          {
            const {
              detail: { status },
            } = e;
            this.nodes.clientStatus.textContent = status;
            if (status === 'connected') {
              updateDndPublisher(
                sipClient,
                this.nodes.userIdInput.value,
                this.actions.dndToggle.checked
              );
            }
          }
          break;

        case 'change':
          localStorage.setItem(
            `dndEnabled+${this.nodes.userIdInput.value}`,
            this.actions.dndToggle.checked
          );
          updateDndPublisher(
            sipClient,
            this.nodes.userIdInput.value,
            this.actions.dndToggle.checked
          );
          break;

        default:
          console.log(e);
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-voip-account]');
      this.appendChild(template.content.cloneNode(true));

      [this.actions.register, this.actions.unregister, this.actions.reconfigure].forEach((n) => {
        n.addEventListener('click', this);
      });

      // some cleanup necessary
      removeDndPublisher();

      this.actions.dndToggle.addEventListener('change', this);

      const dndEnabled =
        localStorage.getItem(`dndEnabled+${this.nodes.userIdInput.value}`) === 'true';

      if (dndEnabled) {
        this.actions.dndToggle.setAttribute('checked', '');
      }

      this.nodes.passwordInput.value = CONF.password;
      this.nodes.userIdInput.value = CONF.authorizationUserId;
      this.nodes.realmInput.value = CONF.realm;
      this.nodes.websocketUrlInput.value = CONF.websocketUrl;

      sipClient.callingEvents.addEventListener('clientStatusUpdate', this);
    }

    disconnectedCallback() {
      [this.actions.register, this.actions.unregister, this.actions.reconfigure].forEach((n) => {
        n.removeEventListener('click', this);
      });

      this.actions.dndToggle.removeEventListener('change', this);

      sipClient.callingEvents.removeEventListener('clientStatusUpdate', this);
    }
  }
);
