import { SessionDescriptionHandlerModifier, UA, Web } from 'sip.js';

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

export function sessionDescriptionHandlerFactory(session, options) {
  const sdh = Web.SessionDescriptionHandler.defaultFactory(session, options);

  session.__streams = {
    localStream: audioContext.createMediaStreamDestination(),
    remoteStream: new MediaStream()
  };

  (sdh as any).getMediaStream = async () => {
    await session.__media.setInput();
    return session.__streams.localStream.stream;
  };

  (sdh as any).on('addTrack', async (track, stream) => {
    const pc = session.sessionDescriptionHandler.peerConnection;
    log.debug('addTrack' + arguments, 'sessionDescriptionHandlerFactory');

    let remoteStream = new MediaStream();
    if (pc.getReceivers) {
      pc.getReceivers().forEach(receiver => {
        const rtrack = receiver.track;
        if (rtrack) {
          remoteStream.addTrack(rtrack);
        }
      });
    } else {
      remoteStream = pc.getRemoteStreams()[0];
    }

    session.__streams.remoteStream = remoteStream;
    try {
      await session.__media.setOutput();
    } catch (e) {
      log.error(e, 'sessionDescriptionHandlerFactory');
      session.__media.emit('mediaFailure');
    }
  });

  log.debug('Returning patched SDH for session' + session, 'sessionDescriptionHandlerFactory');
  return sdh;
}
