import { EventEmitter } from 'events';

// As short as possible mp3 file.
// source: https://gist.github.com/westonruter/253174
// prettier-ignore
const audioTestSample = 'data:audio/mpeg;base64,/+MYxAAAAANIAUAAAASEEB/jwOFM/0MM/90b/+RhST//w4NFwOjf///PZu////9lns5GFDv//l9GlUIEEIAAAgIg8Ir/JGq3/+MYxDsLIj5QMYcoAP0dv9HIjUcH//yYSg+CIbkGP//8w0bLVjUP///3Z0x5QCAv/yLjwtGKTEFNRTMuOTeqqqqqqqqqqqqq/+MYxEkNmdJkUYc4AKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

interface IAutoplay {
  listen(): void;
  stop(): void;
  on(event: 'allowed', listener: () => void): this;
}

class AutoplaySingleton extends EventEmitter implements IAutoplay {
  public readonly allowed: Promise<void>;

  private timer: number;

  constructor() {
    super();
    this.allowed = new Promise(resolve => {
      this.once('allowed', resolve);
    });
  }

  public listen(): void {
    this.timer = window.setTimeout(() => this.update(), 0);
  }

  public stop(): void {
    if (this.timer) {
      window.clearTimeout(this.timer);
      delete this.timer;
    }
  }

  private async update() {
    if (await this.test()) {
      this.emit('allowed');
      delete this.timer;
    } else {
      this.timer = window.setTimeout(() => this.update(), 1000);
    }
  }

  private async test(): Promise<boolean> {
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

export const Autoplay = new AutoplaySingleton();
