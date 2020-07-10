import { EventEmitter } from 'events';

import { Session as UserAgentSession } from 'sip.js/lib/api/session';

import { log } from './logger';

class StatsAggregation {
  private stats: {
    count: number;
    highest: number;
    lowest: number;
    values: number[];
    sum: number;
  } = {
    count: 0,
    highest: undefined,
    lowest: undefined,
    sum: 0,
    values: []
  };

  public add(sample: number) {
    if (this.stats.count === 0) {
      this.stats.lowest = sample;
      this.stats.highest = sample;
    } else {
      this.stats.lowest = Math.min(this.stats.lowest, sample);
      this.stats.highest = Math.max(this.stats.highest, sample);
    }

    if (this.stats.values.length === 12) {
      this.stats.values.shift();
    }
    this.stats.values.push(sample);

    this.stats.sum += sample;
    this.stats.count += 1;
  }

  public get last(): number {
    return this.stats.values.slice(-1).pop();
  }

  public get count(): number {
    return this.stats.count;
  }

  public get sum(): number {
    return this.stats.sum;
  }

  public get lowest(): number {
    return this.stats.lowest;
  }

  public get highest(): number {
    return this.stats.highest;
  }

  public get average(): number {
    if (this.count === 0) {
      return undefined;
    }

    return this.sum / this.count;
  }

  public get rollingAverage(): number {
    if (this.stats.values.length < 12) {
      return undefined;
    }

    return this.stats.values.reduce((sum, val) => sum + val) / this.stats.values.length;
  }
}

interface IStats {
  config: string; // This could contain chosen maxaveragebitrate etc.
  mos: StatsAggregation;
}

export class SessionStats extends EventEmitter {
  public readonly stats: IStats[] = [{ config: 'default', mos: new StatsAggregation() }];

  private statsTimer: number;
  private statsInterval: number;

  public constructor(
    session: UserAgentSession,
    {
      statsInterval
    }: {
      statsInterval: number;
    }
  ) {
    super();

    this.statsInterval = statsInterval;

    // Set up stats timer to periodically query and process the peer connection's
    // statistics and feed them to the stats aggregator.
    session.once('SessionDescriptionHandler-created', () => {
      this.statsTimer = window.setInterval(() => {
        const pc = (session.sessionDescriptionHandler as any).peerConnection;
        pc.getStats().then((stats: RTCStatsReport) => {
          if (this.add(stats)) {
            this.emit('statsUpdated', this);
          } else {
            log.debug('No useful stats' + stats, this.constructor.name);
          }
        });
      }, this.statsInterval);
    });
  }

  public clearStatsTimer(): void {
    if (this.statsTimer) {
      window.clearInterval(this.statsTimer);
      delete this.statsTimer;
    }
  }

  /**
   * Update the session stats list to start tracking the call quality again
   * because i.e. the call has updated its call configuration.
   */
  public update(config) {
    this.stats.push({ config, mos: new StatsAggregation() });
  }

  /**
   * Add stats for inbound RTP.
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/RTCStatsReport
   * @param {RTCStatsReport} stats - Stats returned by `pc.getStats()`
   * @return {boolean} False if report did not contain any useful stats.
   */
  private add(stats: RTCStatsReport): boolean {
    let inbound: any;
    let candidatePair: any;

    for (const obj of stats.values()) {
      if (obj.type === 'inbound-rtp') {
        inbound = obj;
      } else if (obj.type === 'candidate-pair' && obj.nominated) {
        candidatePair = obj;
      }
    }

    if (inbound && candidatePair) {
      const measurement = {
        jitter: inbound.jitter,

        // Firefox doesn't have `fractionLost`, fallback to calculating the total
        // packet loss. TODO: It would be better to calculate the fraction of lost
        // packets since the last measurement.
        fractionLost: inbound.fractionLost || inbound.packetsLost / inbound.packetsReceived,

        // Firefox doesn't have or expose this property. Fallback to using 50ms as
        // a guess for RTT.
        rtt: candidatePair.currentRoundTripTime || 0.05
      };

      this.stats[this.stats.length - 1]['mos'].add(calculateMOS(measurement));
      // this.app.logger.info(`${this}MOS=${measurements.mos.toFixed(2)}`, measurements);
      return true;
    }

    return false;
  }
}

export interface IMeasurement {
  rtt: number;
  jitter: number;
  fractionLost: number;
}

/**
 * Calculate a Mean Opinion Score (MOS).
 *
 * Calculation taken from:
 * https://www.pingman.com/kb/article/how-is-mos-calculated-in-pingplotter-pro-50.html
 *
 * @param {Object} options - Options.
 * @param {Number} options.rtt -  Trip Time in seconds.
 * @param {Number} options.jitter - Jitter in seconds.
 * @param {Number} options.fractionLost - Fraction of packets lost (0.0 - 1.0)
 * @returns {Number} MOS value in range 0.0 (very bad) to 5.0 (very good)
 */
export function calculateMOS({ rtt, jitter, fractionLost }: IMeasurement): number {
  // Take the average latency, add jitter, but double the impact to latency
  // then add 10 for protocol latencies.
  const effectiveLatency = 1000 * (rtt + jitter * 2) + 10;

  // Implement a basic curve - deduct 4 for the R value at 160ms of latency
  // (round trip). Anything over that gets a much more aggressive deduction.
  let R: number;
  if (effectiveLatency < 160) {
    R = 93.2 - effectiveLatency / 40;
  } else {
    R = 93.2 - (effectiveLatency - 120) / 10;
  }

  // Now, let's deduct 2.5 R values per percentage of packet loss.
  // Never go below 0, then the MOS value would go up again.
  R = Math.max(R - fractionLost * 250, 0);

  // Convert the R into an MOS value (this is a known formula).
  const MOS = 1 + 0.035 * R + 0.000007 * R * (R - 60) * (100 - R);

  return MOS;
}
