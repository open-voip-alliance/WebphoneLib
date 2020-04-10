import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import * as sipClient from '../lib/media.mjs';

window.customElements.define(
  'c-devices-setting',
  class extends HTMLElement {
    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);
    }

    handleEvent({ type, currentTarget }) {
      switch (type) {
        case 'change':
          switch (currentTarget) {
            case this.nodes.inputSelect:
              sipClient.changeInputSelect(currentTarget);
              break;
            case this.nodes.outputSelect:
              sipClient.changeOutputSelect(currentTarget);
              break;
            default:
              break;
          }
          break;
        case 'click':
          sipClient.playSound();
          break;
        default:
          break;
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-devices-setting]');
      this.appendChild(template.content.cloneNode(true));

      [this.nodes.inputSelect, this.nodes.outputSelect].forEach(n => {
        n.addEventListener('change', this);
      });
      this.nodes.play.addEventListener('click', this);
    }

    disconnectedCallback() {
      [this.nodes.inputSelect, this.nodes.outputSelect].forEach(n => {
        n.removeEventListener('change', this);
      });
      this.nodes.play.removeEventListener('click', this);
    }
  }
);
