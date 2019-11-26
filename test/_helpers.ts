import test from 'ava';
import * as sinon from 'sinon';
import { UA as UABase } from 'sip.js';

import { UserAgent } from 'sip.js/lib/api/user-agent';
import { UserAgentOptions } from 'sip.js/lib/api/user-agent-options';

import { ClientImpl } from '../src/client';
import { ClientStatus } from '../src/enums';
import * as Features from '../src/features';
import { Client, IClientOptions } from '../src/index';
import { ReconnectableTransport, TransportFactory, UAFactory } from '../src/transport';

export function defaultUAFactory() {
  return (options: UserAgentOptions) => new UserAgent(options);
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
