import test from 'ava';
import * as sinon from 'sinon';

import * as Features from '../src/features';
import {
  createClient,
  createClientImpl,
  defaultTransportFactory,
  defaultUAFactory
} from './_helpers';

test.afterEach(() => {
  sinon.restore();
});

test.serial('cannot create client with unsupported browser', t => {
  // Temporarily remove RTCPeerConnection to make browser unsupported
  const originalRTCPeerConnection = (window as any).RTCPeerConnection;
  delete (window as any).RTCPeerConnection;

  try {
    t.throws<Error>(() => createClientImpl(defaultUAFactory(), defaultTransportFactory()));
  } finally {
    // Restore RTCPeerConnection
    (window as any).RTCPeerConnection = originalRTCPeerConnection;
  }
});

test.serial('client is frozen', t => {
  const client = createClient();

  // Extending client is not allowed.
  const sym = Symbol();
  t.throws<TypeError>(() => {
    'use strict';
    (client as any)[sym] = 123;
  });
  t.false(sym in client);

  // Changing properties is not allowed.
  t.throws<TypeError>(() => {
    'use strict';
    (client as any).connect = null;
  });
  t.true(client.connect !== null);
});
