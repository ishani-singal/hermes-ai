import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { translateText } from '@/mastra/services/translation-service'

/**
 * Translation workflow steps using the translation service (not LLM-based)
 * These are deterministic operations that don't require agentic behavior
 */

export const translateToEnglishStep = createStep({
    id: 'translate-to-english',
    inputSchema: z.object({
        message: z.string(),
        language: z.string().optional(),
        mode: z.enum(['TEXT', 'VOICE']),
        threadId: z.string().optional(),
        resourceId: z.string().optional(),
    }),
    outputSchema: z.object({
        text: z.string(),
        language: z.string().optional(),
        mode: z.enum(['TEXT', 'VOICE']),
        threadId: z.string().optional(),
        resourceId: z.string().optional(),
    }),
    execute: async ({ inputData }) => {
        const { message, language, mode, threadId, resourceId } = inputData

        // Skip if already English or no language specified
        if (!language || language.startsWith('en')) {
            console.log('[Workflow] Translate to English: Skipping (already English)')
            return { text: message, language, mode, threadId, resourceId }
        }

        console.log(`[Workflow] Translate to English: Translating from ${language}`)

        const translatedText = await translateText(message, language, 'en')

        console.log('[Workflow] Translate to English: Done')
        return { text: translatedText, language, mode, threadId, resourceId }
    },
})

export const translateBackStep = createStep({
    id: 'translate-back',
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
    execute: async ({ inputData }) => {
        const { text, language, mode } = inputData

        // Skip if English or no language specified
        if (!language || language.startsWith('en')) {
            console.log('[Workflow] Translate back: Skipping (target is English)')
            return { text, language, mode }
        }

        console.log(`[Workflow] Translate back: Translating to ${language}`)

        const translatedText = await translateText(text, 'en', language)

        console.log('[Workflow] Translate back: Done')
        return { text: translatedText, language, mode }
    },
})
