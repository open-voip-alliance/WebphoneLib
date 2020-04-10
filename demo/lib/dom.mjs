/**
 * empties a DOM node.
 * @param node - the node that needs to be emptied.
 */
export function empty(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}
