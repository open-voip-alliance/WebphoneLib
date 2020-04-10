import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import * as sipClient from '../lib/calling.mjs';

window.customElements.define(
  'c-sessions',
  class extends HTMLElement {
    set sessions(sessions) {
      this._sessions = sessions;
      this.updateDOM();
    }

    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);
    }

    handleEvent(e) {
      this.sessions = sipClient.getSessions();
    }

    updateDOM() {
      if (this.isConnected) {
        const idsAlreadyAdded = [];
        // remove the ones that shouldn't be there.
        for (const node of this.querySelectorAll('c-session')) {
          const sessionId = node.getAttribute('session-id');
          if (!sipClient.getSession(sessionId)) {
            this.nodes.sessionsList.removeChild(node);
          } else {
            idsAlreadyAdded.push(sessionId);
          }
        }

        // add the ones that should be there.
        this._sessions.forEach(({ id }) => {
          if (idsAlreadyAdded.includes(id)) {
            return;
          }

          const node = document.createElement('c-session');
          node.setAttribute('session-id', id);
          this.nodes.sessionsList.appendChild(node);
        });
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-sessions]');
      this.appendChild(template.content.cloneNode(true));

      this.sessions = sipClient.getSessions();
      sipClient.callingEvents.addEventListener('sessionsUpdated', this);
    }

    disconnectedCallback() {
      sipClient.callingEvents.removeEventListener('sessionsUpdated', this);
    }
  }
);
