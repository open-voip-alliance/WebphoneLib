import { audioContext } from './audio-context';
import { MediaDeviceId } from './types';

interface ISoundOptions {
  volume?: number;
  overlap?: boolean;
  sinkId?: MediaDeviceId;
}

export class Sound {
  public readonly uri: string;

  private samples: HTMLAudioElement[] = [];
  private options: ISoundOptions;

  constructor(uri: string, options: ISoundOptions = {}) {
    this.uri = uri;
    this.options = {
      volume: options.volume === undefined ? 1.0 : options.volume,
      overlap: options.overlap === undefined ? false : options.overlap,
      sinkId: options.sinkId
    };
  }

  public get playing(): boolean {
    return this.samples.length > 0;
  }

  public get volume(): number {
    return this.options.volume;
  }

  public set volume(newVolume: number) {
    this.options.volume = newVolume;
    this.samples.forEach(s => {
      s.volume = newVolume;
    });
  }

  public get sinkId(): MediaDeviceId {
    return this.options.sinkId;
  }

  public set sinkId(newSinkId: MediaDeviceId) {
    this.options.sinkId = newSinkId;
    this.samples.forEach(s => {
      (s as any).setSinkId(newSinkId);
    });
  }

  public async play(loop = false): Promise<void> {
    if (this.options.overlap && loop) {
      throw new Error('loop and overlap cannot be combined');
    }

    if (!this.options.overlap && this.playing) {
      // Sound is already playing.
      return;
    }

    const sample = new Audio();
    sample.volume = this.options.volume;
    sample.loop = loop;

    const removeSample = () => {
      this.samples = this.samples.filter(s => s !== sample);
    };

    const resultPromise = new Promise<void>((resolve, reject) => {
      sample.addEventListener('error', e => {
        removeSample();
        reject(e);
      });

      sample.addEventListener('loadeddata', async () => {
        this.samples.push(sample);

        try {
          // Wake up audio context to prevent the error "require user interaction
          // before playing audio".
          await audioContext.resume();

          // Set the output sink and play the sound on this device.
          await (sample as any).setSinkId(this.options.sinkId);
          await sample.play();

        } catch (e) {
          removeSample();
          throw e;
        }
      });

      sample.addEventListener('ended', () => {
        removeSample();
        resolve();
      });
    });

    sample.src = this.uri;

    return await resultPromise;
  }

  public stop() {
    this.samples.forEach(s => {
      s.currentTime = 0;
      s.pause();
    });

    this.samples = [];
  }
}
