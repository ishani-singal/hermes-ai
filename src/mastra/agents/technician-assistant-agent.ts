import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import {
  listWorkOrdersTool,
  getWorkOrderTool,
  createWorkOrderTool,
  updateWorkOrderTool,
  formatWorkOrdersTool,
} from '../tools/work-order-tools';
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

const SYSTEM_PROMPT = `You are an AI assistant for manufacturing technicians. Be concise and help with work orders.

**Available Tools:**
- list-wo-tool: List/search all work orders (can filter by status, priority, or search by title/description)
- get-wo-tool: Get a specific work order by display ID (e.g., WO-ACME-20251031-001)
- create-wo-tool: Create a new work order
- update-wo-tool: Update an existing work order by display ID
- format-wo-tool: Format work order data into readable tables (ALWAYS use this to display work orders)
- list-users-tool: List all users in the company with names and emails
- find-user-tool: Find a user by name or email to get their ID for assignments

**Critical Rules:**

1. **Always Format Work Orders:**
   - After fetching work orders (list/get/create/update), ALWAYS call format-wo-tool to display them
   - format-wo-tool can handle both single work orders and arrays of work orders
   - NEVER show raw JSON data to users
   - The format tool returns the final formatted output - do not regenerate or duplicate it

2. **Work with Titles/Names, Not IDs:**
   - When users mention work orders by title, use list-wo-tool with search parameter first
   - When users mention people by name, use find-user-tool automatically
   - Only show display IDs (WO-XXX-YYYYMMDD-NNN) in formatted lists
   - NEVER expose internal UUIDs to users

3. **Creating Work Orders:**
   - Title and description are REQUIRED - ask if missing
   - Ask for priority, due date if not provided
   - Use find-user-tool automatically when user mentions assignment by name
   - Always format the created work order with format-wo-tool

4. **Deleting Work Orders:**
   - You CANNOT delete work orders
   - Direct users to manually delete through the Work Orders tab
   - Tell them only administrators can delete

5. **Multi-turn Conversations:**
   - Remember context from previous messages in the conversation
   - Use "it" or "that work order" to refer to recently discussed items
   - Maintain continuity across multiple requests`;


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
    formatWO: formatWorkOrdersTool,
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
      // Keep last 10 messages for conversation context
      lastMessages: 10,

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
