import { EventEmitter } from 'events';
import { audioContext } from './audio-context';

// As short as possible mp3 file.
// source: https://gist.github.com/westonruter/253174
// prettier-ignore
const audioTestSample = 'data:audio/mpeg;base64,/+MYxAAAAANIAUAAAASEEB/jwOFM/0MM/90b/+RhST//w4NFwOjf///PZu////9lns5GFDv//l9GlUIEEIAAAgIg8Ir/JGq3/+MYxDsLIj5QMYcoAP0dv9HIjUcH//yYSg+CIbkGP//8w0bLVjUP///3Z0x5QCAv/yLjwtGKTEFNRTMuOTeqqqqqqqqqqqqq/+MYxEkNmdJkUYc4AKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

interface IAudioHelper {
  on(event: 'autoplayAllowed', listener: () => void): this;
}

class AudioHelperSingleton extends EventEmitter implements IAudioHelper {
  public readonly autoplayAllowed: Promise<void>;

  private timeoutId?: number;

  constructor() {
    super();
    this.autoplayAllowed = new Promise(resolve => {
      this.once('autoplayAllowed', resolve);
    });
    this.timeoutId = window.setTimeout(() => this.update(), 0);
  }

  public async fetchStream(url: string): Promise<() => Promise<AudioBufferSourceNode>> {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(data);
    return () => {
      const soundSource = audioContext.createBufferSource();
      soundSource.buffer = buffer;
      soundSource.start(0, 0);
      return soundSource;
      //const destination = audioContext.createMediaStreamDestination();
      //soundSource.connect(destination);
      //return destination.stream;
    };
  }

  public async load(
    url: string,
    options: { sinkId?: string; volume?: number; loop?: boolean } = {}
  ) {
    const audio = new Audio(url);
    audio.volume = options.volume === undefined ? 1.0 : options.volume;
    audio.loop = options.loop;
    await audioContext.resume();
    if (options.sinkId) {
      await (audio as any).setSinkId(options.sinkId);
    }
    return audio;
  }

  private async update() {
    if (await this.testAutoplay()) {
      this.emit('autoplayAllowed');
      delete this.timeoutId;
    } else {
      this.timeoutId = window.setTimeout(() => this.update(), 1000);
    }
  }

  private async testAutoplay() {
    const audio = new Audio();
    audio.src = audioTestSample;
    const playPromise = audio.play();
    if (playPromise === undefined) {
      return false;
    }

    try {
      await playPromise;
      return true;
    } catch (e) {
      return false;
    }
  }
}

export const AudioHelper = new AudioHelperSingleton();
