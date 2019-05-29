/**
 * Sleep for a number of milliseconds. This will not block the thread, but
 * instead it returns a `Promise` which will resolve after `ms`
 * milliseconds.
 *
 * @param {Number} ms - Number of milliseconds to sleep.
 * @returns {Promise} - which resolves after `ms` milliseconds.
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
