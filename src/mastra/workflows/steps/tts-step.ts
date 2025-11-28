import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { generateTTS } from '@/mastra/services/tts-service'
import { SUPPORTED_LANGUAGES } from '@/lib/voice/constants'

/**
 * TTS generation workflow step
 * Generates speech audio from text in the target language
 */
export const ttsStep = createStep({
    id: 'tts-generation-step',
    inputSchema: z.object({
        text: z.string(),
        language: z.string().optional(),
        mode: z.enum(['TEXT', 'VOICE']),
    }),
    outputSchema: z.object({
        text: z.string(),
        audioBase64: z.string().optional(),
    }),
    execute: async ({ inputData }) => {
        const { text, language, mode } = inputData

        console.log('[Workflow] TTS generation: mode:', mode, 'language:', language)
        // If we are in text mode, skip TTS generation
        if (mode === 'TEXT') {
            console.log('[Workflow] TTS generation: Skipping for TEXT mode')
            return { text }
        }

        // Get voice for language
        const languageConfig = SUPPORTED_LANGUAGES.find(l => l.code === language)
        const voice = languageConfig?.ttsVoice || 'en-US-Casual-K'

        console.log('[Workflow] TTS generation: Using voice:', voice)

        // Generate TTS audio using the service
        const result = await generateTTS(text, {
            languageCode: language || 'en-US',
            speaker: voice,
            audioEncoding: 'MP3'
        })

        console.log('[Workflow] TTS generation: Done, audioBase64 present:', !!result.audioBase64)
        return result
    },
})
