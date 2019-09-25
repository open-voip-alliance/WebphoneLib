import test from 'ava';
import * as sinon from 'sinon';
import { Subscription, UA as UABase } from 'sip.js';
import pTimeout from 'p-timeout';

import { ClientImpl } from '../src/client';
import { ClientStatus } from '../src/enums';
import * as Features from '../src/features';
import { Client, ClientOptions } from '../src/index';
import { log } from '../src/logger';
import { ReconnectableTransport, TransportFactory } from '../src/transport';
import { IUA, UA, UAFactory } from '../src/ua';

import { createClientImpl, defaultTransportFactory, defaultUAFactory } from './_helpers';

test.serial('remove subscriptions', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const transport = sinon.createStubInstance(ReconnectableTransport);
  const client = createClientImpl(defaultUAFactory(), () => transport);
  const uaSession = sinon.createStubInstance(Subscription);

  (client as any).subscriptions = { '1337@someprovider': uaSession };
  await client.disconnect();

  t.deepEqual((client as any).subscriptions, {});
});

test.serial('do not try to disconnect when already disconnected (no ua)', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  log.info = sinon.fake();

  const client = createClientImpl(defaultUAFactory(), defaultTransportFactory());

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

  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);
    userAgent.unregister = () => userAgent.emit('unregistered') as any;
    userAgent.disconnect = sinon.fake();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());

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

  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);
    userAgent.disconnect = sinon.fake();
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

test.serial('ua.disconnect is not called before unregistered', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);
    userAgent.disconnect = sinon.fake();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());

  const status = [];
  client.on('statusUpdate', clientStatus => status.push(clientStatus));

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  // Wait for 100 ms and catch the error thrown because it never resolves.
  await t.throwsAsync(pTimeout(client.disconnect(), 100));

  t.false((client as any).transport.ua.disconnect.called);
});

test.serial('ua is removed after ua.disconnect', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);
    userAgent.disconnect = sinon.fake();
    userAgent.unregister = () => userAgent.emit('unregistered') as any;
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  t.false((client as any).transport.ua === undefined);

  await client.disconnect();

  t.true((client as any).transport.ua === undefined);
});

// This test needs to be fixed
test.serial.failing('not waiting for unregistered if hasRegistered = false', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);
    userAgent.disconnect = sinon.fake();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());
  client.disconnect = async () => {
    await this.transport.disconnect({ hasRegistered: false });
    this.subscriptions = {};
  };

  client.disconnect.bind(client);

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
