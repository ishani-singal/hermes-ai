import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import {
  listWorkOrdersTool,
  getWorkOrderTool,
  createWorkOrderTool,
  updateWorkOrderTool,
} from '../tools/work-order-tools';
import {
  listEquipmentTool,
  getEquipmentTool,
} from '../tools/equipment-tools';
import {
  listUsersTool,
  findUserTool,
} from '../tools/user-tools';
import { storage } from '../storage';

/* This is the system prompt for the technician assistant agent.
Right now we are prompting the agent to ask for confirmation when creating a work order.
This is a loose human-in-the-loop approach to reduce mistakes during creation.
To always enforce it we can add a new tool which requests to confirm or cancel when creating a work order
We can use the suspend/resume feature from Mastra to implement this. */

const SYSTEM_PROMPT = `You are a helpful AI assistant for manufacturing technicians. Be concise and accurate.

**Your Role:**
Help technicians manage work orders and equipment. Answer questions, retrieve information, create and update work orders, and provide equipment details.

**Available Tools:**
Work Orders:
- list-wo-tool: List/search by status, priority, search term, or equipment_id
- get-wo-tool: Get details by display ID (e.g., WO-ACME-20251031-001)
- create-wo-tool: Create new work order (requires title and description)
- update-wo-tool: Update by display ID

Equipment:
- list-eq-tool: List/search by name, type, or manufacturer
- get-eq-tool: Get details by display ID (e.g., EQ-ACME-PUMP-001)

Users:
- list-users-tool: List all company users
- find-user-tool: Find user by name or email for assignments

**Responsibilities:**
- Title and description are required when creating work orders - ask if not provided.
- When talking about work orders, have the equipment information ready if available.

**Guidelines:**
- When listing or filtering data, use tool parameters first (status, priority, search, equipment_id)
- For complex filtering not supported by parameters, analyze the raw data returned by tools
- When users mention people, equipment, or workorder by name, use tools to get their ID if needed. Don't ask users for internal IDs directly.
- ALWAYS Use display IDs (WO-XXX, EQ-XXX) when showing information to users, never internal UUIDs
- You cannot delete work orders - direct users to the Work Orders tab for deletion`;




// Create the technician assistant agent with Mastra Memory
export const technicianAgent = new Agent({
  name: 'technicianAgent',
  instructions: SYSTEM_PROMPT,
  model: 'google/gemini-2.0-flash',
  tools: {
    listWO: listWorkOrdersTool,
    getWO: getWorkOrderTool,
    createWO: createWorkOrderTool,
    updateWO: updateWorkOrderTool,
    listEQ: listEquipmentTool,
    getEQ: getEquipmentTool,
    listUsers: listUsersTool,
    findUser: findUserTool,
  },
  memory: new Memory({
    // Storage configuration - use shared storage instance
    storage,
    // Vector store for future semantic recall (without pgvector extension requirement)
    // vector: new PgVector({
    //  connectionString: process.env.DATABASE_URL || '',
    // }),
    // TODO: Add embedder when enabling semantic recall
    // embedder: fastembed,
    options: {
      // Keep last 20 messages for better conversation context
      // This allows follow-up questions like "which have equipment?" without re-querying DB
      lastMessages: 20,

      // Enable working memory for complex multi-turn conversations
      workingMemory: {
        enabled: true,
        scope: 'thread',
      },
      
      // Auto-generate thread titles from the first user message
      threads: {
        generateTitle: true,
      },
      
      // TODO: Semantic recall will be added in the future
      // Requires embedder configuration above
      semanticRecall: false,
    },
  }),
});
