import { SubscriptionStatus } from './enums';

export function eqSet<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && [...a].every(b.has.bind(b));
}

// https://stackoverflow.com/a/13969691/248948
export function isPrivateIP(ip) {
  const parts = ip.split('.');
  return (
    parts[0] === '10' ||
    (parts[0] === '172' && (parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31)) ||
    (parts[0] === '192' && parts[1] === '168')
  );
}

export function closeStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop());
}

/**
 * Calculate a jitter from interval.
 * @param {Number} interval - The interval in ms to calculate jitter for.
 * @param {Number} percentage - The jitter range in percentage.
 * @returns {Number} The calculated jitter in ms.
 */
export function jitter(interval, percentage) {
  const min = 0 - Math.ceil(interval * (percentage / 100));
  const max = Math.floor(interval * (percentage / 100));
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Parse an incoming dialog XML request body and return
 * the account state from it.
 * @param {Request} notification - A SIP.js Request object.
 * @returns {String} - The state of the account.
 */
export function statusFromDialog(notification) {
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
