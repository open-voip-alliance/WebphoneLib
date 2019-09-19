# Open VoIP Alliance Webphone Lib
![npm](https://img.shields.io/npm/v/webphone-lib?style=flat-square)

Makes calling easier by providing a layer of abstraction around SIP.js. To figure out why we did this, [read our blog](https://openvoipalliance.org/link-to-blog).

## Cool stuff

- Allows you to switch audio devices mid-call.
- Automatically recover calls on connectivity loss.
- Offers an easy-to-use modern javascript api.

## Getting started

```
$ git clone git@github.com:open-voip-alliance/WebphoneLib.git
$ cd WebphoneLib
$ echo 'export const authorizationUser = <your-voip-account-id>; export const password = '<your-voip-password>'; export const uri = `sip:${authorizationUser}@voipgrid.nl`;' > demo/creds.js
$ npm i && npm run demo
```

And then open up http://localhost:1235/demo/ in your browser. 

## Examples

### Connecting and registering

```javascript
import { Client } from 'webphone-lib';

const account = {
  user: 'accountId',
  password: 'password',
  uri: 'sip:accountId@voipgrid.nl',
  name: 'test'
};

const transport = {
  wsServers: 'wss://websocket.voipgrid.nl',
  iceServers: []
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

### Incoming call

```javascript
// incoming call below
client.on('invite', (session) => {
  try {
    ringer();

    let accepted = await session.accepted(); // wait until the call is picked up
    if (!accepted) {
      return;
    }

    showCallScreen();

    await session.terminated();
  } catch (e) {
    showErrorMessage(e)
  } finally {
    closeCallScreen();
  }
});
```

### Outgoing call

```javascript
const session = client.invite('sip:518@voipgrid.nl');

try {
  showOutgoingCallInProgress();

  let isAccepted = await session.accepted(); // wait until the call is picked up
  if (!isAccepted) {
    showRejectedScreen();
    return;
  }

  showCallScreen();

  await session.terminated();
} catch (e) {
} finally {
  closeCallScreen();
}
```

## Attended transfer of a call

```javascript
if (await session.accepted()) {
  await session.hold();

  const other = client.invite('sip:519@voipgrid.nl');
  if (await other.accepted()) {
    await session.attendedTransfer(other); // immediately transfer after the other party picked up :p 

    await session.terminated();
  }
}
```

## Audio device selection

#### Set a primary input & output device:

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

#### Change the primary I/O devices:

```javascript
client.defaultMedia.output.id = '230988012091820398213';
```

#### Change the media of a session:

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

## Join us!

Feel free to tell us what you need. Create an issue, create a pull request for an issue, or if you're not really sure, ask us. We're often hanging around in the [XMPP open-voip-alliance chat](https://xmpp.openvoipalliance.org/).

## Commands

| Command                   | Help                                                                            |
| ------------------------- | ------------------------------------------------------------------------------- |
| npm run docs              | Generate the docs                                                               |
| npm run test              | Run the tests                                                                   |
| npm run test -- --verbose | Show output of `console.log` during tests                                       |
| npm run test-watch        | Watch the tests as you make changes                                             |
| npm run build             | Build the projects                                                              |
| npm run prepare           | Prepare the project for publish, this is automatically run before `npm publish` |
| npm run lint              | Run `tslint` over the source files                                              |
| npm run typecheck         | Verifies type constraints are met                                               |

## Generate documentation

[Typedoc](https://typedoc.org/guides/doccomments/) is used to generate the
documentation from the `jsdoc` comments in the source code. See [this
link](https://typedoc.org/guides/doccomments/) for more information on which
`jsdoc` tags are supported.
