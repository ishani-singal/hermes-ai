'use client'

import { useEffect, useRef, useState } from 'react'
import { SilenceDetectorConfig } from '@/lib/voice/types'

interface SilenceDetectorProps {
    stream: MediaStream | null
    onSilenceDetected: () => void
    config?: Partial<SilenceDetectorConfig>
    enabled?: boolean
}

export function SilenceDetector({
    stream,
    onSilenceDetected,
    config = {},
    enabled = true
}: SilenceDetectorProps) {
    const [volume, setVolume] = useState(0)
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyzerRef = useRef<AnalyserNode | null>(null)
    const silenceStartRef = useRef<number | null>(null)
    const animationFrameRef = useRef<number | null>(null)

    const silenceThreshold = config.silenceThreshold ?? -50
    const silenceDuration = config.silenceDuration ?? 2000
    const minVolumeDb = -100 // Minimum possible volume in dB
    const noiseFloorRef = useRef<number>(minVolumeDb)
    const noiseAlpha = 0.05 // Smoothing factor for noise floor (slow adaptation)

    useEffect(() => {
        if (!stream || !enabled) {
            // Cleanup
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
            if (audioContextRef.current) {
                void audioContextRef.current.close()
                audioContextRef.current = null
            }
            return
        }

        // Initialize audio context and analyzer
        const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext
        if (!AudioContextClass) return
        const audioContext = new AudioContextClass()

        // Resume audio context on iOS Safari (requires user gesture)
        if (audioContext.state === 'suspended') {
            void audioContext.resume()
        }

        const source = audioContext.createMediaStreamSource(stream)
        const analyzer = audioContext.createAnalyser()

        analyzer.fftSize = 2048
        analyzer.smoothingTimeConstant = 0.8
        source.connect(analyzer)

        audioContextRef.current = audioContext
        analyzerRef.current = analyzer

        const bufferLength = analyzer.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        // Reset noise floor when stream starts
        noiseFloorRef.current = minVolumeDb

        const checkVolume = () => {
            if (!analyzerRef.current) return

            analyzerRef.current.getByteFrequencyData(dataArray)

            // Calculate average volume
            const average = dataArray.reduce((a, b) => a + b) / bufferLength

            // Convert to decibels
            // 20 * log10(average / 255) gives range roughly -Infinity to 0
            const currentDb = average > 0 ? 20 * Math.log10(average / 255) : minVolumeDb

            // Update UI volume (0-100 scale)
            setVolume(Math.max(0, Math.min(100, ((currentDb + 100) / 100) * 100)))

            // Adaptive Noise Floor Logic
            // If current volume is low (likely silence/noise), update noise floor
            // We assume anything below -30dB could be background noise in a quiet room,
            // or we track the minimums.
            // Simple approach: Slowly adapt noise floor towards current volume if it's steady
            if (currentDb > minVolumeDb) {
                // Initialize noise floor if it's the first reading
                if (noiseFloorRef.current === minVolumeDb) {
                    noiseFloorRef.current = currentDb
                } else {
                    // Adapt noise floor: if current is lower, drop quickly. If higher, rise slowly.
                    if (currentDb < noiseFloorRef.current) {
                        noiseFloorRef.current = currentDb // Drop quickly to new low
                    } else {
                        noiseFloorRef.current = noiseFloorRef.current * (1 - noiseAlpha) + currentDb * noiseAlpha
                    }
                }
            }

            // Dynamic Threshold: Noise Floor + Margin (e.g., 10dB)
            // But clamp it so it doesn't get too high (e.g., never above -20dB)
            // And never below the absolute silence threshold config
            const margin = 15 // dB above noise floor to consider as speech
            const adaptiveThreshold = Math.min(-20, Math.max(silenceThreshold, noiseFloorRef.current + margin))

            // Check for silence vs speech
            if (currentDb < adaptiveThreshold) {
                if (!silenceStartRef.current) {
                    silenceStartRef.current = Date.now()
                } else if (Date.now() - silenceStartRef.current > silenceDuration) {
                    // Silence detected for long enough
                    onSilenceDetected()
                    silenceStartRef.current = null
                    return // Stop checking after detection
                }
            } else {
                // Reset silence timer if sound detected above threshold
                silenceStartRef.current = null
            }

            animationFrameRef.current = requestAnimationFrame(checkVolume)
        }

        checkVolume()

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
            if (audioContextRef.current) {
                void audioContextRef.current.close()
            }
        }
    }, [stream, enabled, onSilenceDetected, silenceThreshold, silenceDuration])

    if (!enabled || !stream) return null

    return (
        <div className="flex items-center gap-2 px-4 py-2">
            <span className="text-xs text-gray-500">Volume:</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[200px]">
                <div
                    className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-100"
                    style={{ width: `${volume}%` }}
                />
            </div>
        </div>
    )
}
