import { audioContext } from '../audio-context';

/**
 * Generic class type T. For example: `Type<Session>`
 */
export type Type<T> = new (...args: any[]) => T;

export function eqSet<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && [...a].every(b.has.bind(b));
}

// https://stackoverflow.com/a/13969691/248948
export function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.');
  return (
    parts[0] === '10' ||
    (parts[0] === '172' && (parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31)) ||
    (parts[0] === '192' && parts[1] === '168')
  );
}

export async function fetchStream(url: string): Promise<() => Promise<AudioBufferSourceNode>> {
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(data);
  return async () => {
    const soundSource = audioContext.createBufferSource();
    soundSource.buffer = buffer;
    soundSource.start(0, 0);
    return soundSource;
    // const destination = audioContext.createMediaStreamDestination();
    // soundSource.connect(destination);
    // return destination.stream;
  };
}

/**
 * Calculate a jitter from interval.
 * @param {number} interval - The interval in ms to calculate jitter for.
 * @param {number} percentage - The jitter range in percentage.
 * @returns {number} The calculated jitter in ms.
 */
export function jitter(interval: number, percentage: number): number {
  const min = Math.max(0, Math.ceil(interval * ((100 - percentage) / 100)));
  const max = Math.floor(interval * ((100 + percentage) / 100));
  return Math.floor(min + Math.random() * (max - min));
}

/**
 * This doubles the retry interval in each run and adds jitter.
 * @param {any} retry - The reference retry object.
 * @returns {any & { interval: number } } The updated retry object.
 */
export function increaseTimeout(retry: any): any & { interval: number } {
  // Make sure that interval doesn't go past the limit.
  if (retry.interval * 2 < retry.limit) {
    retry.interval = retry.interval * 2;
  } else {
    retry.interval = retry.limit;
  }

  retry.timeout = retry.interval + jitter(retry.interval, 30);
  return retry;
}

/**
 * Clamp a value between `min` and `max`, both inclusive.
 * @param {number} value - Value.
 * @param {number} min - Minimum value, inclusive.
 * @param {number} max - Maximum value, inclusive.
 * @returns {number} Clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  } else if (value > max) {
    return max;
  } else {
    return value;
  }
}
