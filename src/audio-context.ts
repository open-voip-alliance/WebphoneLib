function createAudioContext(): AudioContext {
  const cls = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (cls) {
    return new cls();
  }
}

export const audioContext = createAudioContext();
