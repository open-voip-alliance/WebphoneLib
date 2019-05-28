import SipLibClient from './index.mjs';
import * as CREDS from '../creds.mjs';
import { sleep } from './time.mjs';


const caller = document.querySelector('#caller');
const ringer = document.querySelector('#ring');
const remoteAudio = document.querySelector('#remote');
const localAudio = document.querySelector('#local');

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

const client = new SipLibClient({account, transport, media});

(async () => {
  console.log('registering client..');
  try {
    client.on('invite', async session => {
      console.log('invited', session.id);

      const { number, displayName } = session.getIdentity();
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
          await sleep(3000);
          await session.terminate();
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
    });

    await client.register();
    console.log('Registration successful');

    document.querySelector('#out').addEventListener('click', async () => {
      const session = client.invite('sip:303@voipgrid.nl');
      console.log('created outgoing call', session.id);

      if (await session.accepted()) {
        console.log('outgoing call got accepted', session.id);
      }

      await session.terminated();
      console.log('session is terminated', session.id);
    });
  } catch (e) {
    console.error(e);
  }
})();
