import browserEnv from 'browser-env';
browserEnv();

// Mock required browser APIs for tests

// Mock navigator.mediaDevices
window.navigator.mediaDevices = {
  getUserMedia: () => Promise.resolve({})
};

// Mock Audio with setSinkId
window.Audio = class Audio {
  setSinkId() {
    return Promise.resolve();
  }
};

// Mock RTCPeerConnection with onconnectionstatechange
window.RTCPeerConnection = class RTCPeerConnection {
  constructor() {
    this.onconnectionstatechange = null;
  }
};
// Make it available globally
global.RTCPeerConnection = window.RTCPeerConnection;

// Mock AudioContext
window.AudioContext = class AudioContext {};
global.AudioContext = window.AudioContext;

// Mock location
window.location = {
  hostname: 'localhost',
  href: 'http://localhost/',
  protocol: 'http:',
  host: 'localhost',
  pathname: '/',
  search: '',
  hash: ''
};

// Update navigator userAgent to avoid browser detection issues
Object.defineProperty(window.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (compatible; test-agent)',
  writable: true,
  configurable: true
});
