'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ConversationState, ConversationResponse } from '@/lib/voice/types'

// TODO: Add automatic language detection in the future
// For now, we're focusing on solidifying the English language experience
// Once stable, we'll add auto-detection and enable translation

export interface UseTurnByTurnOptions {
    onTranscript?: (text: string) => void
    onResponse?: (text: string) => void
    onError?: (error: string) => void
    onTranscribing?: () => void  // Called when transcription starts
    autoContinue?: boolean
    threadId?: string | null
}

export function useTurnByTurn(options: UseTurnByTurnOptions = {}) {
    const [state, setState] = useState<ConversationState>('idle')
    const [error, setError] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [stream, setStream] = useState<MediaStream | null>(null)

    // Language is hardcoded to English for now
    // TODO: Implement auto-detection and translation later
    const language = 'en-US'

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const audioContextRef = useRef<AudioContext | null>(null)
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const transcribeAbortRef = useRef<AbortController | null>(null)
    const aiAbortRef = useRef<AbortController | null>(null)
    const isAbortedRef = useRef<boolean>(false)  // Track if user manually stopped

    // Initialize AudioContext
    useEffect(() => {
        const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (AudioContextClass) {
            audioContextRef.current = new AudioContextClass()
        }
        return () => {
            if (audioContextRef.current?.state !== 'closed') {
                audioContextRef.current?.close()
            }
        }
    }, [])

    const stopAudio = useCallback(() => {
        if (sourceNodeRef.current) {
            try {
                sourceNodeRef.current.stop()
            } catch (e) {
                // Ignore errors if already stopped
            }
            sourceNodeRef.current = null
        }
        setIsSpeaking(false)
        setState('idle')
    }, [])

    const startRecording = useCallback(async () => {
        try {
            // Stop any playing audio
            stopAudio()

            // Reset abort flag
            isAbortedRef.current = false

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            })

            streamRef.current = stream
            setStream(stream)

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/mp4'
            })

            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, {
                    type: mediaRecorder.mimeType
                })

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop())
                setStream(null)
                streamRef.current = null
                setIsRecording(false)

                // Only process if we have data AND user didn't manually abort
                if (audioBlob.size > 0 && !isAbortedRef.current) {
                    processAudio(audioBlob)
                } else {
                    setState('idle')
                }
            }

            mediaRecorder.start()
            setIsRecording(true)
            setState('recording')
            setError(null)

        } catch (err) {
            console.error('Failed to start recording:', err)
            setError('Could not access microphone')
            setState('error')
        }
    }, [stopAudio]) // processAudio is defined below, but we need to break circular dependency or use ref

    const playAudio = useCallback(async (base64Audio: string) => {
        if (!audioContextRef.current) return

        try {
            // iOS Safari requires AudioContext to be resumed after user interaction
            // This fixes the issue where audio doesn't play after the first time
            if (audioContextRef.current.state === 'suspended') {
                console.log('[Audio] Resuming suspended AudioContext (iOS fix)')
                await audioContextRef.current.resume()
            }

            // Decode base64
            const binaryString = window.atob(base64Audio)
            const len = binaryString.length
            const bytes = new Uint8Array(len)
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }

            // Decode audio data
            const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer)

            // Stop any current audio
            stopAudio()

            // Create source
            const source = audioContextRef.current.createBufferSource()
            source.buffer = audioBuffer
            source.connect(audioContextRef.current.destination)

            source.onended = () => {
                setIsSpeaking(false)
                setState('idle')

                // Auto-continue loop
                if (options.autoContinue) {
                    console.log('Audio ended, restarting recording loop...')
                    setTimeout(() => {
                        startRecording()
                    }, 500)
                }
            }

            sourceNodeRef.current = source
            source.start(0)
            setIsSpeaking(true)
            setState('speaking')

            console.log('[Audio] Playback started successfully')

        } catch (err) {
            console.error('Error playing audio:', err)
            setError('Failed to play audio response')
            setState('idle')
        }
    }, [stopAudio, options.autoContinue, startRecording])

    const processAudio = useCallback(async (audioBlob: Blob) => {
        setState('processing')
        setIsProcessing(true)
        setError(null)

        try {
            // Step 1: Transcribe Audio
            options.onTranscribing?.()  // Notify that transcription is starting

            const transcribeFormData = new FormData()
            transcribeFormData.append('audio', audioBlob)
            transcribeFormData.append('language', language)  // Always English for now

            transcribeAbortRef.current = new AbortController()

            const transcribeRes = await fetch('/api/voice/transcribe', {
                method: 'POST',
                body: transcribeFormData,
                signal: transcribeAbortRef.current.signal,
            })

            if (!transcribeRes.ok) {
                throw new Error('Transcription failed')
            }

            const transcribeData = await transcribeRes.json()
            const transcript = transcribeData.transcript

            if (!transcript) {
                throw new Error('No speech detected')
            }

            // Immediate feedback: Show user what they said
            options.onTranscript?.(transcript)

            // Step 2: Get AI Response
            console.log('[useTurnByTurn] Calling /api/conversation/turn with language:', language)
            aiAbortRef.current = new AbortController()

            const turnRes = await fetch('/api/conversation/turn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',  // Include cookies for auth
                body: JSON.stringify({
                    message: transcript,
                    language: language,  // Always English
                    threadId: options.threadId,
                }),
                signal: aiAbortRef.current.signal,
            })

            if (!turnRes.ok) {
                throw new Error('Failed to get response')
            }

            const turnData: ConversationResponse = await turnRes.json()

            // Show AI response text
            options.onResponse?.(turnData.response)

            // Play AI response audio
            if (turnData.audioBase64) {
                await playAudio(turnData.audioBase64)
            } else {
                setState('idle')
            }

        } catch (err) {
            // Ignore abort errors
            if (err instanceof Error && err.name === 'AbortError') {
                console.log('Request was aborted')
                setState('idle')
                return
            }

            console.error('Turn processing error:', err)
            const errorMessage = err instanceof Error ? err.message : 'Processing failed'
            setError(errorMessage)
            options.onError?.(errorMessage)
            setState('error')
        } finally {
            setIsProcessing(false)
            transcribeAbortRef.current = null
            aiAbortRef.current = null
        }
    }, [language, options, playAudio])

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
            // Stream tracks will be stopped in onstop handler
        }
    }, [])

    const stopAll = useCallback(() => {
        // Set abort flag to prevent audio processing
        isAbortedRef.current = true

        // Stop recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
        }

        // Abort ongoing requests
        if (transcribeAbortRef.current) {
            transcribeAbortRef.current.abort()
            transcribeAbortRef.current = null
        }
        if (aiAbortRef.current) {
            aiAbortRef.current.abort()
            aiAbortRef.current = null
        }

        // Stop audio playback
        stopAudio()

        // Reset state
        setIsProcessing(false)
        setState('idle')
    }, [stopAudio])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopAudio()
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
            }
        }
    }, [stopAudio])

    // Language is fixed to English
    useEffect(() => {
        console.log('[useTurnByTurn] Using language:', language)
    }, [language])

    return {
        state,
        error,
        isRecording,
        isProcessing,
        isSpeaking,
        stream,
        startRecording,
        stopRecording,
        stopAudio,
        stopAll,  // New: stop everything
    }
}
