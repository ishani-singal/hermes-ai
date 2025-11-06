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
  const [isTTSPlaying, setIsTTSPlaying] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioUnlockedRef = useRef(false)
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null)

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

      if (lastSentRef.current && lastSentRef.current.text === text && now - lastSentRef.current.time < 2000) {
        resetFinal()
        return
      }

      if (!streamMode) {
        if (pushToTalkMode) {
          processingRef.current = true
          ;(async () => {
            try {
              await stop()
              resetFinal()
            } finally {
              processingRef.current = false
            }
          })()
        }
        return
      }

      processingRef.current = true
      ;(async () => {
        try {
          await stop()
          await send(text)
          setInput('')
          lastSentRef.current = { text, time: Date.now() }
          resetFinal()
          
          setTimeout(() => {
            void start()
          }, 500)
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

      const responseThreadId = json?.data?.threadId || json?.threadId
      if (responseThreadId && responseThreadId !== threadId) {
        setThreadId(responseThreadId)
      }

      const assistantText =
        json?.assistant?.text ?? json?.data?.assistant?.text ?? json?.message ?? JSON.stringify(json)
      const audioBase64 = json?.assistant?.audioBase64 ?? json?.data?.assistant?.audioBase64

      const assistantMessage: Message = {
        id: 'a-' + String(Date.now()) + Math.random().toString(16).slice(2),
        role: 'assistant',
        text: String(assistantText),
      }

      setMessages((m) => [...m, assistantMessage])

      if (audioBase64 && streamMode) {
        try {
          await stop()
          
          const audioBlob = base64ToBlob(audioBase64, 'audio/mpeg')
          await playAudioBlob(audioBlob)
          
          setTimeout(() => {
            if (streamMode) {
              void start()
            }
          }, 500)
        } catch (audioErr) {
          const isUserStop = audioErr instanceof Error && audioErr.message === 'Audio stopped by user'
          
          if (!isUserStop && streamMode) {
            setTimeout(() => {
              if (streamMode) {
                void start()
              }
            }, 500)
          }
        }
      }
    } catch (err: unknown) {
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
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  const playAudioBlob = async (blob: Blob): Promise<void> => {
    if (!audioUnlockedRef.current || !audioContextRef.current) {
      throw new Error('Audio not unlocked')
    }

    return new Promise((resolve, reject) => {
      setIsTTSPlaying(true)

      blob.arrayBuffer()
        .then(arrayBuffer => audioContextRef.current!.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          const source = audioContextRef.current!.createBufferSource()
          source.buffer = audioBuffer
          source.connect(audioContextRef.current!.destination)
          
          currentAudioSourceRef.current = source
          
          source.onended = () => {
            currentAudioSourceRef.current = null
            setIsTTSPlaying(false)
            resolve()
          }
          
          source.start(0)
        })
        .catch(err => {
          currentAudioSourceRef.current = null
          setIsTTSPlaying(false)
          reject(err)
        })
    })
  }

  const handleStopTTS = async () => {
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop()
      } catch {
        // ignore if already stopped
      }
      currentAudioSourceRef.current = null
      setIsTTSPlaying(false)
      
      if (streamMode) {
        setStreamMode(false)
        setPushToTalkMode(false)
        if (listening) {
          await stop()
        }
      }
      
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const handleMicClick = () => {
    if (listening && pushToTalkMode) {
      void (async () => {
        setPushToTalkMode(false)
        await stop()
      })()
    } else if (!streamMode && !pushToTalkMode) {
      // Best-effort audio unlock for push-to-talk
      try {
        if (!audioUnlockedRef.current) {
          const win = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
          const AudioCtx = win.AudioContext || win.webkitAudioContext
          if (AudioCtx) {
            const ctx = audioContextRef.current || new AudioCtx()
            audioContextRef.current = ctx

            if (ctx.state === 'suspended') {
              void ctx.resume()
            }

            const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
            const src = ctx.createBufferSource()
            src.buffer = buffer
            src.connect(ctx.destination)
            src.start(0)

            audioUnlockedRef.current = true
          }
        }
      } catch {
        // Best-effort
      }

      void (async () => {
        setPushToTalkMode(true)
        await start()
      })()
    }
  }

  const handleStreamClick = () => {
    // Immediately unlock audio synchronously in the same tick as user gesture for iOS
    try {
      if (!audioUnlockedRef.current) {
        const win = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
        const AudioCtx = win.AudioContext || win.webkitAudioContext
        if (AudioCtx) {
          const ctx = audioContextRef.current || new AudioCtx()
          audioContextRef.current = ctx

          if (ctx.state === 'suspended') {
            void ctx.resume()
          }

          const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
          const src = ctx.createBufferSource()
          src.buffer = buffer
          src.connect(ctx.destination)
          src.start(0)

          audioUnlockedRef.current = true
        }
      }
    } catch {
      // Best-effort
    }

    // Then continue async stream logic
    void (async () => {
      if (streamMode && listening) {
        setStreamMode(false)
        setPushToTalkMode(false)
        await stop()
      } else {
        setPushToTalkMode(false)
        setStreamMode(true)
        await start()
      }
    })()
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
