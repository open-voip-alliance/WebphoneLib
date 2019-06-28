import { Autoplay, Media, Sound } from '../dist/vialer-web-calling.prod.mjs';

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

const sound = new Sound('/demo/sounds/dtmf-0.mp3', {volume: 1.0, overlap: true});

document.querySelector('#play').addEventListener('click', async () => {
  sound.sinkId = getSelectedOption(outputSelect).value;
  sound.play().then(console.log);
});

Media.requestPermission();

Autoplay.allowed.then(() => console.log('Autoplay allowed!!'));
