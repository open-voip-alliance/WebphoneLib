import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import * as sipClient from '../lib/calling.mjs';

window.customElements.define(
  'c-mos-values',
  class extends HTMLElement {
    constructor() {
      super();

      this.nodes = new NodesProxy(this);
    }

    handleEvent({ detail }) {
      this.nodes.mosValues.removeAttribute('hidden');

      const { stats } = detail;

      const last = (stats.last || 0).toFixed(2);
      const low = (stats.lowest || 0).toFixed(2);
      const high = (stats.highest || 0).toFixed(2);
      const avg = (stats.average || 0).toFixed(2);

      this.nodes.lowest.innerText = `Low: ${low}`;
      this.nodes.highest.innerText = `High: ${high}`;
      this.nodes.average.innerText = `Average:  ${avg}`;
      this.nodes.last.innerText = `Last:  ${last}`;
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-mos-values]');
      this.appendChild(template.content.cloneNode(true));

      sipClient.callingEvents.addEventListener('changeMosValues', this);
    }

    disconnectedCallback() {
      sipClient.callingEvents.removeEventListener('changeMosValues', this);
    }
  }
);
