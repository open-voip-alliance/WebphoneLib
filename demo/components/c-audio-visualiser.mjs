import * as sipClient from '../lib/calling.mjs';
import { NodesProxy } from '../utils/elementProxies.mjs';

const WIDTH = 1024;
const HEIGHT = 128;

window.customElements.define(
  'c-audio-visualiser',
  class extends HTMLElement {
    constructor() {
      super();
      this.nodes = new NodesProxy(this);
    }

    handleEvent({ detail: { session } }) {
      this.setUpAnalysers(session);
    }

    setUpAnalysers(session) {
      const localStream = session.localStream.stream;
      const remoteStream = session.remoteStream;

      const localAudioCtx = new AudioContext();
      const remoteAudioCtx = new AudioContext();

      this.localAnalyser = localAudioCtx.createAnalyser();
      this.remoteAnalyser = remoteAudioCtx.createAnalyser();

      this.localAnalyser.connect(localAudioCtx.destination);
      this.localAnalyser.fftSize = 512 * 2;
      this.remoteAnalyser.connect(remoteAudioCtx.destination);
      this.remoteAnalyser.fftSize = 512 * 2;

      const localSource = localAudioCtx.createMediaStreamSource(localStream);
      const remoteSource = remoteAudioCtx.createMediaStreamSource(remoteStream);
      localSource.connect(this.localAnalyser);
      remoteSource.connect(this.remoteAnalyser);

      this.draw();
    }

    draw() {
      this.drawVisualiser(this.localAnalyser, this.nodes.localAudio);
      this.drawVisualiser(this.remoteAnalyser, this.nodes.remoteAudio);
      requestAnimationFrame(this.draw.bind(this));
    }

    drawVisualiser(analyser, canvas) {
      const bufferLength = analyser.frequencyBinCount;

      const dataArray = new Uint8Array(bufferLength);

      analyser.getByteFrequencyData(dataArray);

      let canvasCtx = canvas.getContext('2d');
      canvasCtx.fillStyle = 'rgb(0, 0, 0)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      let barWidth = (WIDTH - bufferLength) / bufferLength;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];

        canvasCtx.fillStyle = '#FE7F9C';
        canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2);

        x += barWidth + 1;
      }
    }

    connectedCallback() {
      const template = document.querySelector('[data-component=c-audio-visualiser]');
      this.appendChild(template.content.cloneNode(true));

      sipClient.callingEvents.addEventListener('sessionAccepted', this);
    }

    disconnectedCallback() {
      sipClient.callingEvents.removeEventListener('sessionAccepted', this);
    }
  }
);
