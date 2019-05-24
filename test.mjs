import SipLibClient from './index.mjs';
import * as CREDS from '../creds.mjs';
import { sleep } from './time.mjs';

const client = new SipLibClient({
  authorizationUser: CREDS.authorizatoinUser,
  password: CREDS.password,
  uri: CREDS.uri,
  log: {
    level: 'warn'
  },
  noanswertimeout: 60,
  transportOptions: {
    maxReconnectAttempts: 0,
    wsServers: "wss://websocket.voipgrid.nl",
    traceSip: true
  },
  userAgentString: "vialer-calling-lib",
  register: false,
  registerOptions: {
    expires: 3600
  }
});

(async () => {
  console.log('Registering client..');
  try {
    client.on('invite', async (session) => {
      console.log('received invite!', session);
      
      const ringer = document.querySelector('#ring');
      ringer.addEventListener('click', () => {
        session.accept();
      }, {once: true});
      ringer.hidden = false;

      try {
        if (await session.accepted()) {
          console.log('session is accepted \o/');

          console.log('letting session run for 3 seconds...');
          await sleep(3000);

          console.log('terminating session...');
          await session.terminate();
        } else {
          console.log('session was rejected...');
        }
      } catch (e) {
        console.error('session failed', e);
      } finally {
        console.log('closing session...');
        ringer.hidden = true;
      }
    });

    await client.register();
    console.log('!!Registration successful');
  } catch (e) {
    console.error(e);
  }
})();
