const mediaDevices = 'mediaDevices' in window.navigator;

export const webaudio = {
  mediaDevices,
  setSinkId: 'Audio' in window && 'setSinkId' in new (window as any).Audio(),
  getUserMedia: mediaDevices && 'getUserMedia' in window.navigator.mediaDevices,
  audioContext: 'AudioContext' in window || 'webkitAudioContext' in window
};

const peerConnection = 'RTCPeerConnection' in window;

export const webrtc = {
  peerConnection,
  connectionstatechange: peerConnection && 'onconnectionstatechange' in RTCPeerConnection.prototype
};

const browserUa: string = navigator.userAgent.toLowerCase();
export const isSafari = browserUa.indexOf('safari') !== -1 && browserUa.indexOf('chrome') < 0;
export const isFirefox = browserUa.indexOf('firefox') !== -1 && browserUa.indexOf('chrome') < 0;
export const isChrome = browserUa.indexOf('chrome') !== -1 && !isSafari && !isFirefox;

export const isLocalhost = ['127.0.0.1', 'localhost'].includes(window.location.hostname);

const required = [
  webrtc.peerConnection,
  webaudio.mediaDevices,
  webaudio.getUserMedia,
  webaudio.audioContext
];

export function checkRequired(): boolean {
  return required.every(x => x);
}
