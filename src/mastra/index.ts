import { Mastra } from '@mastra/core';
import { technicianAgent } from './agents/technician-assistant-agent';
import { voiceFormatterAgent } from './agents/voice-formatter-agent';
import { assistantWorkflow } from './workflows/assistant-workflow';
import { postgres } from './storage';

export const mastra = new Mastra({
  agents: {
    technicianAgent,
    voiceFormatterAgent,
  },
  workflows: {
    assistantWorkflow,
  },
  // AI Tracing - disabled due to "unsupported Unicode escape sequence" errors
  // when storing spans containing special characters in PostgreSQL JSONB fields.
  // The issue occurs when tool outputs (RAG search, photo analysis) contain
  // text with Unicode escape sequences that PostgreSQL doesn't handle well.
  // Re-enable once Mastra fixes this or we implement text sanitization.
  // observability: process.env.NODE_ENV === 'development' ? {
  //   default: { enabled: true }, // View traces in Mastra Studio locally
  // } : undefined,
  storage: postgres // Use shared storage instance
});
