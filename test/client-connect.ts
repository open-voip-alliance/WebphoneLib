import test from 'ava';
import * as sinon from 'sinon';
import { Core, UA as UABase } from 'sip.js';

import { Registerer } from 'sip.js/lib/api/registerer';
import { RegistererState } from 'sip.js/lib/api/registerer-state';
import { UserAgent } from 'sip.js/lib/api/user-agent';
import { UserAgentOptions } from 'sip.js/lib/api/user-agent-options';

import { ClientImpl } from '../src/client';
import { ClientStatus } from '../src/enums';
import * as Features from '../src/features';
import { Client, IClientOptions } from '../src/index';
import {
  ReconnectableTransport,
  TransportFactory,
  UAFactory,
  WrappedTransport
} from '../src/transport';

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

test.serial.cb('emits connecting status after connect is called', t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = sinon.createStubInstance(UserAgent, { start: Promise.resolve() });
  (ua as any).transport = sinon.createStubInstance(WrappedTransport, { on: sinon.fake() as any });
  const client = createClientImpl(() => (ua as unknown) as UserAgent, defaultTransportFactory());

  (client as any).transport.createRegisteredPromise = () => {
    (client as any).transport.registerer = sinon.createStubInstance(Registerer);
  };

  t.plan(3);
  client.on('statusUpdate', status => {
    // Shortly after calling connect ClientStatus should be CONNECTING.
    t.is(status, ClientStatus.CONNECTING);
    t.is((client as any).transport.status, ClientStatus.CONNECTING);
    t.end();
  });

  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);

  client.connect();
});

test.serial('emits connected status after register is emitted', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const uaFactory = (options: UserAgentOptions) => {
    const userAgent = new UserAgent(options);
    userAgent.start = () => Promise.resolve();
    return userAgent;
  };

  const client = createClientImpl(uaFactory, defaultTransportFactory());

  t.plan(3);
  client.on('statusUpdate', status => {
    if (status === ClientStatus.CONNECTED) {
      t.is(status, ClientStatus.CONNECTED);
    }
  });

  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);

  (client as any).transport.createRegisteredPromise = () => {
    (client as any).transport.registerer = sinon.createStubInstance(Registerer);
    (client as any).transport.updateStatus(ClientStatus.CONNECTED);
    return Promise.resolve();
  };

  await (client as any).transport.connect();

  // After resolving connect ClientStatus should be CONNECTED.
  t.is((client as any).transport.status, ClientStatus.CONNECTED);
});

test.serial('emits disconnected status after registrationFailed is emitted', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const uaFactory = (options: UserAgentOptions) => {
    const userAgent = new UserAgent(options);
    userAgent.start = () => Promise.resolve();
    return userAgent;
  };

  const transport = (ua: UAFactory, options: IClientOptions) => {
    const reconnectableTransport = new ReconnectableTransport(ua, options);
    reconnectableTransport.disconnect = sinon.fake();
    return reconnectableTransport;
  };

  const client = createClientImpl(uaFactory, transport);

  t.plan(4);
  client.on('statusUpdate', status => {
    if (status === ClientStatus.DISCONNECTED) {
      t.is(status, ClientStatus.DISCONNECTED);
    }
  });

  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);

  (client as any).transport.createRegisteredPromise = () => {
    (client as any).transport.registerer = sinon.createStubInstance(Registerer);
    (client as any).transport.updateStatus(ClientStatus.DISCONNECTED);
    return Promise.reject(new Error('Could not register.'));
  };

  const error = await t.throwsAsync(() => client.connect());

  // After rejecting connect (and subsequently disconnecting)
  // ClientStatus should be DISCONNECTED.
  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);
});

test.serial("rejects when transport doesn't connect within timeout", async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const uaFactory = (options: UserAgentOptions) => {
    const userAgent = new UserAgent(options);
    userAgent.start = () => {
      return new Promise(resolve => {
        setTimeout(() => resolve(), 250);
      });
    };
    return userAgent;
  };

  const client = createClientImpl(uaFactory, defaultTransportFactory());

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.wsTimeout = 200; // setting timeout to 200 ms to avoid waiting 10s

  const error = await t.throwsAsync(() => (client as any).transport.connect());
  t.is(error.message, 'Could not connect to the websocket in time.');
});

test.serial('ua.start called on first connect', t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const ua = sinon.createStubInstance(UserAgent, { start: Promise.resolve() });
  (ua as any).transport = sinon.createStubInstance(WrappedTransport, { on: sinon.fake() as any });

  const client = createClientImpl(() => (ua as unknown) as UserAgent, defaultTransportFactory());

  (client as any).transport.createRegisteredPromise = () => {
    (client as any).transport.registerer = sinon.createStubInstance(Registerer);
  };

  client.connect();

  t.true(ua.start.called);
});
