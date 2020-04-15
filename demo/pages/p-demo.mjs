import '../components/c-voip-account.mjs';
import '../components/c-contacts.mjs';
import '../components/c-contact.mjs';
import '../components/c-debug-console.mjs';
import '../components/c-computer-settings.mjs';
import '../components/c-dialer.mjs';
import '../components/c-publisher.mjs';
import '../components/c-sessions.mjs';
import '../components/c-mos-values.mjs';

window.customElements.define(
  'p-demo',
  class extends HTMLElement {
    connectedCallback() {
      const template = document.querySelector('[data-component=p-demo]');
      this.appendChild(template.content.cloneNode(true));
    }
  }
);
