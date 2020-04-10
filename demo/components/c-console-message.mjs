import { NodesProxy } from '../utils/elementProxies.mjs';
import styleConsoleMessage from '../utils/styleConsoleMessage.mjs';

window.customElements.define(
  'c-console-message',
  class extends HTMLElement {
    set message(message) {
      this._message = message;
    }

    set level(level) {
      this._level = level;
    }

    set module(module) {
      this._module = module;
    }

    constructor() {
      super();
      this.nodes = new NodesProxy(this);
    }

    onErrorMessage(errorMessage) {
      this.nodes.messageBox.innerText = errorMessage + '\n' + errorMessage.stack;
    }

    connectedCallback() {
      const styles = styleConsoleMessage(this._level);
      const template = document.querySelector('[data-component=c-console-message]');
      this.appendChild(template.content.cloneNode(true));
      this.nodes.moduleBox.innerText = this._module;
      this.nodes.moduleBox.style = styles.join(';');

      if (this._level === 'error') {
        this.onErrorMessage(this._message);
      } else {
        this.nodes.messageBox.innerText = this._message;
      }
    }
  }
);
