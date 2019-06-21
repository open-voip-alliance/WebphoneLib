import { ReconnectionMode, ReconnectionStrategy } from './enums';

export interface IAccount {
  user: string;
  password: string;
  uri: string;
  name: string;
}

export interface ITransport {
  wsServers: string;
  iceServers: string[];
}

export interface IClientOptions {
  account: IAccount;
  transport: ITransport;
  media: IMedia;
  // reconnectionStrategy: ReconnectionStrategy; should we add this?
}

export interface IMediaDevice {
  // undefined means let the browser pick the default.
  id: string | undefined;

  volume: number;
  muted: boolean;
}

export interface IMediaInput extends IMediaDevice {
  audioProcessing: boolean;
}

// tslint:disable-next-line
export interface IMediaOutput extends IMediaDevice {}

export interface IMedia {
  input: IMediaInput;
  output: IMediaOutput;
}

export interface IRemoteIdentity {
  phoneNumber: string;
  displayName: string;
}

export interface IRetry {
  interval: number;
  limit: number;
  timeout: number;
}
