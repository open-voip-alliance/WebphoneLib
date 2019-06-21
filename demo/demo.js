import { Client, Media, AudioHelper } from '../dist/vialer-web-calling.prod.mjs';
import * as CREDS from './creds.js';
// import { sleep } from './time.js';

const caller = document.querySelector('#caller');
const ringerBtn = document.querySelector('#ring');
const outBtn = document.querySelector('#out');
const reconfigureBtn = document.querySelector('#reconfigure');
const registerBtn = document.querySelector('#register');
const unregisterBtn = document.querySelector('#unregister');
const inCall = document.querySelector('#in-call');
const byeBtn = document.querySelector('#bye');
const holdBtn = document.querySelector('#hold');
const unholdBtn = document.querySelector('#unhold');
const blindTransferBtn = document.querySelector('#blindtransfer');
const inVol = document.querySelector('#inVol');
const outVol = document.querySelector('#outVol');
const inMute = document.querySelector('#inMute');
const outMute = document.querySelector('#outMute');
const mos = document.querySelector('#mos');
const resubscribeBtn = document.querySelector('#resubscribe');

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

const contact = 'sip:497920038@voipgrid.nl';

client.on('invite', incomingCall);
client.on('notify', (notifiedContact, notification) => {
  console.log(`${notifiedContact}: ${notification}`);
});

reconfigureBtn.addEventListener('click', () =>
  client.reconfigure({ account, transport }).catch(console.error)
);
registerBtn.addEventListener('click', () =>
  client
    .connect()
    .then(async () => {
      await client.subscribe(contact);
      console.log('subscribed!');
    })
    .catch(console.error)
);
unregisterBtn.addEventListener('click', () => client.disconnect().catch(console.error));
resubscribeBtn.addEventListener(
  'click',
  async () => await client.resubscribe(contact).catch(console.error)
);

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

function printStats(stats) {
  const last = (stats.mos.last || 0).toFixed(2);
  const low = (stats.mos.lowest || 0).toFixed(2);
  const high = (stats.mos.highest || 0).toFixed(2);
  const avg = (stats.mos.average || 0).toFixed(2);
  console.log(`MOS: ${last} low ${low} high ${high} avg ${avg}`);
}

async function runSession(session) {
  activeSession = session;

  const bye = () => session.bye();
  const hold = async () => await session.hold();
  const unhold = async () => await session.unhold();
  const blindTransfer = async () => await session.transfer('sip:318@voipgrid.nl');

  session.on('statsUpdated', stats => {
    printStats(stats);
    mos.innerHTML = (stats.mos.last || 0).toFixed(2);
  });

  try {
    inCall.hidden = false;
    byeBtn.addEventListener('click', bye);
    holdBtn.addEventListener('click', hold);
    unholdBtn.addEventListener('click', unhold);
    blindTransferBtn.addEventListener('click', blindTransfer);

    await session.terminated();
  } finally {
    byeBtn.removeEventListener('click', bye);
    holdBtn.removeEventListener('click', hold);
    unholdBtn.removeEventListener('click', unhold);
    blindTransferBtn.removeEventListener('click', blindTransfer);
    inCall.hidden = true;
    activeSession = undefined;

    printStats(session.stats);
  }
}

async function outgoingCall(number) {
  const session = await client.invite(`sip:${number}@voipgrid.nl`);
  if (!session) {
    return;
  }

  console.log('created outgoing call', session.id, 'to', number);

  if (await session.accepted()) {
    console.log('outgoing call got accepted', session.id);
    await runSession(session);
  } else {
    console.log('outgoing call was rejected', session.id);
    await session.terminated();
  }

  console.log('session is terminated', session.id);
}

async function incomingCall(session) {
  console.log('invited', session.id);

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

  let terminateTimer;
  try {
    if (await session.accepted()) {
      console.log('session is accepted \\o/', session.id);

      // Terminate the session after 60 seconds
      terminateTimer = setTimeout(() => {
        console.log('terminating the session');
        session.terminate();
      }, 60000);

      await runSession(session);

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

    if (terminateTimer) {
      clearTimeout(terminateTimer);
    }
  }
}
