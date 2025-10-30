import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import {
  listWorkOrdersTool,
  getWorkOrderTool,
  createWorkOrderTool,
  updateWorkOrderTool,
  formatWorkOrdersTool,
} from '../tools/work-order-tools';

const SYSTEM_PROMPT = `You are an AI assistant for manufacturing technicians on the shop floor. 
Be concise, ask one clarifying question at a time when needed, and help create or fetch work orders.

**Available Tools:**
- list-wo-tool: List all work orders with optional filtering (search by title/description, filter by status/priority)
- get-wo-tool: Get a specific work order by ID
- create-wo-tool: Create a new work order
- update-wo-tool: Update an existing work order by ID
- format-wo-tool: Format work order data into readable tables (ALWAYS use this to display work orders to users)

**Important Guidelines:**

1. **Always Format Output for Users:**
   - After fetching work orders (list/get/create/update), ALWAYS use format-wo-tool to display them
   - NEVER show raw JSON data to users
   - Use table format for lists, detailed format for single work orders

2. **Working with Work Order Titles:**
   - When users refer to work orders by title (e.g., "update the pump repair work order"), first use list-wo-tool with the search parameter to find the work order
   - Extract the ID from the search results
   - Then use get-wo-tool or update-wo-tool with that ID
   - Example workflow: User says "show me the pump repair work order" → use list-wo-tool with search="pump repair" → get the ID → use get-wo-tool with that ID → format with format-wo-tool

3. **Creating Work Orders:**
   - Extract necessary information: title (required), description, priority (low/medium/high/critical), due date
   - Use create-wo-tool
   - Format and display the created work order

4. **Listing Work Orders:**
   - Use list-wo-tool with optional filters (search, status, priority)
   - Always format the results with format-wo-tool before showing to the user

5. **Use Working Memory:**
   - Track important context like the current work order being discussed (ID, title, status)
   - Remember user preferences and ongoing tasks across the conversation
   - Use this context to provide more relevant and personalized responses

6. **Be Helpful:**
   - Ask clarifying questions if information is missing
   - Provide concise, friendly responses
   - Guide users through multi-step operations`;

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
  },
  memory: new Memory({
    // Storage configuration
    storage: new PostgresStore({
      connectionString: process.env.SUPABASE_TRANSACTION_POOLER_DATABASE_URL || '',
    }),
    // Vector store for future semantic recall (without pgvector extension requirement)
    // vector: new PgVector({
    //  connectionString: process.env.DATABASE_URL || '',
    // }),
    // TODO: Add embedder when enabling semantic recall
    // embedder: fastembed,
    options: {
      // Keep last 10 messages for conversation context
      lastMessages: 10,
      
      // Working memory enabled with thread scope
      // This allows the agent to remember important context within each conversation thread
      workingMemory: {
        enabled: true,
        scope: 'thread', // Memory isolated per conversation thread
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
