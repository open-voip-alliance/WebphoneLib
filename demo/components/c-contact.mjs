import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import { subscriptionEvents, subscriptions } from '../lib/calling.mjs';
import { Logger } from '../lib/logging.mjs';

const logger = new Logger('c-contact');

window.customElements.define(
  'c-contact',
  class extends HTMLElement {
    set data(data) {
      this._data = data;
    }

    get data() {
      return this._data;
    }

    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);
    }

    async handleEvent({ type, detail, currentTarget }) {
      switch (type) {
        case `notify-${this.data.contactUri}`:
          this.nodes.contactStatus.textContent = detail.status;
          this.populate();
          break;
        case `remove-${this.data.contactUri}`:
          this.remove();
          break;
        default:
          break;
      }
    }

    populate() {
      if (this.data) {
        const { contactUri } = this.data;
        this.nodes.contactUri.textContent = contactUri;
        this.nodes.contactStatus.textContent = subscriptions[contactUri];
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-contact]');
      this.appendChild(template.content.cloneNode(true));
      this.populate();

      subscriptionEvents.addEventListener(`notify-${this.data.contactUri}`, this);
      subscriptionEvents.addEventListener(`remove-${this.data.contactUri}`, this);
    }

    disconnectedCallback() {
      subscriptionEvents.removeEventListener(`notify-${this.data.contactUri}`, this);
      subscriptionEvents.removeEventListener(`remove-${this.data.contactUri}`, this);
    }
  }
);
