import { useSyncExternalStore } from 'react';
import { voice, VoiceState } from './voice';

export function useVoice(): VoiceState {
  return useSyncExternalStore(voice.subscribe, voice.getState, voice.getState);
}
