import test from 'ava';
import * as sinon from 'sinon';
import { Subscription, UA as UABase } from 'sip.js';

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

  t.is((client as any).transport.status, ClientStatus.DISCONNECTED);
  t.log(status);
  t.is(status[0], ClientStatus.DISCONNECTING);
  t.is(status[1], ClientStatus.DISCONNECTED);
});
