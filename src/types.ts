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

export interface IWebCallingClientOptions {
  account: IAccount;
  transport: ITransport;
}

