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
  media: IMedia;
}

/**
 * A MediaInput is a function that returns an AudioNode. The most basic
 * implementation is `Media.openDevice`, which when invoked without parameters
 * will open the default microphone.
 *
 * Other devices can be used as input by making an anonymous function wrapping
 * the device id: `() => Media.openDevice('123', audioProcessing=false)`
 */
export type MediaInput = () => Promise<AudioNode>;

/**
 * A function that plays the `stream` on some audio output device. Resulting
 * `Promise` must resolve when the `stream` is attached and ready to receive
 * audio data.
 */
export type MediaOutput = (stream: MediaStream) => Promise<void>;


export interface IMedia {
  input: MediaInput;
  output: MediaOutput;
}
