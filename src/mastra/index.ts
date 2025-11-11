import { Mastra } from '@mastra/core';
import { technicianAgent } from './agents/technician-assistant-agent';
import { voiceFormatterAgent } from './agents/voice-formatter-agent';
import { assistantWorkflow } from './workflows/assistant-workflow';
import { storage } from './storage';

export const mastra = new Mastra({
  agents: { 
    technicianAgent,
    voiceFormatterAgent,
  },
  workflows: {
    assistantWorkflow,
  },
  // AI Tracing - only enabled in development
  observability: process.env.NODE_ENV === 'development' ? {
    default: { enabled: true }, // View traces in Mastra Studio locally
  } : undefined,
  storage, // Use shared storage instance
});
