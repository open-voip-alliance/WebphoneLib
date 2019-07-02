import { audioContext } from './audio-context';

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

export function closeStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop());
}

export async function fetchAudio(url: string): Promise<() => Promise<AudioBufferSourceNode>> {
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(data);
  return () => {
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
 * @param {Number} interval - The interval in ms to calculate jitter for.
 * @param {Number} percentage - The jitter range in percentage.
 * @returns {Number} The calculated jitter in ms.
 */
export function jitter(interval: number, percentage: number): number {
  const min = 0 - Math.ceil(interval * (percentage / 100));
  const max = Math.floor(interval * (percentage / 100));
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * This doubles the retry interval in each run and adds jitter.
 * @param {object} retry - The reference retry object.
 * @returns {object} The updated retry object.
 */
export function increaseTimeout(retry) {
  // Make sure that interval doesn't go past the limit.
  if (retry.interval * 2 < retry.limit) {
    retry.interval = retry.interval * 2;
  } else {
    retry.interval = retry.limit;
  }

  retry.timeout = retry.interval + jitter(retry.interval, 30);
  return retry;
}
