import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BrowserSpeechProvider } from '../lib/voice/browserSpeechProvider';
import { IVoiceProvider } from '../lib/voice/types';

export function useVoice(opts?: { lang?: string }) {
  const providerRef = useRef<IVoiceProvider | null>(null);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState<string>('');
  const [lastFinal, setLastFinal] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const lastFinalRef = useRef<string>('');

  const provider = useMemo(() => {
    if (!providerRef.current) {
      providerRef.current = new BrowserSpeechProvider({ lang: opts?.lang });
    }
    return providerRef.current;
  }, [opts?.lang]);

  useEffect(() => {
    const onPartial = (p: Record<string, string>) => setPartial(p.text ?? '');
    const onFinal = (p: Record<string, string>) => {
      const text = p.text ?? '';
      // Only emit if text is different from the last final we emitted
      if (text && text !== lastFinalRef.current) {
        lastFinalRef.current = text;
        setLastFinal(text);
      }
      setPartial('');
    };
    const onError = (p: Record<string, string>) => setError(p.error ?? 'unknown error');
    const onState = (p: Record<string, string>) => setListening(p.state === 'listening');

    provider.on('partial', onPartial);
    provider.on('final', onFinal);
    provider.on('error', onError);
    provider.on('state', onState);

    return () => {
      provider.off('partial', onPartial);
      provider.off('final', onFinal);
      provider.off('error', onError);
      provider.off('state', onState);
    };
  }, [provider]);

  async function start() {
    setError(null);
    try {
      await provider.start();
    } catch (e) {
      setError(String(e));
    }
  }

  async function stop() {
    try {
      await provider.stop();
    } catch {
      // ignore
    }
  }

  function resetFinal() {
    lastFinalRef.current = '';
    setLastFinal('');
  }

  return {
    start,
    stop,
    listening,
    partial,
    lastFinal,
    error,
    provider,
    resetFinal,
  } as const;
}
