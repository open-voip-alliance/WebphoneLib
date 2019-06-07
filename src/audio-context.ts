const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;

export default new AudioContext();
