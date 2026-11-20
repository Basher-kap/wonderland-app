// Web (used to test with several browser tabs): the browser already has WebRTC.
const w: any = typeof window !== 'undefined' ? window : {};
const audios = new Map<string, HTMLAudioElement>();

export const RTC = {
  PeerConnection: w.RTCPeerConnection as any,
  SessionDescription: w.RTCSessionDescription as any,
  IceCandidate: w.RTCIceCandidate as any,
  async getUserMedia(): Promise<any> {
    return (navigator as any).mediaDevices.getUserMedia({ audio: true, video: false });
  },
  playRemote(id: string, stream: any) {
    let a = audios.get(id);
    if (!a) {
      a = new Audio();
      a.autoplay = true;
      audios.set(id, a);
    }
    a.srcObject = stream;
    a.play().catch(() => {});
  },
  stopRemote(id: string) {
    const a = audios.get(id);
    if (!a) return;
    a.pause();
    a.srcObject = null;
    audios.delete(id);
  },
};
