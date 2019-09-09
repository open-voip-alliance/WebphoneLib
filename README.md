# Open VoIP Alliance Webphone Lib

# Goals

1.  Hide the complexities of SIP, SDP and WebRTC from the
    implementation of the Webphone through an easy to use modern Javascript API.

2.  Uses `Promises` and `async` where possible, use events only where
    neccessary (not in request/response flows).

3.  Export as ESM module.

4.  Error handling is clear and where possible Promise based.

5.  WebphoneLib does not keep state.

6.  Wraps SIP.js in such a way that upgrades are easy.

7.  Abstract over differences between browsers.

# Use cases

- Register phone
- Unregister phone
- Accepting an incoming call
- Denying an incoming call
- Creating an outgoing call
- Hanging up a call (in or out)
- Putting a call on hold
- Putting a call out of hold
- Blind transfer of a call
- Attended transfer of a call
- Getting presence updates for contacts (blf)
- Enter DTMF keys in a call
- Muting a call
- Switching audio devices during a call
- To implement Quality of Service

# Accidental complexity

- Websocket connection to the SIP proxy.

  - Connecting/disconnecting
  - Handling failures

- Setting up the WebRTC channels (SIP.js) does this.
- Requesting the audio/video devices to be used (SIP.js)
  - Is done by the SessionDescriptionHandler, maybe the audio stream
    handling could be decoupled from the SDH. Right now the SDH always
    does a `getUserMedia` call to get _a_ microphone.
- Negotiating the SDP (SIP.js).

- Logging..
  - Logging all SIP traffic?

# WebphoneLib client setup

- Which audio/video devices to use?
  - _how to switch_ a/v during a call? Is this possible?
- ice servers (stun)
- transport options (reconnection etc.?)
- user agent
- noanswertimeout?
- etc.

Maybe best to first just pass through the `options` to the `SIP.UA`
constructor?

# Example flows

## Connecting and registering

```javascript
import { Client } from '../dist/vialer-web-calling.prod.mjs';

const account = {
  user: 'accountId',
  password: 'password',
  uri: 'sip:accountId@voipgrid.nl',
  name: 'test'
};

const transport = {
  wsServers: 'wss://websocket.voipgrid.nl',
  iceServers: ['stun:stun0-grq.voipgrid.nl', 'stun:stun0-ams.voipgrid.nl']
};

const media = {
  input: {
    id: undefined, // default audio device
    audioProcessing: true,
    volume: 1.0,
    muted: false
  },
  output: {
    id: undefined, // default audio device
    volume: 1.0,
    muted: false
  }
};

const client = new Client({ account, transport, media });

await client.register();
```

## Incoming call

```javascript
// incoming call below
sessions = {};
client.on('invite', (session) => {
  // If DND, session.reject()
  sessions[session.id] = session;
  // reinvite..
  try {
    ringer();

    let accepted = await session.accepted(); // wait until the call is picked up)
    if (!accepted) {
      return;
    }

    showCallScreen();

    await session.terminated();
  } catch (e) {
    showErrorMessage(e)
  } finally {
    closeCallScreen();

    delete sessions[session.id];
  }
});
```

## Outgoing call

```javascript
sessions = {};
const session = client.invite('sip:518@voipgrid.nl');
sessions[session.id] = session;

try {
  showOutgoingCallInProgress();

  let isAccepted = await session.accepted();
  if (!isAccepted) {
    showRejectedScreen();
    return;
  }

  showCallScreen();

  await session.terminated();
} catch (e) {
} finally {
  closeCallScreen();

  delete sessions[session.id];
}
```

## Attended transfer of a call

```javascript
if (await session.accepted()) {
  await session.hold();

  const other = client.invite('sip:519@voipgrid.nl');
  if (await other.accepted()) {
    await session.attendedTransfer(other);

    await session.terminated();
  }
}
```

# Audio device selection

1.  Set a primary input & output device:

```javascript
const client = new Client({
  account,
  transport,
  media: {
    input: {
      id: undefined, // default input device
      audioProcessing: true,
      volume: 1.0,
      muted: false
    },
    output: {
      id: undefined, // default output device
      volume: 1.0,
      muted: false
    }
  }
});
```

1.  Change the primary I/O devices:

```javascript
client.defaultMedia.output.id = '230988012091820398213';
```

1.  Change the media of a session:

```javascript
const session = await client.invite('123');
session.media.input.volume = 50;
session.media.input.audioProcessing = false;
session.media.input.muted = true;
session.media.output.muted = false;
session.media.setInput({
  id: '120398120398123',
  audioProcessing: true,
  volume: 0.5,
  muted: true
});
```
