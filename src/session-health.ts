import { Session as UserAgentSession } from 'sip.js/lib/api/session';
import * as Features from './features';

export function checkAudioConnected(
  session: UserAgentSession,
  {
    checkInterval,
    noAudioTimeout
  }: {
    checkInterval: number;
    noAudioTimeout: number;
  }
): Promise<void> {
  let checkTimer: number;

  return new Promise((resolve, reject) => {
    session.once('SessionDescriptionHandler-created', () => {
      // We patched the sdh with peerConnection.
      const pc = (session.sessionDescriptionHandler as any).peerConnection;

      // onconnectionstatechange is only supported on Chromium. For all other
      // browsers we look at the outbound-rtp stats to detect potentially broken
      // audio.
      if (Features.webrtc.connectionstatechange) {
        pc.addEventListener('connectionstatechange', () => {
          switch (pc.connectionState) {
            case 'connected':
              resolve();
              break;

            case 'failed':
              reject();
              break;
          }
        });
      } else {
        let noAudioTimeoutLeft = noAudioTimeout;
        const checkStats = () => {
          pc.getStats().then((stats: RTCStatsReport) => {
            const buckets = Array.from(stats.values());
            const outbound = buckets.find(obj => obj.type === 'outbound-rtp');
            if (outbound && outbound.packetsSent > 0) {
              resolve();
            } else {
              noAudioTimeoutLeft -= checkInterval;
              if (noAudioTimeoutLeft <= 0) {
                reject();
              } else {
                checkTimer = window.setTimeout(checkStats, checkInterval);
              }
            }
          });
        };

        checkTimer = window.setTimeout(checkStats, checkInterval);

        session.once('terminated', () => {
          if (checkTimer) {
            window.clearTimeout(checkTimer);
          }
        });
      }
    });
  });
}
