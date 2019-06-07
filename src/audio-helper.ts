const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;

export const audioContext = new AudioContext();

export namespace AudioHelper {
  export async function loadIntoBuffer(url: string): Promise<AudioBufferSourceNode> {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(data);
    const soundSource = audioContext.createBufferSource();
    soundSource.buffer = buffer;
    soundSource.start(0, 0);
    return soundSource;
  }

  // TODO: possible to request permission for autoplay?
  export async function loadForPlay(url: string, sinkId: string, volume = 1.0, loop = false) {
    const audio = new Audio(url);
    audio.volume = volume;
    audio.loop = loop;
    await audioContext.resume();
    if (sinkId) {
      await (audio as any).setSinkId(sinkId);
    }
    return audio;
  }
};
