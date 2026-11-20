// Phones: the WebRTC engine comes from react-native-webrtc (needs a development build, not Expo Go).
// The web version (rtc.web.ts) uses the browser's own WebRTC. Both export the same small API.
import { PermissionsAndroid, Platform } from 'react-native';
import { mediaDevices, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

export const RTC = {
  PeerConnection: RTCPeerConnection as any,
  SessionDescription: RTCSessionDescription as any,
  IceCandidate: RTCIceCandidate as any,
  // The microphone, audio only. Rejects when the permission is denied.
  async getUserMedia(): Promise<any> {
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (res !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('microphone permission denied');
    }
    return mediaDevices.getUserMedia({ audio: true, video: false });
  },
  // On phones the incoming audio plays by itself; nothing to attach.
  playRemote(_id: string, _stream: any) {},
  stopRemote(_id: string) {},
};
