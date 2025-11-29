import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'

/**
 * Technician assistant workflow step
 * Processes user queries using the technician agent with medmory/context
 */
export const technicianStep = createStep({
    id: 'technician-step',
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
    }),
    execute: async ({ inputData, mastra, runtimeContext }) => {
        const { message, language, mode, threadId, resourceId } = inputData

        console.log('[Workflow] Technician agent: Starting')
        const technicianAgent = mastra.getAgent('technicianAgent')
        const response = await technicianAgent.generate(message, {
            runtimeContext,
            memory: threadId ? {
                resource: resourceId || '',
                thread: threadId,
            } : undefined,
        })

        console.log('[Workflow] Technician agent: Done, response length:', response.text?.length)
        return {
            text: response.text,
            language,
            mode,
        }
    },
})
