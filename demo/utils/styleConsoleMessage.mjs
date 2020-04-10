export default function styleConsoleMessage(level) {
  const colors = {
    error: `#8f0a06`, // Red
    warn: `#ff7b24`, // Orange
    info: `#0051d4`, // Blue
    debug: `#666666`, // Gray
    verbose: `#046614` // Green
  };

  // from Workbox
  const styles = [`background: ${colors[level]}`];
  return styles;
}
