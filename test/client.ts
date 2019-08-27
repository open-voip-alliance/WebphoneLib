import test from 'ava';
import { testProp, fc } from 'ava-fast-check';
import * as sinon from 'sinon';

import { Client, ClientImpl } from '../src/client';
import * as Features from '../src/features';

function minimalOptions() {
  return {
    account: {
      user: '',
      password: '',
      uri: '',
      name: ''
    },
    transport: {
      wsServers: '',
      iceServers: []
    },
    media: {
      input: {
        id: '',
        volume: 1.0,
        audioProcessing: false,
        muted: false
      },
      output: {
        id: '',
        volume: 1.0,
        muted: false
      }
    }
  };
}

function createClientImpl(): ClientImpl {
  return new ClientImpl(minimalOptions());
}

function createClient() {
  return new Client(minimalOptions());
}

// https://stackoverflow.com/a/37900956
test.afterEach.always(() => {
  sinon.restore();
});

test.serial('cannot create client with unsupported browser', t => {
  sinon.stub(Features, 'checkRequired').returns(false);
  t.throws<Error>(createClientImpl);
});

test.serial('client is frozen', t => {
  console.log(Features.checkRequired);
  sinon.stub(Features, 'checkRequired').returns(true);

  const client = createClient();
  const sym = Symbol();
  t.throws<TypeError>(() => (client[sym] = 123));
  t.false(sym in client);

  t.throws<TypeError>(() => (client.connect = null));
  t.true(client.connect !== null);
});
