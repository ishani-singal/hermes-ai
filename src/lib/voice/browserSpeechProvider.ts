import { IVoiceProvider, VoiceCallback, VoiceEventType, VoiceEventPayload } from './types';

export interface BrowserSpeechProviderOptions {
  lang?: string;
}

export class BrowserSpeechProvider implements IVoiceProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any | null = null;
  private running = false;
  private listeners: Map<VoiceEventType, Set<VoiceCallback>> = new Map();
  private lang: string;

  constructor(opts?: BrowserSpeechProviderOptions) {
    this.lang = opts?.lang ?? 'en-US';
    ['partial', 'final', 'error', 'state'].forEach((k) =>
      this.listeners.set(k as VoiceEventType, new Set())
    );
  }

  private emit(event: VoiceEventType, payload: VoiceEventPayload) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((cb) => cb(payload));
  }

  on(event: VoiceEventType, cb: VoiceCallback) {
    this.listeners.get(event)?.add(cb);
  }

  off(event: VoiceEventType, cb: VoiceCallback) {
    this.listeners.get(event)?.delete(cb);
  }

  isRunning() {
    return this.running;
  }

  async start() {
    if (this.running) return;
    // feature detection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win: any = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.emit('error', { type: 'error', error: 'SpeechRecognition not supported in this browser' });
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.lang;

    this.recognition.onstart = () => {
      this.running = true;
      this.emit('state', { type: 'state', state: 'listening' });
    };

    this.recognition.onend = () => {
      this.running = false;
      this.emit('state', { type: 'state', state: 'stopped' });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onerror = (e: any) => {
      this.emit('error', { type: 'error', error: e?.error || String(e) });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onresult = (event: any) => {
      // aggregate results - only emit final once per complete utterance
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText = text.trim();
        } else {
          interim += text;
        }
      }
      // Only emit final if we found a final result in this event
      if (finalText) {
        this.emit('final', { type: 'final', text: finalText });
      }
      if (interim) {
        this.emit('partial', { type: 'partial', text: interim.trim() });
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      // start can throw if called repeatedly
      this.emit('error', { type: 'error', error: String(e) });
    }
  }

  async stop() {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    }
    this.running = false;
    this.emit('state', { type: 'state', state: 'stopped' });
  }
}
