import { Media, Sound } from '../../dist/index.mjs';
import { client, getSessions } from './calling.mjs';
import { getDocumentElement } from './dom.mjs';
import { Logger } from './logging.mjs';

const logger = new Logger('media');

export const media = {
  input: {
    id: undefined,
    audioProcessing: true,
    volume: 1.0,
    muted: false
  },
  output: {
    id: undefined,
    volume: 1.0,
    muted: false
  }
};

const sound = new Sound('/demo/sounds/dtmf-0.mp3', { volume: 1.0, overlap: true });

Media.requestPermission();

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
  devices
    .map(({ id, name }) => {
      const option = document.createElement('option');
      option.value = id;
      option.text = name;
      return option;
    })
    .forEach(opt => {
      if (selected && opt.value === selected.value) {
        opt.selected = true;
        selected = undefined;
      }
      select.add(opt);
    });

  if (selected) {
    logger.error(`Selected device went away: ${selected.text}`);
  }
}

function updateDevicesLists(mediaDevices, list) {
  while (list.firstChild) list.removeChild(list.firstChild);

  mediaDevices
    .map(({ name }) => {
      const device = document.createElement('li');
      device.textContent = name;
      return device;
    })
    .forEach(listItem => {
      list.appendChild(listItem);
    });
}

Media.on('permissionGranted', () => {
  console.log('Permission granted');
});
Media.on('permissionRevoked', () => console.log('Permission revoked'));
Media.on('devicesChanged', () => {
  logger.info('Devices changed');
  makeOptions(getDocumentElement('inputSelect'), Media.inputs); //updatplease
  makeOptions(getDocumentElement('outputSelect'), Media.outputs);

  // for the first time set default media. Can be improved.
  changeInputSelect(getDocumentElement('inputSelect'));
  changeOutputSelect(getDocumentElement('outputSelect'));

  updateDevicesLists(Media.inputs, getDocumentElement('inputDevicesList'));
  updateDevicesLists(Media.outputs, getDocumentElement('outputDevicesList'));
});
Media.init();

export function changeInputSelect(_inputSelect) {
  const selected = getSelectedOption(_inputSelect);
  if (selected) {
    getSessions().forEach(session => {
      session.media.input.id = selected.value;
    });

    client.defaultMedia.input.id = selected.value;
  }
  logger.info('Input select changed to: ' + selected.text);
}

export function changeOutputSelect(_outputSelect) {
  const selected = getSelectedOption(_outputSelect);
  if (selected) {
    getSessions().forEach(session => {
      session.media.output.id = selected.value;
    });
    client.defaultMedia.output.id = selected.value;
  }
  logger.info('Output select changed to: ' + selected.text);
}

export function playSound() {
  sound.sinkId = getSelectedOption(document.querySelector('[data-selector="outputSelect"]')).value;
  sound.play();
}

window.Media = Media;

export function changeInputVolume(value) {
  const vol = value / 10;
  getSessions().forEach(session => {
    session.media.input.volume = vol;
  });

  client.defaultMedia.input.volume = vol;

  logger.info('Input volume changed to: ' + value);
}

export function changeInputMuted(checked) {
  getSessions().forEach(session => {
    session.media.media.input.muted = checked;
  });

  client.defaultMedia.input.muted = checked;

  logger.info('Input muted changed to: ' + checked);
}

export function changeOutputVolume(value) {
  const vol = value / 10;
  getSessions().forEach(session => {
    session.media.output.volume = vol;
  });

  client.defaultMedia.output.volume = vol;

  logger.info('Output volume changed to: ' + value);
}

export function changeOutputMuted(checked) {
  getSessions().forEach(session => {
    session.media.output.muted = checked;
  });

  client.defaultMedia.output.muted = checked;

  logger.info('Output muted changed to: ' + checked);
}
