import { Mastra } from '@mastra/core';
import { technicianAgent } from './agents/technician-assistant-agent';
import { voiceFormatterAgent } from './agents/voice-formatter-agent';
import { assistantWorkflow } from './workflows/assistant-workflow';

export const mastra = new Mastra({
  agents: { 
    technicianAgent,
    voiceFormatterAgent,
  },
  workflows: {
    assistantWorkflow,
  },
});
