import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import { subscribeTo } from '../config.mjs';
import * as sipClient from '../lib/calling.mjs';
import { Logger } from '../lib/logging.mjs';

const logger = new Logger('c-contacts');

// subscribe button with an input field (remembering a few number)
// for the contact to subscribe to
// A subscriptions list, listing the subscriptions you have
// when you click on the subscription be able to unsubscribe
window.customElements.define(
  'c-contacts',
  class extends HTMLElement {
    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);
    }

    async handleEvent(e) {
      e.preventDefault();

      switch (e.type) {
        case 'click':
          const {
            target: { dataset }
          } = e;

          if (dataset.action) {
            const accountId = this.nodes.input.value;
            switch (dataset.action) {
              case 'subscribe':
                logger.info(`Subscribing to ${accountId}`);

                await sipClient.subscribe(this.nodes.input.value);

                const contactNode = document.createElement('c-contact');
                contactNode.data = { contactUri: this.nodes.input.value };
                this.nodes.contactsList.appendChild(contactNode);
                break;
              case 'unsubscribe':
                logger.info(`Unsubscribing from ${accountId}`);
                sipClient.unsubscribe(accountId);
                break;
              default:
                break;
            }
          }
          break;
        default:
          break;
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-contacts]');
      this.appendChild(template.content.cloneNode(true));

      this.actions.subscribe.addEventListener('click', this);
      this.actions.unsubscribe.addEventListener('click', this);

      // Adding a first value from config to make it easier to debug subscribing.
      this.nodes.input.value = subscribeTo;
    }

    disconnectedCallback() {
      this.actions.subscribe.removeEventListener('click', this);
      this.actions.unsubscribe.removeEventListener('click', this);
    }
  }
);
