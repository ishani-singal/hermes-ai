import { Mastra } from '@mastra/core';
import { technicianAgent } from './agents/technician-assistant-agent';
import { voiceFormatterAgent } from './agents/voice-formatter-agent';
import { assistantWorkflow } from './workflows/assistant-workflow';
import { getStorage } from './storage';

const storageInstance = getStorage();

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
  // Use shared storage instance if available (during build, may not have DB connection)
  ...(storageInstance ? { storage: storageInstance } : {}),
});
