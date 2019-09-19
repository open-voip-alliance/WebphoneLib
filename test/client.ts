import test from 'ava';
import * as sinon from 'sinon';
import { UA as UABase } from 'sip.js';

import { ClientImpl } from '../src/client';
import { ClientStatus } from '../src/enums';
import * as Features from '../src/features';
import { Client, ClientOptions } from '../src/index';
import { ReconnectableTransport, TransportFactory } from '../src/transport';
import { IUA, UA, UAFactory } from '../src/ua';

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

function defaultUAFactory() {
  return (options: UABase.Options) => new UA(options);
}

function defaultTransportFactory() {
  return (uaFactory: UAFactory, options: ClientOptions) =>
    new ReconnectableTransport(uaFactory, options);
}

function createClientImpl(uaFactory: UAFactory, transportFactory: TransportFactory): ClientImpl {
  return new ClientImpl(uaFactory, transportFactory, minimalOptions());
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
  t.throws<Error>(() => createClientImpl(defaultUAFactory(), defaultTransportFactory()));
});

test.serial('client is frozen', t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const client = createClient();

  // Extending client is not allowed.
  const sym = Symbol();
  t.throws<TypeError>(() => (client[sym] = 123));
  t.false(sym in client);

  // Changing properties is not allowed.
  t.throws<TypeError>(() => (client.connect = null));
  t.true(client.connect !== null);
});

test.serial('client connect', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const transport = sinon.createStubInstance(ReconnectableTransport);
  transport.connect.returns(Promise.resolve());
  transport.disconnect.returns(Promise.resolve());

  const client = createClientImpl(defaultUAFactory(), () => transport);
  await client.connect();
  t.true(transport.connect.called);
});

test.serial('cannot connect client when recovering', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const client = createClientImpl(defaultUAFactory(), defaultTransportFactory());
  (client as any).transport.status = ClientStatus.RECOVERING;

  const error = await t.throwsAsync(() => {
    return client.connect();
  });

  t.is(error.message, 'Can not connect while trying to recover.');
});

test.serial('return true when already connected', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const client = createClientImpl(defaultUAFactory(), defaultTransportFactory());

  (client as any).transport.registeredPromise = Promise.resolve(true);
  (client as any).transport.status = ClientStatus.CONNECTED;

  const connected = client.connect();

  t.true(await connected);
});

test.serial('ua.start called on first connect', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const ua = sinon.createStubInstance(UA);
  ua.start.returns(ua as any);

  const client = createClientImpl(() => ua, defaultTransportFactory());

  // To make sure transportConnectedPromise can be overridden.
  (client as any).transport.configureUA((client as any).transport.uaOptions);

  // To avoid waiting for non-existant response from ua socket connection.
  (client as any).transport.transportConnectedPromise = Promise.resolve(true);

  client.connect();

  t.true(ua.start.called);
});
