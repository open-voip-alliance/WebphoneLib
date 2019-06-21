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
