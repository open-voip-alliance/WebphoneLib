import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import * as sipClient from '../lib/media.mjs';

window.customElements.define(
  'c-volume-setting',
  class extends HTMLElement {
    constructor() {
      super();

      this.nodes = new NodesProxy(this);
    }

    handleVolumeChange({ currentTarget }) {
      const { value } = currentTarget;
      switch (currentTarget) {
        case this.nodes.inVol:
          sipClient.changeInputVolume(value);
          break;
        case this.nodes.outVol:
          sipClient.changeOutputVolume(value);
          break;
        default:
          break;
      }
    }

    handleMuteChange({ currentTarget }) {
      const { checked } = currentTarget;
      switch (currentTarget) {
        case this.nodes.inMute:
          sipClient.changeInputMuted(checked);
          break;
        case this.nodes.outMute:
          sipClient.changeOutputMuted(checked);
          break;
        default:
          break;
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-volume-setting]');
      this.appendChild(template.content.cloneNode(true));

      [this.nodes.inVol, this.nodes.outVol].forEach(n => {
        n.addEventListener('change', this.handleVolumeChange.bind(this));
      });
      [this.nodes.inMute, this.nodes.outMute].forEach(n => {
        n.addEventListener('change', this.handleMuteChange.bind(this));
      });
    }

    disconnectedCallback() {
      [this.nodes.inVol, this.nodes.inMute, this.nodes.outVol, this.nodes.outMute].forEach(n => {
        n.removeEventListener('change', this);
      });
    }
  }
);
