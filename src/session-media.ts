import { EventEmitter } from 'events';

import { Session } from 'sip.js/lib/api/session';
import { IncomingInviteRequest } from 'sip.js/lib/core';
import { audioContext } from './audio-context';
import * as Features from './features';
import { clamp } from './lib/utils';
import { log } from './logger';
import { Media } from './media';
import { SessionImpl } from './session';
import { IMedia, IMediaInput, IMediaOutput } from './types';

interface IRTCPeerConnectionLegacy extends RTCPeerConnection {
  getRemoteStreams: () => MediaStream[];
  getLocalStreams: () => MediaStream[];
}

export type InternalSession = Session & {
  _sessionDescriptionHandler: {
    peerConnection: IRTCPeerConnectionLegacy;
  };

  __streams: {
    localStream: MediaStreamAudioDestinationNode;
    remoteStream: MediaStream;
  };

  __media: SessionMedia;

  on(
    event: 'reinvite',
    listener: (session: InternalSession, request: IncomingInviteRequest) => void
  ): InternalSession;
};

interface ISessionMedia extends IMedia {
  on(event: 'setupFailed', listener: () => void): this;
}

export class SessionMedia extends EventEmitter implements ISessionMedia {
  public readonly input: IMediaInput;
  public readonly output: IMediaOutput;

  private session: SessionImpl;

  private media: IMedia;
  private audioOutput: HTMLAudioElement;
  private inputStream: MediaStream;
  private inputNode: GainNode;

  public constructor(session: SessionImpl, media: IMedia) {
    super();

    this.session = (session as any).session;

    // This link is for the custom SessionDescriptionHandler.
    (this.session as any).__media = this;

    // Make a copy of media.
    this.media = {
      input: Object.assign({}, media.input),
      output: Object.assign({}, media.output)
    };

    session.on('terminated', () => {
      this.stopInput();
      this.stopOutput();
    });

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
    const newInputStream = await Media.openInputStream(newInput);
    // Close the old inputStream and disconnect from WebRTC.
    this.stopInput();

    this.inputStream = newInputStream;
    const sourceNode = audioContext.createMediaStreamSource(newInputStream);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = newInput.volume;
    sourceNode.connect(gainNode);

    // If muted; don't connect the node to the local stream.
    if (!newInput.muted) {
      gainNode.connect((this.session as any).__streams.localStream);
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
    audio.volume = clamp(newOutput.volume, 0.0, 1.0);
    audio.muted = newOutput.muted;

    // Attach it to the correct output device.
    await audioContext.resume();
    if (newOutput.id) {
      if (Features.webaudio.setSinkId) {
        await (audio as any).setSinkId(newOutput.id);
      } else {
        log.warn('cannot set output device: setSinkId is not supported', 'session-media');
      }
    }

    // Close the old audio output.
    this.stopOutput();

    this.audioOutput = audio;
    this.media.output = newOutput;
    audio.srcObject = (this.session as any).__streams.remoteStream;

    // This can fail if autoplay is not yet allowed.
    await audio.play();
  }

  private setInputDevice(id: string | undefined) {
    this.setInput(Object.assign({}, this.media.input, { id }));
  }

  private setInputAudioProcessing(audioProcessing: boolean) {
    log.debug(`setting audioProcessing to: ${audioProcessing}`, 'media');
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
        this.inputNode.connect((this.session as any).__streams.localStream);
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

  private stopInput() {
    if (this.inputStream) {
      Media.closeStream(this.inputStream);
      this.inputNode.disconnect();
    }
  }

  private stopOutput() {
    if (this.audioOutput) {
      // HTMLAudioElement can't be stopped, but pause should have the same
      // effect. It should be garbage collected if we don't keep references to
      // it.
      this.audioOutput.pause();
      this.audioOutput.srcObject = undefined;
    }
  }
}
