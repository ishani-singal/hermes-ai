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
        console.debug('Skipping duplicate final transcript send:', text)
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

      const assistantMessage: Message = {
        id: 'a-' + String(Date.now()) + Math.random().toString(16).slice(2),
        role: 'assistant',
        text: String(assistantText),
      }

      setMessages((m) => [...m, assistantMessage])

      // If we have audio and we're in stream mode, play it
      if (audioBase64 && streamMode) {
        try {
          // Stop listening before playing TTS to prevent self-talking loop
          await stop()
          
          // Convert base64 to blob and play
          const audioBlob = base64ToBlob(audioBase64, 'audio/mpeg')
          await playAudioBlob(audioBlob)
          
          // Resume listening after audio finishes (only if still in stream mode)
          setTimeout(() => {
            if (streamMode) {
              void start()
            }
          }, 500)
        } catch (audioErr) {
          // Check if this was a user-initiated stop (not an actual error)
          const isUserStop = audioErr instanceof Error && audioErr.message === 'Audio stopped by user'
          
          // Only resume if user didn't manually stop and stream mode is still on
          if (!isUserStop && streamMode) {
            console.error('Audio playback error:', audioErr)
            // Resume listening even if audio fails (but not if user stopped)
            setTimeout(() => {
              if (streamMode) {
                void start()
              }
            }, 500)
          }
          // If user stopped, don't resume listening (they wanted to stop)
        }
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
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  // Helper to play audio blob
  const playAudioBlob = async (blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audioUrl = URL.createObjectURL(blob)
      const audio = new Audio(audioUrl)
      
      // Store reference and reject function for potential stopping
      audioRef.current = audio
      audioPromiseRejectRef.current = reject
      setIsTTSPlaying(true)
      
      const cleanup = (isError: boolean) => {
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        audioPromiseRejectRef.current = null
        setIsTTSPlaying(false)
        if (isError) {
          reject(new Error('Audio playback error'))
        } else {
          resolve()
        }
      }
      
      audio.onended = () => cleanup(false)
      audio.onerror = () => cleanup(true)
      audio.play().catch((err) => {
        audioPromiseRejectRef.current = null
        cleanup(true)
      })
    })
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
