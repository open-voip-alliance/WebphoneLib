import { EventEmitter } from 'events';

import { audioContext } from './audio-context';
import * as Features from './features';
import { log } from './logger';
import * as Time from './time';
import { IMediaInput, IMediaOutput } from './types';
import { eqSet } from './lib/utils';

export interface IAudioDevice {
  /**
   * Unique identifier for the presented device that is persisted across
   * sessions. It is reset when the user clears cookies. See
   * `MediaDeviceInfo.deviceId`.
   */
  id: string;
  name: string;
  kind: 'audioinput' | 'audiooutput';
}

interface IMediaDevices {
  readonly devices: IAudioDevice[];
  readonly inputs: IAudioDevice[];
  readonly outputs: IAudioDevice[];
  on(
    event: 'devicesChanged' | 'permissionGranted' | 'permissionRevoked',
    listener: () => void
  ): this;
}

const UPDATE_INTERVAL = 1 * Time.second;

/**
 * Offers an abstraction over Media permissions and device enumeration for use
 * with WebRTC.
 */
class MediaSingleton extends EventEmitter implements IMediaDevices {
  private allDevices: IAudioDevice[] = [];
  private requestPermissionPromise: Promise<void>;
  private timer: number = undefined;
  private hadPermission: boolean = false;

  public init() {
    this.update();
  }

  get devices() {
    return this.allDevices;
  }

  get inputs() {
    return this.allDevices.filter(d => d.kind === 'audioinput');
  }

  get outputs() {
    return this.allDevices.filter(d => d.kind === 'audiooutput');
  }

  /**
   * Check if we (still) have permission to getUserMedia and enumerateDevices.
   * This only checks the permission and does not ask the user for anything. Use
   * `requestPermission` to ask the user to approve the request.
   */
  public async checkPermission(): Promise<boolean> {
    const devices = await navigator.mediaDevices.enumerateDevices();

    if (devices.length && devices[0].label) {
      return true;
    }

    return false;
  }

  public requestPermission(): Promise<void> {
    if (this.requestPermissionPromise) {
      return this.requestPermissionPromise;
    }

    this.requestPermissionPromise = new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });

        if (!this.hadPermission) {
          if (this.timer) {
            window.clearTimeout(this.timer);
          }

          await this.update();
        }

        // Close the stream and delete the promise.
        this.closeStream(stream);
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        delete this.requestPermissionPromise;
      }
    });

    return this.requestPermissionPromise;
  }

  public openInputStream(input: IMediaInput): Promise<MediaStream> {
    log.debug(`Requesting input stream with: audioProcessing=${input.audioProcessing}`, 'media');
    const constraints = getInputConstraints(input);
    const promise = navigator.mediaDevices.getUserMedia(constraints);
    promise.then(stream => {
      stream.getTracks().forEach(track => {
        log.debug(`Media stream track has settings: ${JSON.stringify(track.getSettings())}`, 'media');
      });
    });
    return promise;
  }

  public closeStream(stream: MediaStream): void {
    stream.getTracks().forEach(track => track.stop());
  }

  private async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();

    if (devices.length && devices[0].label) {
      return devices;
    }

    return undefined;
  }

  private async update() {
    const devices = await this.enumerateDevices();
    const havePermission = devices !== undefined;

    if (havePermission) {
      if (!this.hadPermission) {
        this.emit('permissionGranted');
      }

      this.updateDevices(devices);
    } else {
      if (this.hadPermission) {
        this.emit('permissionRevoked');
        this.allDevices = [];
        this.emit('devicesChanged');
      }
    }

    this.hadPermission = havePermission;

    // When running on localhost in Firefox, the permission can't be stored
    // (unless over https). The timer will clear the devices list on the next
    // timeout. Prevent this behaviour because it's annoying to develop with.
    if (!(Features.isFirefox && Features.isLocalhost)) {
      this.timer = window.setTimeout(() => this.update(), UPDATE_INTERVAL);
    }
  }

  private updateDevices(enumeratedDevices: MediaDeviceInfo[]) {
    // Map the found devices to our own format, and filter out videoinput's.
    const allDevices = enumeratedDevices
      .map(
        (d: MediaDeviceInfo): IAudioDevice => {
          if (!d.label) {
            // This should not happen, but safe guard that devices without a name
            // cannot enter our device state.
            return undefined;
          }
          if (d.kind === 'audioinput') {
            return { id: d.deviceId, name: d.label, kind: 'audioinput' };
          } else if (d.kind === 'audiooutput') {
            return { id: d.deviceId, name: d.label, kind: 'audiooutput' };
          } else {
            return undefined;
          }
        }
      )
      .filter(d => d !== undefined);

    const newIds = new Set(allDevices.map(d => d.id));
    const oldIds = new Set(this.allDevices.map(d => d.id));

    if (!eqSet(newIds, oldIds)) {
      this.allDevices = allDevices;
      this.emit('devicesChanged');
    }
  }
}

export const Media = new MediaSingleton();

function getInputConstraints(input: IMediaInput): MediaStreamConstraints {
  const presets = input.audioProcessing
    ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        googAudioMirroring: true,
        googAutoGainControl: true,
        googAutoGainControl2: true,
        googEchoCancellation: true,
        googHighpassFilter: true,
        googNoiseSuppression: true,
        googTypingNoiseDetection: true
      }
    : {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
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

  log.debug(`Using input constraints: ${JSON.stringify(constraints)}`, 'media');

  return constraints;
}
