import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';

window.customElements.define(
  'c-audio-visualiser',
  class extends HTMLElement {
    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-audio-visualiser]');
      this.appendChild(template.content.cloneNode(true));
    }
  }
);
