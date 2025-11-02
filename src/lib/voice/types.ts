export type VoiceEventType = 'partial' | 'final' | 'error' | 'state';

export type VoiceState = 'starting' | 'listening' | 'stopped' | 'error';

export type VoiceEventPayload =
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'error'; error: string }
  | { type: 'state'; state: VoiceState };

export type VoiceCallback = (payload: VoiceEventPayload) => void;

export interface IVoiceProvider {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  on: (event: VoiceEventType, cb: VoiceCallback) => void;
  off: (event: VoiceEventType, cb: VoiceCallback) => void;
  isRunning: () => boolean;
}
