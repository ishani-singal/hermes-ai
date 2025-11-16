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
import { searchDocumentsTool } from '../tools/document-tools';
import { storage } from '../storage';

/* This is the system prompt for the technician assistant agent.
Right now we are prompting the agent to ask for confirmation when creating a work order.
This is a loose human-in-the-loop approach to reduce mistakes during creation.
To always enforce it we can add a new tool which requests to confirm or cancel when creating a work order
We can use the suspend/resume feature from Mastra to implement this. */

const SYSTEM_PROMPT = `You are a helpful AI assistant for manufacturing technicians. Be concise and accurate.

**Your Role:**
Help technicians manage work orders and equipment, maintain assets, resolve issues, and log maintenance tasks.
You have access to specialized tools and working memory to maintain context across the conversation.

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

Documentation (RAG):
- search-docs-tool: Search for relevant manuals, procedures, troubleshooting guides
  Use when users ask: "how to", "troubleshoot", "error", "guide", "procedure", "specifications" etc.
  Do NOT use for simple greetings or confirmations.

**Responsibilities:**
- Title and description are required when creating work orders - ask if not provided. If you have enough context, suggest a title/description.
- When discussing a specific work order, retrieve related equipment details if available.
- When discussing a specific piece of equipment, retrieve related work orders and relevant documentation if available.

**IMPORTANT - Working Memory Usage:**
  * When you search documents using search-docs-tool, save the key findings in working memory under "Documents & Manuals Referenced"
  * When discussing specific equipment, save the equipment name/ID and discussion context in working memory
  * When work orders are mentioned or retrieved, note their display ID and key details in working memory
  * When you detect a maintenance task, issue, or repair need during conversation, add it to "Pending Tasks & Recommendations"
  * Keep a brief conversation summary to maintain context across the session
  * Update working memory proactively when you receive information that may be useful later in the conversation
  * Do NOT save lists of work orders and equipments in working memory - only save specific work orders or equipment that user discusses

**Guidelines:**
- When listing or filtering data, use tool parameters first (status, priority, search, equipment_id)
- For complex filtering not supported by parameters, analyze the raw data returned by tools
- When users mention people, equipment, or workorder by name, use tools to get their ID if needed. Don't ask users for internal IDs directly. 
- Once you have the ID, use it directly. Don't ask the user to confirm it.
- ALWAYS Use display IDs (WO-XXX, EQ-XXX) when showing information to users, never internal UUIDs
- You cannot delete work orders - direct users to the Work Orders tab for deletion
- For any non-trivial equipment troubleshooting or procedure questions, call search-docs-tool first to gather context before describing procedures or safe operating limits.
- Include citations from documentation when providing answers (e.g., "According to [Manual X, Page Y]...") and follow documentation instructions precisely in your responses.
- **Work Order Suggestions:** If during conversation you detect a maintenance task, equipment issue, or repair need (e.g., "the pump is making noise", "need to replace the filter"), proactively ask: "Would you like me to create a work order for this?" Use the conversation summary from working memory to pre-fill the work order description with relevant context.`;


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
    searchDocs: searchDocumentsTool,
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
        template: `# Conversation Context

## Equipment Discussed
- Equipment Name (Display ID): Brief context about what was discussed

## Work Orders Mentioned
- Work Order Title (Display ID): Status and key details

## Documents & Manuals Summary
- Document/Manual: Key information retrieved from documents

## Pending Tasks & Recommendations
- Task: Description and reason (potential work order candidate)

## Conversation Summary
- Brief summary of main topics and user intent
`,
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
