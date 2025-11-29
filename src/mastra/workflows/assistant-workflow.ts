import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { translateToEnglishStep, translateBackStep } from './steps/translation-steps';
import { technicianStep } from './steps/technician-step';
import { voiceFormatterStep } from './steps/voice-formatter-step';
import { ttsStep } from './steps/tts-step';

/**
 * Assistant Workflow with Multilingual Support
 * 
 * This workflow handles both text and voice interactions with automatic translation.
 * 
 * Flow:
 * 1. Translate to English (if non-English input) - uses translation service
 * 2. Technician assistant agent (processes in English)
 * 3. Voice formatter (optimizes for TTS, handles long sentences)
 * 4. Translate back (if non-English output needed) - uses translation service
 * 5. Generate TTS audio (in target language)
 * 
 * Translation steps use the deterministic translation service (not LLM-based)
 * for speed and cost-effectiveness.
 */

export const assistantWorkflow = createWorkflow({
  id: 'assistant-workflow',
  inputSchema: z.object({
    message: z.string(),
    mode: z.enum(['TEXT', 'VOICE']),
    language: z.string().optional(),
    threadId: z.string().optional(),
    resourceId: z.string().optional(),
  }),
  outputSchema: z.object({
    text: z.string(),
    audioBase64: z.string().optional(),
  }),
})
  .then(technicianStep)
  .then(voiceFormatterStep)
  .then(ttsStep)
  .commit();
