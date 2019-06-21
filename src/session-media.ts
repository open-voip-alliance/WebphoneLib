import { WrappedInviteClientContext, WrappedInviteServerContext } from './ua';

import { audioContext } from './audio-context';
import { IMedia, IMediaInput, IMediaOutput } from './types';
import { closeStream } from './utils';

interface IRTCPeerConnectionLegacy extends RTCPeerConnection {
  getRemoteStreams: () => MediaStream[];
  getLocalStreams: () => MediaStream[];
}

export type InternalSession = WrappedInviteClientContext &
  WrappedInviteServerContext & {
    sessionDescriptionHandler: {
      peerConnection: IRTCPeerConnectionLegacy;
    };

    __streams: {
      localStream: MediaStream;
      remoteStream: MediaStream;
    };

    __media: SessionMedia;
  };

export class SessionMedia implements IMedia {
  public readonly input: IMediaInput;
  public readonly output: IMediaOutput;

  private session: InternalSession;

  private media: IMedia;
  private audioOutput: HTMLAudioElement;
  private inputStream: MediaStream;
  private inputNode: GainNode;

  public constructor(session: InternalSession, media: IMedia) {
    this.session = session;

    // This link is for the custom SessionDescriptionHandler.
    session.__media = this;

    // Make a copy of media.
    this.media = {
      input: Object.assign({}, media.input),
      output: Object.assign({}, media.output)
    };

    const self = this;

    // prettier-ignore
    this.input = {
      get id() { return self.media.input.id; },
      set id(value) { self.setInputDevice(value); },
      get audioProcessing() { return self.media.input.audioProcessing; },
      set audioProcessing(value) { self.setInputAudioProcessing(value); },
      get volume() { return self.media.input.volume; },
      set volume(value) { self.setInputVolume(value); },
      get muted() { return self.media.input.muted; },
      set muted(value) { self.setInputMuted(value); }
    };

    // prettier-ignore
    this.output = {
      get id() { return self.media.output.id; },
      set id(value) { self.setOutputDevice(value); },
      get volume() { return self.media.output.volume; },
      set volume(value) { self.setOutputVolume(value); },
      get muted() { return self.media.output.muted; },
      set muted(value) { self.setOutputMuted(value); }
    };
  }

  public async setInput(newInput?: IMediaInput): Promise<void> {
    if (newInput === undefined) {
      newInput = this.media.input;
    }

    // First open a new stream, then close the old one.
    const constraints = getInputConstraints(newInput);
    const newInputStream = await navigator.mediaDevices.getUserMedia(constraints);
    // Close the old inputStream and disconnect from WebRTC.
    if (this.inputStream) {
      closeStream(this.inputStream);
      this.inputNode.disconnect();
    }

    this.inputStream = newInputStream;
    const sourceNode = audioContext.createMediaStreamSource(newInputStream);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = newInput.volume;
    sourceNode.connect(gainNode);

    // If muted; don't connect the node to the local stream.
    if (!newInput.muted) {
      gainNode.connect(this.session.__streams.localStream);
    }
    this.inputNode = gainNode;
    this.media.input = newInput;
  }

  public async setOutput(newOutput?: IMediaOutput): Promise<void> {
    if (newOutput === undefined) {
      newOutput = this.media.output;
    }

    // Create the new audio output.
    const audio = new Audio();
    audio.volume = newOutput.volume;
    audio.muted = newOutput.muted;

    // Attach it to the correct output device.
    await audioContext.resume();
    if (newOutput.id) {
      await (audio as any).setSinkId(newOutput.id);
    }

    // Close the old audio output.
    if (this.audioOutput) {
      // HTMLAudioElement can't be stopped, but pause should have the same
      // effect. It should be garbage collected if we don't keep references to
      // it.
      this.audioOutput.pause();
      this.audioOutput.srcObject = undefined;
    }

    this.audioOutput = audio;
    this.media.output = newOutput;
    audio.srcObject = this.session.__streams.remoteStream;

    // This can fail if autoplay is not yet allowed.
    await audio.play();
  }


  private setInputDevice(id: string | undefined) {
    this.setInput(Object.assign({}, this.media.input, { id }));
  }

  private setInputAudioProcessing(audioProcessing: boolean) {
    this.setInput(Object.assign({}, this.media.input, { audioProcessing }));
  }

  private setInputVolume(newVolume: number) {
    if (this.inputNode) {
      this.inputNode.gain.value = newVolume;
    }
    this.media.input.volume = newVolume;
  }

  private setInputMuted(newMuted: boolean) {
    if (this.inputNode) {
      if (newMuted) {
        this.inputNode.disconnect();
      } else {
        this.inputNode.connect(this.session.__streams.localStream);
      }
    }

    this.media.input.muted = newMuted;
  }

  private setOutputDevice(id: string | undefined) {
    this.setOutput(Object.assign({}, this.media.output, { id }));
  }

  private setOutputVolume(newVolume: number) {
    if (this.audioOutput) {
      this.audioOutput.volume = newVolume;
    }
    this.media.output.volume = newVolume;
  }

  private setOutputMuted(newMuted: boolean) {
    if (this.audioOutput) {
      this.audioOutput.muted = newMuted;
    }

    this.media.output.muted = newMuted;
  }
}

function getInputConstraints(input: IMediaInput): MediaStreamConstraints {
  const presets = input.audioProcessing
    ? {}
    : {
        echoCancellation: false,
        googAudioMirroring: false,
        googAutoGainControl: false,
        googAutoGainControl2: false,
        googEchoCancellation: false,
        googHighpassFilter: false,
        googNoiseSuppression: false,
        googTypingNoiseDetection: false
      };

  const constraints: MediaStreamConstraints = { audio: presets, video: false };
  if (input.id) {
    (constraints.audio as MediaTrackConstraints).deviceId = input.id;
  }

  return constraints;
}
