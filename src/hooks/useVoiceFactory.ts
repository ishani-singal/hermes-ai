import { useVoice } from './useVoice';
import { useTurnByTurn, UseTurnByTurnOptions } from './useTurnByTurn';
import { useEffect } from 'react';

export type VoiceMode = 'web-speech' | 'turn-by-turn';

export interface UseVoiceFactoryOptions extends UseTurnByTurnOptions {
    mode: VoiceMode;
    onFinalTranscript?: (text: string) => void; // For web-speech to notify when a sentence is done
}

export function useVoiceFactory(options: UseVoiceFactoryOptions) {
    const { mode, onFinalTranscript, ...turnByTurnOptions } = options;

    // Always call both hooks to adhere to Rules of Hooks
    const webSpeech = useVoice();

    // We only pass callbacks to turnByTurn if it's the active mode to avoid side effects
    const turnByTurn = useTurnByTurn(mode === 'turn-by-turn' ? turnByTurnOptions : {});

    // Handle Web Speech callbacks
    useEffect(() => {
        if (mode === 'web-speech' && webSpeech.lastFinal) {
            onFinalTranscript?.(webSpeech.lastFinal);
            webSpeech.resetFinal();
        }
    }, [mode, webSpeech.lastFinal, onFinalTranscript, webSpeech]);

    if (mode === 'turn-by-turn') {
        return {
            type: 'turn-by-turn',
            state: turnByTurn.state,
            error: turnByTurn.error,
            isRecording: turnByTurn.isRecording,
            isProcessing: turnByTurn.isProcessing,
            isSpeaking: turnByTurn.isSpeaking,
            stream: turnByTurn.stream,
            start: turnByTurn.startRecording,
            stop: turnByTurn.stopRecording,
            stopAll: turnByTurn.stopAll,
            stopAudio: turnByTurn.stopAudio,
            partial: '', // Turn-by-turn handles UI differently
        };
    } else {
        return {
            type: 'web-speech',
            state: webSpeech.listening ? 'recording' : 'idle', // Map to similar state
            error: webSpeech.error,
            isRecording: webSpeech.listening,
            isProcessing: false,
            isSpeaking: false,
            stream: null, // Web Speech doesn't expose stream easily/safely here without more work
            start: webSpeech.start,
            stop: webSpeech.stop,
            stopAll: webSpeech.stop,
            stopAudio: () => { }, // No-op for web-speech
            partial: webSpeech.partial,
        };
    }
}
