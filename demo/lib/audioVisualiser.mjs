const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 512 * 2;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

let playbackDest = analyser;

analyser.connect(audioCtx.destination);

let canvas;
let canvasCtx;

const WIDTH = 1024;
const HEIGHT = 128;

export function setUpAnalyser(session) {
  debugger;
  canvas = document.querySelector('canvas');
  canvasCtx = canvas.getContext('2d');
  // canvasCtx.clearRect(0, 0, WIDTH, LENGTH);

  const localStream = session.localStream.stream;
  const remoteStream = session.remoteStream;

  const source = audioCtx.createMediaStreamSource(localStream);
  source.connect(analyser);
  draw();
}

function draw() {
  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(dataArray);

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
