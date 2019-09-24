import test from 'ava';
import * as sinon from 'sinon';
import { Subscription } from 'sip.js';

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

test.serial('do not try to disconnect when already disconnected', async t => {
  sinon.stub(Features, 'checkRequired').returns(true);
  log.info = sinon.fake();

  const client = createClientImpl(defaultUAFactory(), defaultTransportFactory());

  await client.disconnect();

  t.true((log.info as any).calledWith('Already disconnected.'));
});
