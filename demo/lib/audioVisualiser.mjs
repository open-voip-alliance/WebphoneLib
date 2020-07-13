let bufferLength;

const WIDTH = 1024;
const HEIGHT = 128;

let localAnalyser;
let remoteAnalyser;

let localAudioCanvas;
let remoteAudioCanvas;

let localStream;
let remoteStream;

export function createAnalysers(session) {
  localAudioCanvas = document.querySelector('.local-audio');
  remoteAudioCanvas = document.querySelector('.remote-audio');
  localStream = session.localStream.stream;
  remoteStream = session.remoteStream;

  setUpAnalysers();
  draw();
}

function setUpAnalysers() {
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

function drawVisualiser(analyser, canvas) {
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

    canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
    canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2);

    x += barWidth + 1;
  }
}

function draw() {
  drawVisualiser(localAnalyser, localAudioCanvas);
  drawVisualiser(remoteAnalyser, remoteAudioCanvas);
  requestAnimationFrame(draw);
}
