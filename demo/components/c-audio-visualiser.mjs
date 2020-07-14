import * as sipClient from '../lib/calling.mjs';
import { NodesProxy } from '../utils/elementProxies.mjs';

let bufferLength;

const WIDTH = 1024;
const HEIGHT = 128;

let localAnalyser;
let remoteAnalyser;

let localStream;
let remoteStream;

window.customElements.define(
  'c-audio-visualiser',
  class extends HTMLElement {
    constructor() {
      super();
      this.nodes = new NodesProxy(this);
    }

    handleEvent({ detail }) {
      const session = detail;
      this.createAnalysers(session);
    }

    createAnalysers(session) {
      localStream = session.localStream.stream;
      remoteStream = session.remoteStream;

      this.setUpAnalysers();
      this.draw();
    }

    setUpAnalysers() {
      const localAudioCtx = new AudioContext();
      const remoteAudioCtx = new AudioContext();

      localAnalyser = localAudioCtx.createAnalyser();
      remoteAnalyser = remoteAudioCtx.createAnalyser();

      localAnalyser.connect(localAudioCtx.destination);
      localAnalyser.fftSize = 512 * 2;
      remoteAnalyser.connect(remoteAudioCtx.destination);
      remoteAnalyser.fftSize = 512 * 2;

      const localSource = localAudioCtx.createMediaStreamSource(localStream);
      const remoteSource = remoteAudioCtx.createMediaStreamSource(remoteStream);
      localSource.connect(localAnalyser);
      remoteSource.connect(remoteAnalyser);
    }

    draw() {
      this.drawVisualiser(localAnalyser, this.nodes.localAudio);
      this.drawVisualiser(remoteAnalyser, this.nodes.remoteAudio);
      requestAnimationFrame(this.draw.bind(this));
    }

    drawVisualiser(analyser, canvas) {
      bufferLength = analyser.frequencyBinCount;

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
