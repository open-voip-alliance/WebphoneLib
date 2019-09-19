import { SubscriptionStatus } from './enums';

export { Subscription } from 'sip.js';

/**
 * Parse an incoming dialog XML request body and return
 * the account state from it.
 * @param {Request} notification - A SIP.js Request object.
 * @returns {string} - The state of the account.
 */
export function statusFromDialog(notification: any): string {
  const parser = new DOMParser();
  const xmlDoc = parser ? parser.parseFromString(notification.request.body, 'text/xml') : null;
  const dialogNode = xmlDoc ? xmlDoc.getElementsByTagName('dialog-info')[0] : null;
  // Skip; an invalid dialog.
  if (!dialogNode) {
    return null;
  }

  const stateNode = dialogNode.getElementsByTagName('state')[0];
  let state = SubscriptionStatus.AVAILABLE;

  // State node has final say, regardless of stateAttr!
  if (stateNode) {
    switch (stateNode.textContent) {
      case SubscriptionStatus.TRYING:
      case SubscriptionStatus.PROCEEDING:
      case SubscriptionStatus.EARLY:
        state = SubscriptionStatus.RINGING;
        break;
      case SubscriptionStatus.CONFIRMED:
        state = SubscriptionStatus.BUSY;
        break;
      case SubscriptionStatus.TERMINATED:
        state = SubscriptionStatus.AVAILABLE;
        break;
    }
  }
  return state;
}
