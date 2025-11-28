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

// Turn-by-turn conversation types
export type ConversationState = 
  | 'idle'           // Ready to start
  | 'recording'      // User is speaking
  | 'processing'     // STT + Translation + LLM + TTS
  | 'speaking'       // AI audio playing
  | 'error';         // Something went wrong

export interface ConversationResponse {
  transcript: string;
  response: string;
  audioBase64: string;
  language: string;
}

export interface SilenceDetectorConfig {
  silenceThreshold: number;  // dB level, default -50
  silenceDuration: number;   // milliseconds, default 2000
}

export interface LanguageOption {
  code: string;        // e.g., 'en-US', 'es-ES', 'hi-IN'
  name: string;        // e.g., 'English', 'Spanish', 'Hindi'
  flag: string;        // emoji flag
  ttsVoice: string;    // Google TTS voice name
}
