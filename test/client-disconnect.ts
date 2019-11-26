import test from 'ava';
import pTimeout from 'p-timeout';
import * as sinon from 'sinon';
import { Subscription, UA as UABase } from 'sip.js';

import { UserAgent } from 'sip.js/lib/api/user-agent';
import { UserAgentOptions } from 'sip.js/lib/api/user-agent-options';

import { ClientImpl } from '../src/client';
import { ClientStatus } from '../src/enums';
import * as Features from '../src/features';
import { Client, IClientOptions } from '../src/index';
import { log } from '../src/logger';
import { ReconnectableTransport, TransportFactory, UAFactory } from '../src/transport';

import { createClientImpl, defaultTransportFactory, defaultUAFactory } from './_helpers';

test.serial('remove subscriptions', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const transport = sinon.createStubInstance(ReconnectableTransport);
  const client = createClientImpl(defaultUAFactory(), () => transport);
  const subscription = sinon.createStubInstance(Subscription);

  (client as any).subscriptions = { '1337@someprovider': subscription };
  await client.disconnect();

  t.deepEqual((client as any).subscriptions, {});
});

test.serial('do not try to disconnect when already disconnected (no ua)', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  log.info = sinon.fake();

  const client = createClientImpl(defaultUAFactory(), defaultTransportFactory());

  // UA is not configured here.
  (client as any).transport.status = ClientStatus.CONNECTED;

  await client.disconnect();

  t.true((log.info as any).calledWith('Already disconnected.'));
});

test.serial('do not try to disconnect when already disconnected (status DISCONNECTED)', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  log.info = sinon.fake();

  const client = createClientImpl(defaultUAFactory(), defaultTransportFactory());

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.DISCONNECTED;

  await client.disconnect();

  t.true((log.info as any).calledWith('Already disconnected.'));
});

test.serial('status updates in order: DISCONNECTING > DISCONNECTED', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = (options: UserAgentOptions) => {
    const userAgent = new UserAgent(options);
    userAgent.stop = () => Promise.resolve();
    userAgent.transport.disconnect = () => Promise.resolve();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());
  (client as any).transport.createUnregisteredPromise = () => {
    (client as any).transport.unregisteredPromise = () => Promise.resolve();
    (client as any).transport.unregisterer = sinon.fake();
    (client as any).transport.unregisterer.unregister = () => sinon.fake();
  };

  const status = [];
  client.on('statusUpdate', clientStatus => status.push(clientStatus));

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  await client.disconnect();

  t.is(status.length, 2);
  t.is(status[0], ClientStatus.DISCONNECTING);
  t.is(status[1], ClientStatus.DISCONNECTED);
  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);
});

test.serial('disconnected does not resolve until unregistered', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = (options: UserAgentOptions) => {
    const userAgent = new UserAgent(options);
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());

  const status = [];
  client.on('statusUpdate', clientStatus => status.push(clientStatus));

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  // Wait for 100 ms and catch the error thrown because it never resolves.
  await t.throwsAsync(pTimeout(client.disconnect(), 100));

  t.is(status.length, 1);
  t.is(status[0], ClientStatus.DISCONNECTING);
  t.is((client as any).transport.status, ClientStatus.DISCONNECTING);
});

test.serial('ua.stop is not called without unregistered event', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = (options: UserAgentOptions) => {
    const userAgent = new UserAgent(options);
    userAgent.stop = sinon.fake();
    userAgent.transport.disconnect = () => Promise.resolve();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  // calling ua.unregister will not cause ua to emit an unregistered event.
  // ua.disconnected will never be called as it waits for the unregistered
  // event.
  await t.throwsAsync(pTimeout(client.disconnect(), 100));

  t.false((client as any).transport.userAgent.stop.called);
});

test.serial('ua is removed after ua.disconnect', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = (options: UserAgentOptions) => {
    const userAgent = new UserAgent(options);
    userAgent.stop = sinon.fake();
    userAgent.transport.disconnect = () => Promise.resolve();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());
  (client as any).transport.createUnregisteredPromise = () => {
    (client as any).transport.unregisteredPromise = () => Promise.resolve();
    (client as any).transport.unregisterer = sinon.fake();
    (client as any).transport.unregisterer.unregister = () => sinon.fake();
  };

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  t.false((client as any).transport.userAgent === undefined);

  await client.disconnect();

  t.true((client as any).transport.userAgent === undefined);
});

test.serial('not waiting for unregistered if hasRegistered = false', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const ua = (options: UserAgentOptions) => {
    const userAgent = new UserAgent(options);
    userAgent.stop = sinon.fake();
    userAgent.transport.disconnect = () => Promise.resolve();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());
  client.disconnect = async () => {
    await (client as any).transport.disconnect({ hasRegistered: false });
  };

  const status = [];
  client.on('statusUpdate', clientStatus => status.push(clientStatus));

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  await client.disconnect();

  t.is(status.length, 2);
  t.is(status[0], ClientStatus.DISCONNECTING);
  t.is(status[1], ClientStatus.DISCONNECTED);
  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);
});
