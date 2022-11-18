import test from 'ava';
import * as sinon from 'sinon';

import * as Features from '../src/features';
import {
  createClient,
  createClientImpl,
  defaultTransportFactory,
  defaultUAFactory
} from './_helpers';

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
