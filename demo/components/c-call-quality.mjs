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
      empty(this.nodes.callQualityList);

      let mosValuesNode;
      detail.stats.forEach(stats => {
        mosValuesNode = document.createElement('c-mos-values');
        mosValuesNode.data = stats;
        this.nodes.callQualityList.appendChild(mosValuesNode);
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
