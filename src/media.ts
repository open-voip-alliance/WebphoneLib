import { EventEmitter } from 'events';
import * as Features from './feature-detection';
import { eqSet } from './utils';

// getUserMedia:
//   which device?
//   enable audio processing (yes/no)

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

export declare interface IMediaDevices {
  on(
    event: 'devicesChanged' | 'permissionGranted' | 'permissionRevoked',
    listener: () => void
  ): this;
}

const UPDATE_INTERVAL = 1000;

/**
 * Offers an abstraction over Media permissions and device enumeration for use
 * with WebRTC.
 */
class MediaSingleton extends EventEmitter {
  private _devices: IAudioDevice[] = [];
  private _requestPermissionPromise: Promise<void>;
  private _timer: number = undefined;
  private _hadPermission: boolean = false;

  constructor() {
    super();

    if (!Features.mediaDevices || !Features.getUserMedia) {
      // TODO: centralize this?
      throw new Error('Media devices are not supported in this browser.');
    }

    // TODO: This doesn't seem to do much on my system..
    navigator.mediaDevices.addEventListener('devicechange', () => {
      console.log('devices updated');
      // this._update();
    });

    // Immediately try to update the devices.
    this._timer = window.setTimeout(() => this._update(), 0);
  }

  get devices(): IAudioDevice[] {
    return this._devices;
  }

  get inputs(): IAudioDevice[] {
    return this._devices.filter(d => d.kind === 'audioinput');
  }

  get outputs(): IAudioDevice[] {
    return this._devices.filter(d => d.kind === 'audiooutput');
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
    if (this._requestPermissionPromise) {
      return this._requestPermissionPromise;
    }

    this._requestPermissionPromise = new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });

        if (!this._hadPermission) {
          if (this._timer) {
            window.clearTimeout(this._timer);
          }

          await this._update();
        }

        // Close the stream and delete the promise.
        stream.getTracks().forEach(track => track.stop());

        resolve();
      } catch (err) {
        reject(err);
      } finally {
        delete this._requestPermissionPromise;
      }
    });

    return this._requestPermissionPromise;
  }

  private async _enumerateDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();

    if (devices.length && devices[0].label) {
      return devices;
    }

    return undefined;
  }

  private async _update() {
    const devices = await this._enumerateDevices();
    const havePermission = devices !== undefined;

    if (havePermission) {
      if (!this._hadPermission) {
        this.emit('permissionGranted');
      }

      this._updateDevices(devices);
    } else {
      if (this._hadPermission) {
        this.emit('permissionRevoked');
        this._devices = [];
        this.emit('devicesChanged');
      }
    }

    this._hadPermission = havePermission;

    // When running on localhost in Firefox, the permission can't be stored
    // (unless over https). The timer will clear the devices list on the next
    // timeout. Prevent this behaviour because it's annoying to develop with.
    if (!(Features.isFirefox && Features.isLocalhost)) {
      this._timer = window.setTimeout(() => this._update(), UPDATE_INTERVAL);
    }
  }

  private _updateDevices(enumeratedDevices: MediaDeviceInfo[]) {
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
    const oldIds = new Set(this._devices.map(d => d.id));

    if (!eqSet(newIds, oldIds)) {
      this._devices = allDevices;
      this.emit('devicesChanged');
    }
  }
}

export const Media = new MediaSingleton();
