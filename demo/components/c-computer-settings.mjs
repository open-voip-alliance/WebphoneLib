// input volume
// output volume
// devices -> input (list), output (list)
// Input devices connected list
// Output devices connected list
// Test output
// MOS value here????

import './c-volume-setting.mjs';
import './c-devices-setting.mjs';


import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';

window.customElements.define('c-computer-settings',
class extends HTMLElement {
  constructor() {
    super();
    
    this.actions = new ActionsProxy(this);
    this.nodes = new NodesProxy(this);
  }

  
  connectedCallback() {
    const template = document.querySelector('[data-component=c-computer-settings]');
    this.appendChild(template.content.cloneNode(true));
  }
});
