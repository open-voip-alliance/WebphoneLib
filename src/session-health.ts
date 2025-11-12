import { Session as UserAgentSession } from 'sip.js/lib/api/session';
import { SessionState } from 'sip.js/lib/api/session-state';
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
    const setupAudioCheck = () => {
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

        session.stateChange.addListener((newState: SessionState) => {
          if (newState === SessionState.Terminated && checkTimer) {
            window.clearTimeout(checkTimer);
          }
        });
      }
    };

    // Check if SDH already exists, or wait for it to be created
    if (session.sessionDescriptionHandler) {
      setupAudioCheck();
    } else {
      const originalDelegate = session.delegate;
      session.delegate = {
        ...originalDelegate,
        onSessionDescriptionHandler: (sdh, provisional) => {
          if (!provisional) {
            setupAudioCheck();
          }
          if (originalDelegate && originalDelegate.onSessionDescriptionHandler) {
            originalDelegate.onSessionDescriptionHandler(sdh, provisional);
          }
        }
      };
    }
  });
}
