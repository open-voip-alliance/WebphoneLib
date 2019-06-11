import { WebCallingClient, Media, AudioHelper } from '../dist/vialer-web-calling.prod.mjs';
import * as CREDS from './creds.js';
import { sleep } from './time.js';

const caller = document.querySelector('#caller');
const ringer = document.querySelector('#ring');
const remoteAudio = document.querySelector('#remote');
const localAudio = document.querySelector('#local');
const outBtn = document.querySelector('#out');
const registerBtn = document.querySelector('#register');
const unregisterBtn = document.querySelector('#unregister');
const holdBtn = document.querySelector('#hold');
const unholdBtn = document.querySelector('#unhold');

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

// const mp3 = AudioHelper.loadIntoBuffer('/demo/random.mp3');

const media = {
  remoteAudio,
  localAudio,
  input: () => {return undefined;}, //mp3,
  output: () => {return undefined;}
};

(async () => {
  await AudioHelper.autoplayAllowed;
  const a = await AudioHelper.loadForPlay('/demo/dtmf-3.mp3');
  a.play();
})();

const client = new WebCallingClient({ account, transport, media });
client.on('invite', incomingCall);
outBtn.addEventListener('click', async () => {
  await AudioHelper.autoplayAllowed;
  const a = await AudioHelper.loadForPlay('/demo/dtmf-0.mp3');
  a.play();
  //outgoingCall('999').catch(console.error)
});
registerBtn.addEventListener('click', () => client.connect().catch(console.error));
unregisterBtn.addEventListener('click', () => client.disconnect().catch(console.error));

Media.on('permissionGranted', () => console.log('Permission granted'));
Media.on('permissionRevoked', () => console.log('Permission revoked'));
Media.on('devicesChanged', () => console.log('Devices changed: ', Media.devices));

// Media.requestPermission();

AudioHelper.autoplayAllowed.then(() => console.log('Autoplay allowed!!'));

window.Media = Media;
window.AudioHelper = AudioHelper;

async function outgoingCall(number) {
  const session = await client.invite(`sip:${number}@voipgrid.nl`);
  console.log('created outgoing call', session.id, 'to', number);

  const hold = () => session.hold();
  const unhold = () => session.unhold();

  if (await session.accepted()) {
    console.log('outgoing call got accepted', session.id);
    holdBtn.addEventListener('click', hold);
    unholdBtn.addEventListener('click', unhold);
  } else {
    console.log('outgoing call was rejected', session.id);
  }

  await session.terminated();
  console.log('session is terminated', session.id);
  holdBtn.removeEventListener('click', hold);
  unholdBtn.removeEventListener('click', unhold);
}

async function incomingCall(session) {
  console.log('invited', session.id);

  const { number, displayName } = session.remoteIdentity;
  caller.innerHTML = `${displayName} (${number})`;
  caller.hidden = false;

  ringer.addEventListener(
    'click',
    () => {
      session.accept();
    },
    { once: true }
  );
  ringer.hidden = false;

  try {
    if (await session.accepted()) {
      console.log('session is accepted \\o/', session.id);

      // Terminate the session after 10 seconds
      setTimeout(() => {
        console.log('terminating the session');
        session.terminate();
      }, 10000);

      await session.terminated();

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
    ringer.hidden = true;
    caller.hidden = true;
  }
}
