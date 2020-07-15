import * as sipClient from '../lib/calling.mjs';

import { empty } from '../utils/dom.mjs';
import { NodesProxy } from '../utils/elementProxies.mjs';

window.customElements.define(
  'c-call-quality',
  class extends HTMLElement {
    constructor() {
      super();

      this.nodes = new NodesProxy(this);
    }

    handleEvent({ detail }) {
      empty(this.nodes.callQualityTableBody);

      detail.stats.forEach(({ config, mos }) => {
        const row = this.nodes.callQualityTableBody.insertRow();
        row.insertCell().appendChild(document.createTextNode(config));
        ['average', 'lowest', 'highest', 'last', 'rollingAverage'].forEach(name => {
          row.insertCell().appendChild(document.createTextNode((mos[name] || 0).toFixed(2)));
        });
      });
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-call-quality]');
      this.appendChild(template.content.cloneNode(true));

      sipClient.callingEvents.addEventListener('callQualityUpdate', this);
    }

    disconnectedCallback() {
      sipClient.callingEvents.removeEventListener('callQualityUpdate', this);
    }
  }
);
