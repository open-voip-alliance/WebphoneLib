import { playSound } from '../lib/media.mjs';

window.customElements.define(
  'c-keypad',
  class extends HTMLElement {
    handleEvent({ target: { dataset } }) {
      if (dataset && dataset.key) {
        playSound();
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-keypad]');
      this.appendChild(template.content.cloneNode(true));

      this.addEventListener('click', this);
      this.dialerKeypadButtons = this.querySelector('[data-selector=dialer-keypad-buttons]');
    }

    disconnectedCallback() {
      this.removeEventListener('click', this);
    }
  }
);
