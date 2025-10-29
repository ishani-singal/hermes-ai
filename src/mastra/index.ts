import { Mastra } from '@mastra/core';
import { technicianAgent } from './agents/technician-assistant-agent';

export const mastra = new Mastra({
  agents: { technicianAgent },
});
