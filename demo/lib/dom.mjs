/**
 * empties a DOM node.
 * @param node - the node that needs to be emptied.
 */
export function empty(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function getDocumentElement(elementName) {
  return document.querySelector(`[data-selector=${elementName}]`);
}

export function getFormValues(form) {
  return Array.from(form).reduce((prev, { name, value }) => {
    if (name) {
      return Object.assign(prev, {
        [name]: value
      });
    } else {
      return prev;
    }
  }, {});
}
