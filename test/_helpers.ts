import test from 'ava';
import * as sinon from 'sinon';
import { UA as UABase } from 'sip.js';

import { ClientImpl } from '../src/client';
import { ClientStatus } from '../src/enums';
import * as Features from '../src/features';
import { Client, IClientOptions } from '../src/index';
import { ReconnectableTransport, TransportFactory } from '../src/transport';
import { IUA, UA, UAFactory } from '../src/ua';

export function defaultUAFactory() {
  return (options: UABase.Options) => new UA(options);
}

export function defaultTransportFactory() {
  return (uaFactory: UAFactory, options: IClientOptions) =>
    new ReconnectableTransport(uaFactory, options);
}

export function createClientImpl(
  uaFactory: UAFactory,
  transportFactory: TransportFactory
): ClientImpl {
  return new ClientImpl(uaFactory, transportFactory, minimalOptions());
}

export function createClient() {
  return new Client(minimalOptions());
}

export function minimalOptions() {
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

// https://stackoverflow.com/a/37900956
test.afterEach.always(() => {
  sinon.restore();
});
