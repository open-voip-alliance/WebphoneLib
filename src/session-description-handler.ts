import { Web } from 'sip.js';
import { SessionDescriptionHandler } from 'sip.js/lib/platform/web/session-description-handler';
import { defaultSessionDescriptionHandlerFactory } from 'sip.js/lib/platform/web/session-description-handler/session-description-handler-factory-default';

import { audioContext } from './audio-context';
import { isPrivateIP } from './lib/utils';
import { log } from './logger';

export function stripPrivateIps(
  description: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  const lines = description.sdp.split(/\r\n/);
  const filtered = lines.filter(line => {
    const m = /a=candidate:\d+ \d+ (?:udp|tcp) \d+ (\d+\.\d+\.\d+\.\d+)/i.exec(line);
    return !m || !isPrivateIP(m[1]);
  });
  description.sdp = filtered.join('\r\n');
  return Promise.resolve(description);
}

export function sessionDescriptionHandlerFactory(session, options): SessionDescriptionHandler {
  // Create a custom media stream factory that uses our audio context
  const mediaStreamFactory = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    // Initialize our custom audio context streams on the session
    if (!(session as any).__streams) {
      (session as any).__streams = {
        localStream: audioContext.createMediaStreamDestination(),
        remoteStream: new MediaStream()
      };
    }

    // Call setInput to set up the input audio routing
    await (session as any).__media.setInput();
    return (session as any).__streams.localStream.stream;
  };

  // Create the factory with our custom media stream factory
  const factory = defaultSessionDescriptionHandlerFactory(mediaStreamFactory);

  // Create the session description handler
  const sdh = factory(session, options);

  // Set up peer connection delegate to handle remote tracks
  const originalDelegate = sdh.peerConnectionDelegate;
  sdh.peerConnectionDelegate = {
    ...originalDelegate,
    ontrack: async (event: RTCTrackEvent) => {
      log.debug('ontrack event', 'sessionDescriptionHandlerFactory');

      const pc = sdh.peerConnection;
      if (!pc) {
        return;
      }

      // Reconstruct remote stream from receivers
      const remoteStream = new MediaStream();
      if (pc.getReceivers) {
        pc.getReceivers().forEach(receiver => {
          const rtrack = receiver.track;
          if (rtrack) {
            remoteStream.addTrack(rtrack);
          }
        });
      }

      (session as any).__streams.remoteStream = remoteStream;

      try {
        await (session as any).__media.setOutput();
      } catch (e) {
        log.error(e, 'sessionDescriptionHandlerFactory');
        (session as any).__media.emit('mediaFailure');
      }

      // Call original delegate if it exists
      if (originalDelegate && originalDelegate.ontrack) {
        originalDelegate.ontrack(event);
      }
    }
  };

  log.debug('Returning patched SDH for session', 'sessionDescriptionHandlerFactory');
  return sdh;
}
