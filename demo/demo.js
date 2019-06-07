import { WebCallingClient, Media } from '../dist/vialer-web-calling.prod.mjs';
import * as CREDS from './creds.js';
import { sleep } from './time.js';

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

const media = { remoteAudio, localAudio };

const client = new WebCallingClient({ account, transport, media });
client.on('invite', incomingCall);
outBtn.addEventListener('click', () => outgoingCall('518').catch(console.error));
reconfigureBtn.addEventListener('click', () =>
  client.reconfigure({ account, transport, media }).catch(console.error)
);
registerBtn.addEventListener('click', () => client.connect().catch(console.error));
unregisterBtn.addEventListener('click', () => client.disconnect().catch(console.error));

Media.on('permissionGranted', () => console.log('Permission granted'));
Media.on('permissionRevoked', () => console.log('Permission revoked'));
Media.on('devicesChanged', () => console.log('Devices changed: ', Media.devices));

Media.requestPermission();

window.Media = Media;

async function outgoingCall(number) {
  const session = await client.invite(`sip:${number}@voipgrid.nl`);
  console.log('created outgoing call', session.id, 'to', number);

  const bye = () => session.bye();
  const hold = async () => await session.hold();
  const unhold = async () => await session.unhold();

  if (await session.accepted()) {
    console.log('outgoing call got accepted', session.id);

    byeBtn.hidden = false;
    byeBtn.addEventListener('click', bye);
    holdBtn.addEventListener('click', hold);
    unholdBtn.addEventListener('click', unhold);
  } else {
    console.log('outgoing call was rejected', session.id);
  }

  await session.terminated();
  console.log('session is terminated', session.id);

  byeBtn.hidden = true;
  byeBtn.removeEventListener('click', bye);
  holdBtn.removeEventListener('click', hold);
  unholdBtn.removeEventListener('click', unhold);
}

async function incomingCall(session) {
  console.log('invited', session.id);

  const bye = () => session.bye();
  const hold = async () => {
    console.log('holding...');
    await session.hold();
    console.log('reinvite is sent...');
  };
  const unhold = async () => await session.unhold();

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

      byeBtn.hidden = false;
      byeBtn.addEventListener('click', bye);
      holdBtn.addEventListener('click', hold);
      unholdBtn.addEventListener('click', unhold);

      // Terminate the session after 10 seconds
      setTimeout(() => {
        console.log('terminating the session');
        session.terminate();
      }, 60000);

      await session.terminated();

      byeBtn.removeEventListener('click', bye);
      holdBtn.removeEventListener('click', hold);
      unholdBtn.removeEventListener('click', unhold);

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
  }
}
