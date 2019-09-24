import test from 'ava';
import * as sinon from 'sinon';
import { UA as UABase } from 'sip.js';

import { ClientImpl } from '../src/client';
import { ClientStatus } from '../src/enums';
import * as Features from '../src/features';
import { Client, ClientOptions } from '../src/index';
import { ReconnectableTransport, TransportFactory } from '../src/transport';
import { IUA, UA, UAFactory } from '../src/ua';

import { createClientImpl, defaultTransportFactory, defaultUAFactory } from './_helpers';

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

  const error = await t.throwsAsync(() => client.connect());

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

test.serial('emits connecting status after connect is called', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const ua = sinon.createStubInstance(UA);
  ua.start.returns(ua as any);

  const client = createClientImpl(() => ua, defaultTransportFactory());

  // To make sure transportConnectedPromise can be overridden.
  (client as any).transport.configureUA((client as any).transport.uaOptions);

  // Resolve transportConnected asap so it wont throw a rejection.
  (client as any).transport.transportConnectedPromise = Promise.resolve(true);

  let status = '';
  client.on('statusUpdate', clientStatus => {
    t.log(clientStatus);
    status = clientStatus;
  });

  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);
  client.connect();

  // Make sure we wait not until connect is resolved (because it should hang on
  // awaiting registeredPromise as register event is never emitted).
  await new Promise(resolve => setTimeout(resolve, 5));

  // Shortly after calling connect ClientStatus should be CONNECTING.
  t.is((client as any).transport.status, ClientStatus.CONNECTING);
  t.is(status, ClientStatus.CONNECTING);
});

test.serial('emits connected status after register is emitted', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);

    // Let ua emit registered once ua is called.
    userAgent.register = () => userAgent.emit('registered') as any;
    userAgent.start = sinon.fake();

    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());

  // To make sure transportConnectedPromise can be overridden.
  (client as any).transport.configureUA((client as any).transport.uaOptions);

  // Resolve transportConnected asap so it wont throw a rejection.
  (client as any).transport.transportConnectedPromise = Promise.resolve(true);

  let status = '';
  client.on('statusUpdate', clientStatus => {
    t.log(clientStatus);
    status = clientStatus;
  });

  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);
  await client.connect();

  // After resolving connect ClientStatus should be CONNECTED.
  t.is((client as any).transport.status, ClientStatus.CONNECTED);
  t.is(status, ClientStatus.CONNECTED);
});

test.serial('emits disconnected status after registrationFailed is emitted', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);

    // Let ua emit registered once ua is called.
    userAgent.register = () =>
      userAgent.emit('registrationFailed', new Error('Something went wrong!')) as any;
    userAgent.start = sinon.fake();

    return userAgent;
  };

  const transport = (uaFactory: UAFactory, options: ClientOptions) => {
    const reconnectableTransport = new ReconnectableTransport(uaFactory, options);

    reconnectableTransport.disconnect = sinon.fake();

    return reconnectableTransport;
  };

  const client = createClientImpl(ua, transport);

  // To make sure transportConnectedPromise can be overridden.
  (client as any).transport.configureUA((client as any).transport.uaOptions);

  // Resolve transportConnected asap so it wont throw a rejection.
  (client as any).transport.transportConnectedPromise = Promise.resolve(true);

  let status = '';
  client.on('statusUpdate', clientStatus => {
    t.log(clientStatus);
    status = clientStatus;
  });

  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);

  const error = await t.throwsAsync(() => client.connect());

  // After rejecting connect (and subsequently disconnecting)
  // ClientStatus should be DISCONNECTED.
  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);
  t.is(status, ClientStatus.DISCONNECTED);
});

test.serial("rejects when transport doesn't connect within timeout", async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const ua = sinon.createStubInstance(UA);

  const client = createClientImpl(() => ua, defaultTransportFactory());

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.wsTimeout = 200; // setting timeout to 200 ms to avoid waiting 10s

  const error = await t.throwsAsync(() => client.connect());

  t.is(error.message, 'Could not connect to the websocket in time.');
});

test.serial('ua.start called on first connect', t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const ua = sinon.createStubInstance(UA);

  const client = createClientImpl(() => ua, defaultTransportFactory());

  // To make sure transportConnectedPromise can be overridden.
  (client as any).transport.configureUA((client as any).transport.uaOptions);

  // To avoid waiting for non-existant response from ua socket connection.
  (client as any).transport.transportConnectedPromise = Promise.resolve(true);

  client.connect();

  t.true(ua.start.called);
});
