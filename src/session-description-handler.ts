import { UA, Web, SessionDescriptionHandlerModifier } from 'sip.js';
import { isPrivateIP } from './utils';
import { audioContext } from './audio-context';


export function stripPrivateIps(description: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
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

  (sdh as any).WebRTC.getUserMedia = async constraints => {
    console.log('getUserMedia....');
    const inputStream = await options.media.input();
    console.log('inputStream = ', inputStream);
    const destination = audioContext.createMediaStreamDestination();
    inputStream.connect(destination);
    return destination.stream;
  };

  console.log('returning patched SDH for session', session);
  console.log(options.media);
  return sdh;
}
