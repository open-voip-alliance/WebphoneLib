import { NodesProxy } from '../utils/elementProxies.mjs';

window.customElements.define(
  'c-mos-values',
  class extends HTMLElement {
    set data(data) {
      this._data = data;
    }

    get data() {
      return this._data;
    }

    constructor() {
      super();

      this.nodes = new NodesProxy(this);
    }
    connectedCallback() {
      const template = document.querySelector('[data-component=c-mos-values]');
      this.appendChild(template.content.cloneNode(true));

      this.populate();
    }

    populate() {
      if (this.isConnected) {
        const { config, mos } = this.data;
        const last = (mos.last || 0).toFixed(2);
        const low = (mos.lowest || 0).toFixed(2);
        const high = (mos.highest || 0).toFixed(2);
        const avg = (mos.average || 0).toFixed(2);

        this.nodes.config.innerText = config;
        this.nodes.lowest.innerText = `Low: ${low}`;
        this.nodes.highest.innerText = `High: ${high}`;
        this.nodes.average.innerText = `Average:  ${avg}`;
        this.nodes.last.innerText = `Last:  ${last}`;
      }
    }

    disconnectedCallback() {}
  }
);
