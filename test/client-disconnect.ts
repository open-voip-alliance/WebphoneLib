import test from 'ava';
import pTimeout from 'p-timeout';
import * as sinon from 'sinon';
import { Subscription, UA as UABase } from 'sip.js';

import { ClientImpl } from '../src/client';
import { ClientStatus } from '../src/enums';
import * as Features from '../src/features';
import { Client, IClientOptions } from '../src/index';
import { log } from '../src/logger';
import { ReconnectableTransport, TransportFactory } from '../src/transport';
import { IUA, UA, UAFactory } from '../src/ua';

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

  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);
    userAgent.unregister = () => userAgent.emit('unregistered') as any;
    userAgent.disconnect = sinon.fake();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());

  t.plan(3);
  client.on('statusUpdate', status => {
    if (status === ClientStatus.DISCONNECTING) {
      t.is(status, ClientStatus.DISCONNECTING);
    } else if (status === ClientStatus.DISCONNECTED) {
      t.is(status, ClientStatus.DISCONNECTED);
    }
  });

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  await client.disconnect();

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

  t.plan(3);
  client.on('statusUpdate', status => {
    t.is(status, ClientStatus.DISCONNECTING);
  });

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  // Wait for 100 ms and catch the error thrown because it never resolves.
  await t.throwsAsync(pTimeout(client.disconnect(), 100));

  t.is((client as any).transport.status, ClientStatus.DISCONNECTING);
});

test.serial('ua.disconnect is not called without unregistered event', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);

  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);
    userAgent.disconnect = sinon.fake();
    userAgent.unregister = sinon.fake();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  // calling ua.unregister will not cause ua to emit an unregistered event.
  // ua.disconnected will never be called as it waits for the unregistered
  // event.
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

test.serial('not waiting for unregistered if hasRegistered = false', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  const ua = (options: UABase.Options) => {
    const userAgent = new UA(options);
    userAgent.disconnect = sinon.fake();
    return userAgent;
  };

  const client = createClientImpl(ua, defaultTransportFactory());
  client.disconnect = async () => {
    await (client as any).transport.disconnect({ hasRegistered: false });
  };

  t.plan(3);
  client.on('statusUpdate', status => {
    if (status === ClientStatus.DISCONNECTING) {
      t.is(status, ClientStatus.DISCONNECTING);
    } else if (status === ClientStatus.DISCONNECTED) {
      t.is(status, ClientStatus.DISCONNECTED);
    }
  });

  (client as any).transport.configureUA((client as any).transport.uaOptions);
  (client as any).transport.status = ClientStatus.CONNECTED;

  await client.disconnect();

  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);
});
