import './c-keypad.mjs';
import './c-session.mjs';
import { ActionsProxy, NodesProxy } from '../utils/elementProxies.mjs';
import * as sipClient from '../lib/calling.mjs';
import { Logger } from '../lib/logging.mjs';
import { accountUri } from '../config.mjs';

const logger = new Logger('c-publisher');

function publish(publisher, state, callId) {
  logger.info(callId);

  let ourContent = `<?xml version="1.0"?><dialog-info xmlns="urn:ietf:params:xml:ns:dialog-info" state="partial" entity="${accountUri}"><dialog id="${callId}" call-id="${callId}" direction="recipient"><state>${state}</state><remote><identity>${accountUri}</identity><target uri="${accountUri}"/></remote><local><identity>${accountUri}</identity><target uri="${accountUri}"/></local></dialog></dialog-info>`;

  publisher.publish(ourContent);
}

window.customElements.define(
  'c-publisher',
  class extends HTMLElement {
    constructor() {
      super();

      this.actions = new ActionsProxy(this);
      this.nodes = new NodesProxy(this);
    }

    handleEvent({ currentTarget, target }) {
      switch (currentTarget) {
        case this.actions.publish:
          {
            const { value: target } = this.nodes.targetInput;
            const { value: content } = this.nodes.contentInput;

            logger.info(`Publishing for ${target}`);

            const publisher = this.getOrCreatePublisher(target, {
              body: content,
              contentType: 'application/dialog-info+xml',
              expires: 60
            });

            if (!publisher) {
              logger.info('Should register before publishing');
            }

            publish(publisher, content, this.publisher.request.callId);
          }
          break;
        default:
          break;
      }
    }

    getOrCreatePublisher(contact, options) {
      if (!this.publisher) {
        this.publisher = sipClient.createPublisher(contact, options);
      }

      return this.publisher;
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-publisher]');
      this.appendChild(template.content.cloneNode(true));

      this.actions.publish.addEventListener('click', this);
    }

    disconnectedCallback() {
      this.actions.publish.removeEventListener('click', this);
    }
  }
);
