import { Client, Media, AudioHelper } from '../dist/vialer-web-calling.prod.mjs';
import * as CREDS from './creds.js';
// import { sleep } from './time.js';

const caller = document.querySelector('#caller');
const ringerBtn = document.querySelector('#ring');
const remoteAudio = document.querySelector('#remote');
const localAudio = document.querySelector('#local');
const outBtn = document.querySelector('#out');
const reconfigureBtn = document.querySelector('#reconfigure');
const registerBtn = document.querySelector('#register');
const unregisterBtn = document.querySelector('#unregister');
const byeBtn = document.querySelector('#bye');
const holdBtn = document.querySelector('#hold');
const unholdBtn = document.querySelector('#unhold');
const blindTransferBtn = document.querySelector('#blindtransfer');
const inVol = document.querySelector('#inVol');
const outVol = document.querySelector('#outVol');
const inMute = document.querySelector('#inMute');
const outMute = document.querySelector('#outMute');

const account = {
  user: CREDS.authorizationUser,
  password: CREDS.password,
  uri: CREDS.uri,
  name: 'test'
};

const transport = {
  wsServers: 'wss://websocket.voipgrid.nl',
  iceServers: ['stun:stun0-grq.voipgrid.nl', 'stun:stun0-ams.voipgrid.nl']
};

const media = {
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

const client = new Client({ account, transport, media });
client.on('invite', incomingCall);
outBtn.addEventListener('click', () => outgoingCall('999').catch(console.error));
reconfigureBtn.addEventListener('click', () =>
  client.reconfigure({ account, transport }).catch(console.error)
);
registerBtn.addEventListener('click', () => client.connect().catch(console.error));
unregisterBtn.addEventListener('click', () => client.disconnect().catch(console.error));

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

inputSelect.addEventListener('change', function() {
  const selected = getSelectedOption(inputSelect);
  if (selected) {
    if (activeSession) {
      activeSession.media.input.id = selected.value;
    } else {
      client.defaultMedia.input.id = selected.value;
    }
  }
});

outputSelect.addEventListener('change', function() {
  const selected = getSelectedOption(outputSelect);
  if (selected) {
    if (activeSession) {
      activeSession.media.output.id = selected.value;
    } else {
      client.defaultMedia.output.id = selected.value;
    }
  }
});

Media.requestPermission();

AudioHelper.autoplayAllowed.then(() => console.log('Autoplay allowed!!'));

window.Media = Media;

window.AudioHelper = AudioHelper;

let activeSession = null;

inVol.addEventListener('input', function(e) {
  const vol = this.value / 10;
  if (activeSession) {
    activeSession.media.input.volume = vol;
  } else {
    client.defaultMedia.input.volume = vol;
  }
});

inMute.addEventListener('change', function(e) {
  if (activeSession) {
    activeSession.media.input.muted = this.checked;
  } else {
    client.defaultMedia.input.volume = this.checked;
  }
});

outVol.addEventListener('input', function(e) {
  const vol = this.value / 10;
  if (activeSession) {
    activeSession.media.output.volume = vol;
  } else {
    client.defaultMedia.output.volume = vol;
  }
});

outMute.addEventListener('change', function(e) {
  if (activeSession) {
    activeSession.media.output.muted = this.checked;
  } else {
    client.defaultMedia.output.volume = this.checked;
  }
});

async function outgoingCall(number) {
  const session = await client.invite(`sip:${number}@voipgrid.nl`);

  if (!session) {
    return;
  }

  activeSession = session;

  console.log('created outgoing call', session.id, 'to', number);

  const bye = () => session.bye();
  const hold = async () => await session.hold();
  const unhold = async () => await session.unhold();
  const blindTransfer = async () => await session.transfer('sip:318@voipgrid.nl');

  if (await session.accepted()) {
    console.log('outgoing call got accepted', session.id);

    byeBtn.hidden = false;
    blindTransferBtn.hidden = false;
    byeBtn.addEventListener('click', bye);
    holdBtn.addEventListener('click', hold);
    unholdBtn.addEventListener('click', unhold);
    blindTransferBtn.addEventListener('click', blindTransfer);
  } else {
    console.log('outgoing call was rejected', session.id);
  }

  await session.terminated();
  console.log('session is terminated', session.id);

  byeBtn.hidden = true;
  byeBtn.removeEventListener('click', bye);
  holdBtn.removeEventListener('click', hold);
  unholdBtn.removeEventListener('click', unhold);
  blindTransferBtn.removeEventListener('click', blindTransfer);
  blindTransferBtn.hidden = true;
  activeSession = undefined;
}

async function incomingCall(session) {
  console.log('invited', session.id);
  activeSession = session;

  const bye = () => session.bye();
  const hold = async () => {
    console.log('holding...');
    await session.hold();
    console.log('reinvite is sent...');
  };
  const unhold = async () => await session.unhold();
  const blindTransfer = async () => await session.transfer('sip:318@voipgrid.nl');

  const { number, displayName } = session.remoteIdentity;
  caller.innerHTML = `${displayName} (${number})`;
  caller.hidden = false;

  ringerBtn.addEventListener(
    'click',
    () => {
      session.accept();
    },
    { once: true }
  );
  ringerBtn.hidden = false;

  try {
    if (await session.accepted()) {
      console.log('session is accepted \\o/', session.id);

      blindTransferBtn.hidden = false;
      byeBtn.hidden = false;
      byeBtn.addEventListener('click', bye);
      holdBtn.addEventListener('click', hold);
      unholdBtn.addEventListener('click', unhold);
      blindTransferBtn.addEventListener('click', blindTransfer);

      // Terminate the session after 60 seconds
      setTimeout(() => {
        console.log('terminating the session');
        session.terminate();
      }, 60000);

      await session.terminated();

      byeBtn.removeEventListener('click', bye);
      holdBtn.removeEventListener('click', hold);
      unholdBtn.removeEventListener('click', unhold);
      blindTransferBtn.removeEventListener('click', blindTransfer);

      // It could happen that the session was broken somehow
      if (session.saidBye) {
        console.log('The session was polite to you.');
      }
    } else {
      console.log('session was rejected...', session.id);
    }
  } catch (e) {
    console.error('session failed', session.id, e);
  } finally {
    console.log('closing session...', session.id);
    byeBtn.hidden = true;
    ringerBtn.hidden = true;
    caller.hidden = true;
    blindTransferBtn.hidden = true;
    activeSession = undefined;
  }
}
