const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;

export const audioContext = new AudioContext();
