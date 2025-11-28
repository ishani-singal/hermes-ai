import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'

/**
 * Voice formatter workflow step
 * Optimizes text for TTS by converting markdown, breaking long sentences, etc.
 */
export const voiceFormatterStep = createStep({
    id: 'voice-formatter-step',
    inputSchema: z.object({
        text: z.string(),
        language: z.string().optional(),
        mode: z.enum(['TEXT', 'VOICE']),
    }),
    outputSchema: z.object({
        text: z.string(),
        language: z.string().optional(),
        mode: z.enum(['TEXT', 'VOICE']),
    }),
    execute: async ({ inputData, mastra, runtimeContext }) => {
        const { text, language, mode } = inputData

        console.log('[Workflow] Voice formatter: mode:', mode)
        // If we are in text mode, skip voice formatting
        if (mode === 'TEXT') {
            return { text, language, mode }
        }

        const voiceFormatter = mastra.getAgent('voiceFormatterAgent')
        const response = await voiceFormatter.generate(text, { runtimeContext })

        console.log('[Workflow] Voice formatter: Done')
        return {
            text: response.text,
            language,
            mode,
        }
    },
})
