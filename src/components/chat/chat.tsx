"use client"

import { useEffect, useRef, useState } from 'react'
import { useVoice } from '@/hooks/useVoice'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'

export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
}

type ChatProps = {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  threadId: string | null
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>
}

export function Chat({ messages, setMessages, threadId, setThreadId }: ChatProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const { start, stop, listening, partial, lastFinal, error: voiceError, resetFinal } = useVoice({ lang: 'en-US' })
  const processingRef = useRef(false)
  const lastSentRef = useRef<{ text: string; time: number } | null>(null)
  const [streamMode, setStreamMode] = useState(false)
  const [pushToTalkMode, setPushToTalkMode] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isTTSPlaying, setIsTTSPlaying] = useState(false)
  const audioPromiseRejectRef = useRef<((reason?: Error) => void) | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioUnlockedRef = useRef(false)

  // populate input from voice partials/final
  useEffect(() => {
    if (listening && partial && !processingRef.current) {
      setInput(partial)
    }
  }, [partial, listening])

  useEffect(() => {
    if (lastFinal && lastFinal.trim().length > 0 && !processingRef.current) {
      const text = lastFinal.trim()
      const now = Date.now()

      // if we've sent the same text very recently, skip to avoid duplicates
      if (lastSentRef.current && lastSentRef.current.text === text && now - lastSentRef.current.time < 2000) {
        console.log('Skipping duplicate final transcript send:', text)
        resetFinal()
        return
      }

      // Only auto-send in stream mode, not in push-to-talk mode
      if (!streamMode) {
        // Push-to-talk mode: just stop listening, don't auto-send
        if (pushToTalkMode) {
          processingRef.current = true
          ;(async () => {
            try {
              await stop()
              resetFinal()
            } catch (e) {
              console.error('error stopping voice input', e)
            } finally {
              processingRef.current = false
            }
          })()
        }
        return
      }

      // Stream mode: auto-send the message
      processingRef.current = true
      ;(async () => {
        try {
          // stop listening to avoid receiving duplicate finals while sending
          await stop()
          await send(text)
          setInput('')
          lastSentRef.current = { text, time: Date.now() }
          // Clear the final after sending to prevent re-triggering
          resetFinal()
          
          // In stream mode, resume listening automatically after a short delay
          setTimeout(() => {
            void start()
          }, 500)
        } catch (e) {
          console.error('error auto-sending final transcript', e)
        } finally {
          processingRef.current = false
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFinal, stop, streamMode, start])

  useEffect(() => {
    if (voiceError) {
      setError(voiceError)
    }
  }, [voiceError])

  // Initialize with welcome message only if messages are empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'm-system-1',
          role: 'system',
          text: 'Ask me about maintenance procedures, troubleshooting, or equipment details. I can act on your behalf if needed.',
        },
      ])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text?: string) => {
    const messageText = (text ?? input).trim()
    if (!messageText) return

    setError(null)

    const userMessage: Message = {
      id: String(Date.now()) + Math.random().toString(16).slice(2),
      role: 'user',
      text: messageText,
    }

    setMessages((m) => [...m, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          message: messageText,
          threadId: threadId || undefined,
          streamMode: streamMode, // Send streamMode flag to backend
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const json = await res.json()

      // Extract threadId from response and save it in state only (not localStorage)
      // This keeps the conversation context within the session, but doesn't persist across page reloads
      const responseThreadId = json?.data?.threadId || json?.threadId
      if (responseThreadId && responseThreadId !== threadId) {
        setThreadId(responseThreadId)
      }

      // backend success shape may vary; prefer known shapes and fallback to raw
      const assistantText =
        json?.assistant?.text ?? json?.data?.assistant?.text ?? json?.message ?? JSON.stringify(json)
      const audioBase64 = json?.assistant?.audioBase64 ?? json?.data?.assistant?.audioBase64

      console.log('[Chat] Response received:', { 
        hasAssistantText: !!assistantText, 
        hasAudioBase64: !!audioBase64,
        audioBase64Length: audioBase64?.length,
        streamMode 
      })

      const assistantMessage: Message = {
        id: 'a-' + String(Date.now()) + Math.random().toString(16).slice(2),
        role: 'assistant',
        text: String(assistantText),
      }

      setMessages((m) => [...m, assistantMessage])

      // If we have audio and we're in stream mode, play it
      if (audioBase64 && streamMode) {
        console.log('[Chat] Starting audio playback - audio found and streamMode is true')
        try {
          // Stop listening before playing TTS to prevent self-talking loop
          await stop()
          console.log('[Chat] Voice listening stopped')
          
          // Ensure we've unlocked audio playback on mobile (must be called as part of a user gesture earlier,
          // but calling again is benign). This resumes a WebAudio context and briefly plays a tiny silent buffer
          // which helps mobile Safari/Chrome allow subsequent audio playback.
          await unlockAudio()
          console.log('[Chat] Audio unlocked')
          
          // Convert base64 to blob and play
          const audioBlob = base64ToBlob(audioBase64, 'audio/mpeg')
          console.log('[Chat] About to play audio blob')
          await playAudioBlob(audioBlob)
          console.log('[Chat] Audio blob playback completed')
          
          // Resume listening after audio finishes (only if still in stream mode)
          setTimeout(() => {
            if (streamMode) {
              console.log('[Chat] Resuming listening after audio')
              void start()
            }
          }, 500)
        } catch (audioErr) {
          // Check if this was a user-initiated stop (not an actual error)
          const isUserStop = audioErr instanceof Error && audioErr.message === 'Audio stopped by user'
          
          if (!isUserStop && streamMode) {
            const errorMsg = audioErr instanceof Error ? audioErr.message : String(audioErr)
            console.error('[Chat] Audio playback error, retrying listening:', errorMsg)
            // Resume listening even if audio fails (but not if user stopped)
            setTimeout(() => {
              if (streamMode) {
                void start().catch((err) => {
                  console.error('[Chat] Failed to resume listening:', err)
                })
              }
            }, 500)
          }
          // If user stopped, don't resume listening (they wanted to stop)
        }
      } else {
        console.log('[Chat] Skipping audio playback:', { audioBase64Present: !!audioBase64, streamMode })
      }
    } catch (err: unknown) {
      console.error('chat send error', err)
      setError(err instanceof Error ? err.message : String(err))
      setMessages((m) => [
        ...m,
        {
          id: 'a-err-' + String(Date.now()),
          role: 'assistant',
          text: 'Sorry — something went wrong. ' + (err instanceof Error ? err.message : ''),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Helper to convert base64 to blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    try {
      console.log('[TTS] Converting base64 to blob:', { base64Length: base64.length, mimeType })
      
      const byteCharacters = atob(base64)
      console.log('[TTS] atob successful:', { byteCharactersLength: byteCharacters.length })
      
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })
      console.log('[TTS] Blob created successfully:', { blobSize: blob.size, blobType: blob.type })
      return blob
    } catch (err) {
      console.error('[TTS] base64ToBlob error:', err, { base64Length: base64.length })
      throw err
    }
  }

  // Helper to play audio blob
  const playAudioBlob = async (blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('[TTS] playAudioBlob starting:', { blobSize: blob.size, blobType: blob.type })
      
      // Ensure blob is audio/mpeg (sometimes it can be sent as octet-stream)
      const audioBlob = blob.type === 'audio/mpeg' ? blob : new Blob([blob], { type: 'audio/mpeg' })
      console.log('[TTS] Audio blob ready:', { audioBlob: audioBlob.size, type: audioBlob.type })
      
      const audioUrl = URL.createObjectURL(audioBlob)
      console.log('[TTS] Object URL created:', { audioUrl })
      
      // Create audio element with explicit attributes for better mobile compatibility
      const audio = new Audio()
      // IMPORTANT: Set crossOrigin BEFORE setting src to ensure proper CORS handling
      audio.crossOrigin = 'anonymous'
      audio.preload = 'auto'
      audio.src = audioUrl
      
      console.log('[TTS] Audio element created:', { src: audio.src, preload: audio.preload, crossOrigin: audio.crossOrigin, readyState: audio.readyState, networkState: audio.networkState })
      
      // Store reference and reject function for potential stopping
      audioRef.current = audio
      audioPromiseRejectRef.current = reject
      setIsTTSPlaying(true)
      
      // Add a timeout to catch stuck audio on mobile devices
      let timeoutId: NodeJS.Timeout | null = null
      
      const cleanup = (isError: boolean, reason?: string) => {
        console.log('[TTS] Cleanup called:', { isError, reason, audioState: audio.readyState, audioPaused: audio.paused })
        if (timeoutId) clearTimeout(timeoutId)
        try {
          audio.pause()
          audio.src = ''
        } catch (e) {
          console.log('[TTS] Error pausing/clearing audio:', e)
        }
        // Revoke URL after a small delay to ensure it's not needed anymore
        setTimeout(() => {
          URL.revokeObjectURL(audioUrl)
        }, 100)
        audioRef.current = null
        audioPromiseRejectRef.current = null
        setIsTTSPlaying(false)
        if (isError) {
          const errorMsg = reason || 'Audio playback error'
          console.error('[TTS] Audio playback failed:', errorMsg, { audioError: audio.error?.code, audioErrorMsg: audio.error?.message, audioState: audio.readyState, audioSrc: !!audioUrl })
          reject(new Error(errorMsg))
        } else {
          console.log('[TTS] Audio playback completed successfully')
          resolve()
        }
      }
      
      audio.onloadstart = () => {
        console.log('[TTS] Audio loadstart event')
      }
      
      audio.onload = () => {
        console.log('[TTS] Audio load event')
      }
      
      audio.oncanplay = () => {
        console.log('[TTS] Audio canplay event')
      }
      
      audio.oncanplaythrough = () => {
        console.log('[TTS] Audio canplaythrough event - fully buffered')
      }
      
      audio.onplaying = () => {
        console.log('[TTS] Audio playing event')
      }
      
      audio.onended = () => {
        console.log('[TTS] Audio ended event')
        cleanup(false)
      }
      
      audio.onpause = () => {
        console.log('[TTS] Audio paused event')
      }
      
      audio.onabort = () => {
        console.error('[TTS] Audio abort event - playback was aborted!')
        cleanup(true, 'Audio playback aborted')
      }
      
      audio.onerror = () => {
        const errorCode = audio.error?.code
        const errorMsg = audio.error?.message || `MediaError code ${errorCode}`
        console.error('[TTS] Audio onerror event:', { code: errorCode, message: errorMsg, readyState: audio.readyState, networkState: audio.networkState })
        cleanup(true, errorMsg)
      }
      
      const playPromise = audio.play()
      console.log('[TTS] audio.play() called, promise available:', !!playPromise)
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[TTS] audio.play() promise resolved - audio playing successfully')
            // Set a generous timeout (120 seconds) in case audio is unusually long
            // This prevents the promise from hanging forever on stuck audio
            timeoutId = setTimeout(() => {
              if (audio.paused === false) {
                console.warn('[TTS] Audio playback timeout - audio still playing after 120s')
              }
            }, 120000)
          })
          .catch((err) => {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error('[TTS] audio.play() promise rejected:', errMsg, { audioState: audio.readyState, err })
            audioPromiseRejectRef.current = null
            cleanup(true, `play() rejected: ${errMsg}`)
          })
      } else {
        console.log('[TTS] audio.play() returned undefined (synchronous play or old browser)')
      }
    })
  }

  // Attempt to unlock audio playback on mobile browsers. This should be called from a user gesture
  // (for example when the user clicks to enable stream mode or press the mic). It resumes/creates
  // an AudioContext and plays a tiny silent buffer to 'unlock' audio on platforms that block
  // programmatic playback until a gesture occurs.
  const unlockAudio = async (): Promise<void> => {
    try {
      if (audioUnlockedRef.current) return
      const win = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
      const AudioCtx = win.AudioContext || win.webkitAudioContext
      if (!AudioCtx) return

      let ctx = audioContextRef.current
      if (!ctx) {
        ctx = new AudioCtx()
        audioContextRef.current = ctx
      }
      // ensure ctx is not null for TS
      if (!ctx) return

      if (ctx.state === 'suspended') {
        // resume the context (must be done in a user gesture)
        // This call can reject on some browsers; swallow errors
        // but proceed to attempt a short buffer playback below.
        await ctx.resume()
      }

      // Play a tiny silent buffer to ensure playback is unlocked for the session
      try {
        const sampleRate = ctx.sampleRate || 44100
        const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(sampleRate * 0.001)), sampleRate)
        const src = ctx.createBufferSource()
        src.buffer = buffer
        src.connect(ctx.destination)
        src.start(0)
        // stop immediately after starting
        try {
          src.stop(0)
        } catch {
          // ignore
        }
      } catch {
        // ignore buffer/play errors
      }

      audioUnlockedRef.current = true
    } catch {
      // Best-effort only; don't break the flow if this fails
      // console.log('unlockAudio failed')
    }
  }

  const handleStopTTS = async () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      
      // Reject the audio promise to stop the async flow
      if (audioPromiseRejectRef.current) {
        audioPromiseRejectRef.current(new Error('Audio stopped by user'))
      }
      
      audioRef.current = null
      audioPromiseRejectRef.current = null
      setIsTTSPlaying(false)
      
      // Stop streaming mode and push-to-talk, return to text mode
      if (streamMode) {
        setStreamMode(false)
        setPushToTalkMode(false)
        // Stop voice input if it's listening
        if (listening) {
          await stop()
        }
      }
      
      // Clear loading state to re-enable chat
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const handleMicClick = async () => {
    if (listening && pushToTalkMode) {
      // Stop push-to-talk
      setPushToTalkMode(false)
      await stop()
    } else if (!streamMode && !pushToTalkMode) {
      // Start push-to-talk mode
      setPushToTalkMode(true)
      // Unlock audio as part of the user gesture so subsequent TTS playback is allowed on mobile
      await unlockAudio()
      await start()
    }
  }

  const handleStreamClick = async () => {
    if (streamMode && listening) {
      // Stop stream mode
      setStreamMode(false)
      setPushToTalkMode(false)
      await stop()
    } else {
      // Start stream mode
      setPushToTalkMode(false)
      setStreamMode(true)
      // Unlock audio as part of the user gesture so subsequent TTS playback is allowed on mobile
      await unlockAudio()
      await start()
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <ChatMessages messages={messages} loading={loading} bottomRef={bottomRef} />

      {error && (
        <div className="mt-4">
          <div className="text-sm text-red-600 mb-2">{error}</div>
        </div>
      )}

      <ChatInput
        input={input}
        setInput={setInput}
        onSend={() => void send()}
        onKeyDown={onKeyDown}
        listening={listening}
        onMicClick={handleMicClick}
        onStreamClick={handleStreamClick}
        loading={loading}
        streamMode={streamMode}
        pushToTalkMode={pushToTalkMode}
        isTTSPlaying={isTTSPlaying}
        onStopTTS={handleStopTTS}
      />
    </div>
  )
}
