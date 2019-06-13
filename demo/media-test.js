import { Media, AudioHelper } from '../dist/vialer-web-calling.prod.mjs';
import { sleep } from './time.js';

const inputSelect = document.querySelector('#input');
const outputSelect = document.querySelector('#output');


function getSelectedOption(select) {
  try {
    return select.options[select.selectedIndex];
  } catch (e) {
    return undefined;
  }
}

function makeOptions(select, devices) {
  let selected = getSelectedOption(select);

  // Remove all options.
  select.options.length = 0;

  // Build a list of new options.
  devices.map(({id, name}) => {
    const option = document.createElement('option');
    option.value = id;
    option.text = name;
    return option;
  }).forEach(opt => {
    if (selected && opt.value === selected.value) {
      opt.selected = true;
      selected = undefined;
    }
    select.add(opt);
  });

  if (selected) {
    console.error('Selected device went away:', selected.text, ' (', selected.value, ')');
  }
}

Media.on('permissionGranted', () => console.log('Permission granted'));
Media.on('permissionRevoked', () => console.log('Permission revoked'));
Media.on('devicesChanged', () => {
  console.log('Devices changed: ', Media.devices);
  makeOptions(inputSelect, Media.inputs);
  makeOptions(outputSelect, Media.outputs);
});

let sample;
document.querySelector('#play').addEventListener('click', async () => {
  const sinkId = getSelectedOption(outputSelect).value;
  if (!sample) {
    sample = await AudioHelper.load('/demo/sounds/dtmf-3.mp3', {sinkId, loop: true});
    await sample.play();
  } else {
    await sample.setSinkId(sinkId);
    console.log('changed sink');
  }
  // await sleep(1000);
  // sample.pause();
});

Media.requestPermission();

AudioHelper.autoplayAllowed.then(() => console.log('Autoplay allowed!!'));

window.Media = Media;
window.AudioHelper = AudioHelper;
