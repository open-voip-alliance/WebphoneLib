# Open VoIP Alliance Webphone Lib

![npm](https://img.shields.io/npm/v/webphone-lib?style=flat-square)

Makes calling easier by providing a layer of abstraction around SIP.js. To figure out why we made this, read [our blog post](https://wearespindle.com/articles/how-to-abstract-the-complications-of-sip-js-away-with-our-library/).

## Documentation

Check out the documentation [here](https://open-voip-alliance.github.io/WebphoneLib/).

## Cool stuff

- Allows you to switch audio devices mid-call.
- Automatically recovers calls on connectivity loss.
- Offers an easy-to-use modern javascript api.

## Join us!

We would love more input for this project. Create an issue, create a pull request for an issue, or if you're not really sure, ask us. We're often hanging around on [discourse](https://discourse.openvoipalliance.org/). We would also love to hear your thoughts and feedback on our project and answer any questions you might have!

## Getting started

```bash
$ git clone git@github.com:open-voip-alliance/WebphoneLib.git
$ cd WebphoneLib
$ touch demo/config.js
```

Add the following to `demo/config.js`:

```javascript
export const authorizationUserId = <your-voip-account-id>;
export const password = '<your-voip-password>';
export const yourPlatformURL = '<your-platform-url>'
export const accountUri = `sip:${authorizationUserId}@${yourPlatformURL}`;
export const subscribeTo = `sip:<account-id>@${yourPlatformURL}`;
export const outgoingCallTo = `sip:<account-id>@${yourPlatformURL}`;
export const blindTransferTo = `sip:<account-id>@${yourPlatformURL}`;
export const attendedTransferTo = `sip:<account-id>@${yourPlatformURL}`;
```

Run the demo-server:

```bash
$ npm i && npm run demo
```

And then play around at http://localhost:1235/demo/.

## Examples

### Connecting and registering

```javascript
import { Client } from 'webphone-lib';

const account = {
  user: 'accountId',
  password: 'password',
  uri: 'sip:accountId@<your-platform-url>',
  name: 'test'
};

const transport = {
  wsServers: 'wss://websocket.<your-platform-url>', // or replace with your
  iceServers: [] // depending on if your provider needs STUN/TURN.
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

    let { accepted, rejectCause } = await session.accepted(); // wait until the call is picked up
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
const session = client.invite('sip:518@<your-platform-url>');

try {
  showOutgoingCallInProgress();

  let { accepted, rejectCause } = await session.accepted(); // wait until the call is picked up
  if (!accepted) {
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
if (await sessionA.accepted()) {
  await sessionA.hold();

  const sessionB = client.invite('sip:519@<your-platform-url>');
  if (await sessionB.accepted()) {
    // immediately transfer after the other party picked up :p
    await client.attendedTransfer(sessionA, sessionB);

    await sessionB.terminated();
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
