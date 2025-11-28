import { SpeechClient } from '@google-cloud/speech'

/**
 * Configuration options for STT
 */
export interface STTOptions {
    languageCode?: string
    encoding?: 'WEBM_OPUS' | 'MP3' | 'LINEAR16' | 'OGG_OPUS'
    sampleRateHertz?: number
}

/**
 * Result from STT transcription
 */
export interface STTResult {
    transcript: string
    confidence: number
    language: string
}

/**
 * Transcribes audio using Google Cloud Speech-to-Text
 * 
 * @param audioBuffer - The audio data as a Buffer
 * @param options - Optional configuration for language and encoding
 * @returns Object containing transcript, confidence, and detected language
 */
export async function transcribeAudio(
    audioBuffer: Buffer,
    options: STTOptions = {}
): Promise<STTResult> {
    const {
        languageCode = 'en-US',
        encoding = 'WEBM_OPUS',
        sampleRateHertz = 48000,
    } = options

    try {
        // Get Google Cloud API key from environment
        const apiKey = process.env.GOOGLE_CLOUD_SPEECH_API_KEY
        if (!apiKey) {
            throw new Error('GOOGLE_CLOUD_SPEECH_API_KEY not configured')
        }

        // Initialize Speech client with API key
        const client = new SpeechClient({
            apiKey,
        })

        // Configure recognition request
        const audio = {
            content: audioBuffer.toString('base64'),
        }

        const config = {
            encoding,
            sampleRateHertz,
            languageCode,
            // Enable automatic punctuation
            enableAutomaticPunctuation: true,
            // Use enhanced model for better accuracy
            model: 'default',
            // Alternative language codes for better detection
            alternativeLanguageCodes: [],
        }

        const request = {
            audio,
            config,
        }

        // Perform synchronous speech recognition
        const [response] = await client.recognize(request)

        if (!response.results || response.results.length === 0) {
            console.warn('[STT] No transcription results')
            return {
                transcript: '',
                confidence: 0,
                language: languageCode,
            }
        }

        // Get the first alternative (highest confidence)
        const result = response.results[0]
        const alternative = result.alternatives?.[0]

        if (!alternative) {
            console.warn('[STT] No alternatives in result')
            return {
                transcript: '',
                confidence: 0,
                language: languageCode,
            }
        }

        const transcript = alternative.transcript || ''
        const confidence = alternative.confidence || 0

        console.debug('[STT] Transcription successful:', {
            transcript: transcript.substring(0, 50),
            confidence,
            language: languageCode
        })

        return {
            transcript,
            confidence,
            language: languageCode,
        }
    } catch (error) {
        console.error('[STT] Transcription error:', error)
        throw error
    }
}

/**
 * Check if STT is available (API key is configured)
 * 
 * @returns true if STT can be used, false otherwise
 */
export function isSTTAvailable(): boolean {
    return !!process.env.GOOGLE_CLOUD_SPEECH_API_KEY
}
