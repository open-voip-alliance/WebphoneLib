import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import { loggingEvents } from '../lib/logging.mjs';
import './c-console-message.mjs';

window.customElements.define(
  'c-debug-console',
  class extends HTMLElement {
    constructor() {
      super();
      this.nodes = new NodesProxy(this);
    }

    handleEvent(e) {
      e.preventDefault();
      const message = document.createElement('c-console-message');
      message.message = e.detail.message;
      message.level = e.detail.level;
      message.module = e.detail.module;
      this.nodes.outputWindow.appendChild(message);
      this.updateScroll();
    }

    updateScroll() {
      this.nodes.outputWindow.scrollTop = this.nodes.outputWindow.scrollHeight;
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-debug-console]');
      this.appendChild(template.content.cloneNode(true));
      loggingEvents.addEventListener('log_to_console', this);
    }

    disconnectedCallback() {
      loggingEvents.removeEventListener('log_to_console', this);
    }
  }
);
