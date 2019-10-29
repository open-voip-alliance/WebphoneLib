import { audioContext } from './audio-context';
import * as Features from './features';
import { clamp } from './lib/utils';
import { log } from './logger';
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
  private stopTimer?: number;

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
    if (Features.webaudio.setSinkId) {
      this.samples.forEach(s => {
        (s as any).setSinkId(newSinkId);
      });
    } else {
      log.warn('cannot set output device: setSinkId is not supported', 'sound');
    }
  }

  public async play(
    { loop, timeout }: { loop: boolean; timeout: number } = { loop: false, timeout: undefined }
  ): Promise<void> {
    if (this.options.overlap && loop) {
      throw new Error('loop and overlap cannot be combined');
    }

    if (!this.options.overlap && this.playing) {
      log.warn('sound is already playing.', this.constructor.name);
      throw new Error('sound is already playing.');
    }

    const sample = new Audio();
    sample.volume = clamp(this.options.volume, 0.0, 1.0);
    sample.loop = loop;
    this.samples.push(sample);

    const cleanup = () => {
      if (this.stopTimer) {
        window.clearTimeout(this.stopTimer);
        delete this.stopTimer;
      }
      this.samples = this.samples.filter(s => s !== sample);
    };

    const resultPromise = new Promise<void>((resolve, reject) => {
      sample.addEventListener('error', e => {
        cleanup();
        reject(e);
      });

      sample.addEventListener('loadeddata', async () => {
        try {
          // Wake up audio context to prevent the error "require user interaction
          // before playing audio".
          await audioContext.resume();

          // Set the output sink if applicable.
          if (this.options.sinkId) {
            if (Features.webaudio.setSinkId) {
              await (sample as any).setSinkId(this.options.sinkId);
            } else {
              log.warn('cannot set output device: setSinkId is not supported', 'sound');
            }
          }

          if (!this.samples.includes(sample)) {
            resolve();
            return;
          }

          if (timeout) {
            this.stopTimer = window.setTimeout(() => this.stop(), timeout);
          }

          sample.addEventListener('pause', () => {
            cleanup();
            resolve();
          });

          sample.addEventListener('ended', () => {
            cleanup();
            resolve();
          });

          await sample.play();
        } catch (e) {
          cleanup();
          reject(e);
        }
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
    this.stopTimer = undefined;
  }
}
