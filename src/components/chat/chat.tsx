"use client"

import { useEffect, useRef, useState } from 'react'
import { useVoiceFactory, VoiceMode } from '@/hooks/useVoiceFactory'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { SilenceDetector } from '@/components/voice/SilenceDetector'
import { X, Loader2, FileText } from 'lucide-react'

// Switch this to 'turn-by-turn' to use Google Transcribe + TTS
// Switch this to 'web-speech' to use Browser Speech API (STT only)
const VOICE_MODE: VoiceMode = 'web-speech'

export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  photoAttachment?: {
    id: string
    uploadId: string
    displayId?: string
    previewUrl: string
  }
  documentAttachment?: {
    id: string
    uploadId: string
    displayId?: string
    fileName: string
  }
}

type ChatProps = {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  threadId: string | null
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>
}

type PhotoAttachment = {
  id: string
  file: File
  previewUrl: string
  status: 'uploading' | 'analyzing' | 'ready' | 'error'
  uploadId?: string
}

type DocumentAttachment = {
  id: string
  file: File
  status: 'uploading' | 'processing' | 'ready' | 'error'
  uploadId?: string
  displayId?: string
}

export function Chat({ messages, setMessages, threadId, setThreadId }: ChatProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoAttachment[]>([])
  const [documents, setDocuments] = useState<DocumentAttachment[]>([])
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const [streamMode, setStreamMode] = useState(false)
  const streamModeRef = useRef(false)
  const [pushToTalkMode, setPushToTalkMode] = useState(false)
  const isAutoRestarting = useRef(false)
  const [isTTSPlaying, setIsTTSPlaying] = useState(false)


  // Audio playback refs (for mobile compatibility)
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)

  // Voice Factory Hook (handles both Web Speech and Turn-by-Turn)
  const {
    state: voiceState,
    error: voiceError,
    start,
    stop,
    stopAll,
    isRecording,
    isProcessing,
    stream,
    partial,
  } = useVoiceFactory({
    mode: VOICE_MODE,
    onTranscribing: () => {
      // Add temporary "Transcribing..." message (right side - user)
      const transcribingMessage: Message = {
        id: 'transcribing-' + String(Date.now()),
        role: 'user',
        text: 'Transcribing...',
      }
      setMessages((m) => [...m, transcribingMessage])
    },
    onTranscript: (text) => {
      // Remove transcribing message and add actual user message
      setMessages((m) => {
        const filtered = m.filter(msg => !msg.id.startsWith('transcribing-'))
        return [...filtered, {
          id: String(Date.now()) + Math.random().toString(16).slice(2),
          role: 'user',
          text,
        }]
      })

      // Add "Thinking..." message (left side - assistant)
      const thinkingMessage: Message = {
        id: 'thinking-' + String(Date.now()),
        role: 'assistant',
        text: 'Thinking...',
      }
      setMessages((m) => [...m, thinkingMessage])
    },
    onResponse: (text) => {
      // Remove thinking message and add actual assistant message
      setMessages((m) => {
        const filtered = m.filter(msg => !msg.id.startsWith('thinking-'))
        return [...filtered, {
          id: 'a-' + String(Date.now()) + Math.random().toString(16).slice(2),
          role: 'assistant',
          text,
        }]
      })
    },
    onError: (err) => {
      // Remove any temporary messages on error
      setMessages((m) => m.filter(msg => !msg.id.startsWith('transcribing-') && !msg.id.startsWith('thinking-')))
      setError(err)
    },
    onThreadIdUpdate: (newThreadId) => {
      // Update threadId for conversation continuity
      if (newThreadId && newThreadId !== threadId) {
        console.log('[Chat] Updating threadId:', newThreadId)
        setThreadId(newThreadId)
      }
    },
    // Callback for Web Speech mode
    onFinalTranscript: (text) => {
      if (streamMode) {
        stop() // Stop listening immediately to prevent echo/self-recording
        void send(text, true)
      } else {
        // Dictation mode: update input and stop
        setInput(text)
        stop()
        setPushToTalkMode(false)
      }
    },
    autoContinue: true,
    threadId: threadId
  })

  // Initialize AudioContext for mobile-friendly audio playback
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass && !audioContextRef.current) {
      audioContextRef.current = new AudioContextClass()
    }
    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close()
      }
    }
  }, [])

  // Unlock audio on first user interaction (required for mobile)
  useEffect(() => {
    const unlockAudio = async () => {
      if (audioContextRef.current && !audioUnlockedRef.current) {
        try {
          await audioContextRef.current.resume()
          audioUnlockedRef.current = true
          console.log('[Audio] AudioContext unlocked')
        } catch (e) {
          console.warn('[Audio] Failed to unlock AudioContext:', e)
        }
      }
    }

    // Listen for any user interaction to unlock audio
    const events = ['touchstart', 'touchend', 'mousedown', 'keydown']
    events.forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, unlockAudio)
      })
    }
  }, [])

  // Helper: Convert base64 to Blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  // Helper: Play audio blob using Web Audio API (mobile-friendly) with HTML5 fallback
  const playAudioBlob = async (blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      setIsTTSPlaying(true)

      // Try AudioContext first (better for mobile when unlocked)
      if (audioUnlockedRef.current && audioContextRef.current) {
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
            console.warn('[Audio] AudioContext playback failed, trying HTML5 Audio fallback:', err)
            // Fallback to HTML5 Audio
            playAudioFallback(blob, resolve, reject)
          })
      } else {
        // AudioContext not ready, use HTML5 Audio fallback
        console.log('[Audio] AudioContext not unlocked, using HTML5 Audio')
        playAudioFallback(blob, resolve, reject)
      }
    })
  }

  // Fallback: Play audio using HTML5 Audio element
  const playAudioFallback = (blob: Blob, resolve: () => void, reject: (err: unknown) => void) => {
    const audioUrl = URL.createObjectURL(blob)
    const audio = new Audio(audioUrl)
    currentAudioElementRef.current = audio

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      currentAudioElementRef.current = null
      setIsTTSPlaying(false)
      resolve()
    }

    audio.onerror = (e) => {
      URL.revokeObjectURL(audioUrl)
      currentAudioElementRef.current = null
      setIsTTSPlaying(false)
      reject(e)
    }

    audio.play().catch(err => {
      URL.revokeObjectURL(audioUrl)
      currentAudioElementRef.current = null
      setIsTTSPlaying(false)
      reject(err)
    })
  }

  // Helper: Stop TTS playback
  const handleStopTTS = async () => {
    streamModeRef.current = false
    // Stop recording FIRST if it's active (before changing streamMode)
    if (isRecording) {
      await stop()
    }

    // Stop AudioContext source if it exists
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop()
      } catch {
        // ignore if already stopped
      }
      currentAudioSourceRef.current = null
    }

    // Stop HTML5 Audio if it exists
    if (currentAudioElementRef.current) {
      try {
        currentAudioElementRef.current.pause()
        currentAudioElementRef.current.currentTime = 0
      } catch {
        // ignore error
      }
      currentAudioElementRef.current = null
    }

    // Always reset TTS playing state (handles both AudioContext and HTML5 Audio)
    setIsTTSPlaying(false)

    // Reset stream mode states
    if (streamMode) {
      setStreamMode(false)
      setPushToTalkMode(false)
    }

    setLoading(false)
  }

  // Effect to scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, voiceState])

  // Effect to update input with partial transcript (Web Speech mode)
  useEffect(() => {
    if (VOICE_MODE === 'web-speech' && isRecording && partial) {
      setInput(partial)
    }
  }, [isRecording, partial])

  useEffect(() => {
    if (voiceError) {
      if (isAutoRestarting.current) {
        // Suppress error during auto-restart (e.g. iOS permission issues)
        console.warn('Suppressed voice error during auto-restart:', voiceError)
      } else {
        setError(voiceError)
      }
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

  const send = async (text?: string, isVoice: boolean = false) => {
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
          streamMode: isVoice, // Enable TTS if voice
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

      const assistantMessage: Message = {
        id: 'a-' + String(Date.now()) + Math.random().toString(16).slice(2),
        role: 'assistant',
        text: String(assistantText),
      }

      setMessages((m) => [...m, assistantMessage])

      // Clear loading state immediately - we have the response
      setLoading(false)

      // If we have audio response and we are in web-speech mode (or just requested voice), play it
      if (json?.assistant?.audioBase64) {
        try {
          const audioBlob = base64ToBlob(json.assistant.audioBase64, 'audio/mpeg')

          await playAudioBlob(audioBlob)

          // After audio ends, try to restart listening if in stream mode
          if (VOICE_MODE === 'web-speech' && isVoice && streamModeRef.current) {
            console.log('Audio ended, waiting before restarting listening...')
            // Add delay to prevent recording the tail of the audio/echo
            setTimeout(async () => {
              try {
                isAutoRestarting.current = true
                await start()
                // Reset flag after a short delay to allow error effect to process if needed
                setTimeout(() => { isAutoRestarting.current = false }, 1000)
              } catch (restartErr) {
                // Gracefully handle restart failure (e.g., iOS mic permission issues)
                console.warn('Failed to restart listening after TTS, exiting stream mode:', restartErr)
                streamModeRef.current = false
                setStreamMode(false)
                setPushToTalkMode(false)
                isAutoRestarting.current = false
              }
            }, 500)
          }
        } catch (audioErr) {
          // Gracefully handle audio playback failure
          console.warn('Audio playback failed:', audioErr)
          // If in stream mode and audio failed, exit gracefully
          if (streamMode) {
            console.log('Audio playback failed in stream mode, exiting gracefully')
            streamModeRef.current = false
            setStreamMode(false)
            setPushToTalkMode(false)
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
    if (isRecording) {
      setPushToTalkMode(false)
      stop()
    } else {
      // If stream mode is active, stop it first
      if (streamMode) {
        streamModeRef.current = false
        setStreamMode(false)
        stop()
        return
      }
      setPushToTalkMode(true)
      void start()
    }
  }

  const handleTurnByTurnClick = () => {
    if (isTTSPlaying || loading) {
      streamModeRef.current = false
      void handleStopTTS()
      return
    }

    if (streamMode && isRecording) {
      streamModeRef.current = false
      setStreamMode(false)
      stopAll()
    } else {
      // If push to talk is active, stop it first
      if (pushToTalkMode) {
        setPushToTalkMode(false)
      }
      streamModeRef.current = true
      setStreamMode(true)
      void start()
    }
  }

  const handlePhotoSelect = async (file: File) => {
    const id = Math.random().toString(36).substring(7)
    const previewUrl = URL.createObjectURL(file)

    const newPhoto: PhotoAttachment = {
      id,
      file,
      previewUrl,
      status: 'uploading'
    }

    setPhotos(prev => [...prev, newPhoto])

    // Upload photo
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      const photoId = data.data.id
      const displayId = data.data.metadata?.display_id

      // Move photo to chat immediately with "analyzing" status
      const photoAttachment = {
        id,
        uploadId: photoId,
        displayId,
        previewUrl,
      }

      const analyzingMessage: Message = {
        id: 'analyzing-' + String(Date.now()) + Math.random().toString(16).slice(2),
        role: 'assistant',
        text: '',
        photoAttachment,
      }

      setMessages((m) => [...m, analyzingMessage])

      // Remove photo from attachment area - it's now in the chat
      setPhotos(prev => prev.filter(p => p.id !== id))

      // Auto-send message to agent with photo reference (silently)
      const photoRef = displayId || photoId
      const message = `I uploaded a photo (${photoRef}). Can you analyze it and tell me what you see?`

      // Call agent to analyze
      setLoading(true)

      try {
        const aiRes = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message,
            threadId: threadId || undefined,
          }),
        })

        if (!aiRes.ok) {
          throw new Error('AI analysis failed')
        }

        const json = await aiRes.json()

        const responseThreadId = json?.data?.threadId || json?.threadId
        if (responseThreadId && responseThreadId !== threadId) {
          setThreadId(responseThreadId)
        }

        const assistantText =
          json?.assistant?.text ?? json?.data?.assistant?.text ?? json?.message ?? JSON.stringify(json)

        // Replace the "analyzing" message with the actual analysis
        setMessages((m) => m.map(msg =>
          msg.id === analyzingMessage.id
            ? {
              ...msg,
              text: String(assistantText),
            }
            : msg
        ))

      } catch (aiErr) {
        console.error('AI analysis error:', aiErr)
        setMessages((m) => [
          ...m,
          {
            id: 'a-err-' + String(Date.now()),
            role: 'assistant',
            text: 'Sorry — I had trouble analyzing the photo. ' + (aiErr instanceof Error ? aiErr.message : ''),
          },
        ])

        setPhotos(prev => prev.map(p =>
          p.id === id
            ? { ...p, status: 'error' }
            : p
        ))
      } finally {
        setLoading(false)
      }

    } catch (err) {
      console.error('Photo upload error:', err)
      setPhotos(prev => prev.map(p =>
        p.id === id
          ? { ...p, status: 'error' }
          : p
      ))
    }
  }

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id)
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl)
      }
      return prev.filter(p => p.id !== id)
    })
  }

  const handleDocumentSelect = async (file: File) => {
    const id = Math.random().toString(36).substring(7)

    const newDoc: DocumentAttachment = {
      id,
      file,
      status: 'uploading'
    }

    setDocuments(prev => [...prev, newDoc])

    try {
      const formData = new FormData()
      formData.append('file', file)
      // Use filename (without extension) as title
      const fileName = file.name.replace(/\.[^/.]+$/, '')
      formData.append('title', fileName)
      formData.append('type', 'other') // Default type
      formData.append('scope', 'company') // Default scope

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      const docId = data.data?.id || data.id
      const displayId = data.data?.display_id || data.display_id

      // Remove from attachment area - document will appear in chat
      setDocuments(prev => prev.filter(d => d.id !== id))

      // Add analyzing message to chat with document reference
      const docRef = displayId || docId
      const analyzingMessage: Message = {
        id: 'analyzing-doc-' + String(Date.now()) + Math.random().toString(16).slice(2),
        role: 'assistant',
        text: '',
        documentAttachment: {
          id,
          uploadId: docId,
          displayId,
          fileName: file.name,
        },
      }

      setMessages((m) => [...m, analyzingMessage])

      // Auto-send message to agent to analyze document (mirror photo pattern)
      const message = `I uploaded a document "${file.name}" (${docRef}). Can you analyze it and tell me what it contains?`

      // Call agent to analyze
      setLoading(true)

      try {
        const aiRes = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message,
            threadId: threadId || undefined,
          }),
        })

        if (!aiRes.ok) {
          throw new Error('AI analysis failed')
        }

        const json = await aiRes.json()

        const responseThreadId = json?.data?.threadId || json?.threadId
        if (responseThreadId && responseThreadId !== threadId) {
          setThreadId(responseThreadId)
        }

        const assistantText =
          json?.assistant?.text ?? json?.data?.assistant?.text ?? json?.message ?? JSON.stringify(json)

        // Replace the "analyzing" message with the actual analysis
        setMessages((m) => m.map(msg =>
          msg.id === analyzingMessage.id
            ? {
              ...msg,
              text: String(assistantText),
            }
            : msg
        ))

      } catch (aiErr) {
        console.error('AI analysis error:', aiErr)
        setMessages((m) => [
          ...m,
          {
            id: 'a-err-' + String(Date.now()),
            role: 'assistant',
            text: 'Sorry — I had trouble analyzing the document. ' + (aiErr instanceof Error ? aiErr.message : ''),
          },
        ])
      } finally {
        setLoading(false)
      }

    } catch (err) {
      console.error('Document upload error:', err)
      setDocuments(prev => prev.map(d =>
        d.id === id
          ? { ...d, status: 'error' }
          : d
      ))
    }
  }

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatMessages messages={messages} loading={loading} bottomRef={bottomRef} />
      </div>

      {/* Input area with sticky positioning for mobile */}
      <div className="flex-shrink-0 bg-white">
        {/* Photo Previews */}
        {photos.length > 0 && (
          <div className="px-4 pt-2 flex gap-2 overflow-x-auto">
            {photos.map(photo => (
              <div key={photo.id} className="relative group flex-shrink-0">
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt="Preview"
                    className={`w-full h-full object-cover ${photo.status === 'uploading' ? 'opacity-50' : ''}`}
                  />
                </div>

                {photo.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                  </div>
                )}

                {photo.status === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-50/80">
                    <span className="text-xs text-red-600 font-medium">Error</span>
                  </div>
                )}

                <button
                  onClick={() => removePhoto(photo.id)}
                  title="Remove photo"
                  className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Document Previews */}
        {documents.length > 0 && (
          <div className="px-4 pt-2 flex gap-2 overflow-x-auto">
            {documents.map(doc => (
              <div key={doc.id} className="relative group flex-shrink-0">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 ${doc.status === 'uploading' ? 'opacity-50' : ''}`}>
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700 max-w-[120px] truncate">
                    {doc.file.name}
                  </span>

                  {(doc.status === 'uploading' || doc.status === 'processing') && (
                    <Loader2 className="w-4 h-4 text-brand animate-spin" />
                  )}
                </div>

                {doc.status === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 rounded-lg">
                    <span className="text-xs text-red-600 font-medium">Error</span>
                  </div>
                )}

                <button
                  onClick={() => removeDocument(doc.id)}
                  title="Remove document"
                  className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="px-4 mt-2">
            <div className="text-sm text-red-600 mb-2">{error}</div>
          </div>
        )}

        <div className="border-t border-gray-100">
          {/* Silence Detector (only visible when recording) */}
          <SilenceDetector
            stream={stream}
            onSilenceDetected={() => {
              console.log('Silence detected, stopping recording...')
              stop()
            }}
            enabled={isRecording}
          />

          <ChatInput
            input={input}
            setInput={setInput}
            onSend={() => void send()}
            onKeyDown={onKeyDown}
            listening={isRecording}
            onMicClick={handleMicClick}
            onTurnByTurnClick={handleTurnByTurnClick}
            loading={loading || isProcessing}
            streamMode={streamMode}
            pushToTalkMode={pushToTalkMode}
            turnByTurnMode={true}
            isTTSPlaying={isTTSPlaying}
            onStopTTS={handleStopTTS}
            onPhotoSelect={handlePhotoSelect}
            onDocumentSelect={handleDocumentSelect}
          />
        </div>
      </div>
    </div>
  )
}
