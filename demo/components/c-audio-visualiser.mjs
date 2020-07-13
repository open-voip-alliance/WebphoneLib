window.customElements.define(
  'c-audio-visualiser',
  class extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-audio-visualiser]');
      this.appendChild(template.content.cloneNode(true));
    }
  }
);
