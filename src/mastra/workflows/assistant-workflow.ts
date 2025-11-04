import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { generateTTS } from '../services/tts-service';

/* This is a simple implementation of Mastra's workflow to chain the technician assistant agent
with the voice formatter agent for voice-optimized responses, and optionally generate TTS audio.
Step 1: Use the technician assistant agent to process user input and generate a response. This is also formatted for text mode.
Step 2: Use the voice formatter agent to convert the text response into a voice-optimized format.
Step 3: Generate TTS audio in VOICE mode (returns audio buffer encoded as base64)
Both steps are always executed, but the second step effectively becomes a no-op in TEXT mode.
As we grow more complex needs, we can more agents like an orchestrator at the top level, and add branching, looping, or human-in-the-loop.
For example, we could have "conversation agent" -> "data agent" -> "response formatter agent" 
where conversation agent loops until it has enough to pass on to next step. */

const step1 = createStep({
  id: 'technician-step',
  inputSchema: z.object({
    message: z.string(),
    mode: z.enum(['TEXT', 'VOICE']),
    threadId: z.string().optional(),
    resourceId: z.string().optional(),
  }),
  outputSchema: z.object({
    text: z.string(),
    mode: z.enum(['TEXT', 'VOICE']),
  }),
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const { message, mode, threadId, resourceId } = inputData;
    
    const technicianAgent = mastra.getAgent('technicianAgent');
    const response = await technicianAgent.generate(message, {
      runtimeContext,
      memory: threadId ? {
        resource: resourceId || '',
        thread: threadId,
      } : undefined,
    });

    return {
      text: response.text,
      mode,
    };
  },
});

const step2 = createStep({
  id: 'voice-conversion-step',
  inputSchema: z.object({
    text: z.string(),
    mode: z.enum(['TEXT', 'VOICE']),
  }),
  outputSchema: z.object({
    text: z.string(),
    mode: z.enum(['TEXT', 'VOICE']),
  }),
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const { text, mode } = inputData;
    
    // If we are in text mode, skip voice formatting
    if (mode === 'TEXT') {
      return { text, mode };
    }
    
    const voiceFormatter = mastra.getAgent('voiceFormatterAgent');
    const response = await voiceFormatter.generate(text, { runtimeContext });

    return {
      text: response.text,
      mode,
    };
  },
});

const step3 = createStep({
  id: 'tts-generation-step',
  inputSchema: z.object({
    text: z.string(),
    mode: z.enum(['TEXT', 'VOICE']),
  }),
  outputSchema: z.object({
    text: z.string(),
    audioBase64: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { text, mode } = inputData;
    
    // If we are in text mode, skip TTS generation
    if (mode === 'TEXT') {
      return { text };
    }

    // Generate TTS audio using the service
    return await generateTTS(text);
  },
});

export const assistantWorkflow = createWorkflow({
  id: 'assistant-workflow',
  inputSchema: z.object({
    message: z.string(),
    mode: z.enum(['TEXT', 'VOICE']),
    threadId: z.string().optional(),
    resourceId: z.string().optional(),
  }),
  outputSchema: z.object({
    text: z.string(),
    audioBase64: z.string().optional(),
  }),
})
  .then(step1)
  .then(step2)
  .then(step3)
  .commit();
