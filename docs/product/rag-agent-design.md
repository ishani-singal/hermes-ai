# RAG Agent Design - Equipment-Aware AI Assistant

## Overview

This document outlines the implementation plan for building a **Retrieval-Augmented Generation (RAG)** agent that enables the AI technician assistant to intelligently process equipment and work order information. The agent will ask smart contextual follow-up questions based on equipment type, maintenance history, and past patterns.

**Goal:** Enable the agent to process information about equipment and work orders intelligently. When a user says "get the latest work order for this equipment" or "create a work order for a certain equipment," the agent should ask intelligent follow-up questions about that equipment.

**Timeline:** 3-4 days for full feature implementation

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│      Technician Agent                   │
├─────────────────────────────────────────┤
│ Core Tools (Fast, Synchronous)         │
├─────────────────────────────────────────┤
│ • Work Order Tools (existing)           │
│ • Equipment Tools (NEW - Phase 1)      │
│ • User/Find Tools (existing)            │
│ • Format Tools (enhanced)               │
└─────────────────────────────────────────┘
         ↓
    Agent Memory (10 last msgs + working memory)
         ↓
┌─────────────────────────────────────────┐
│   Async Context Builder (Phase 3)       │
├─────────────────────────────────────────┤
│ • Equipment context indexer             │
│ • Query pattern tracker                 │
│ • Vector DB writer (non-blocking)       │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│   Vector Database (Phase 5)             │
├─────────────────────────────────────────┤
│ • Document chunks                       │
│ • Equipment metadata                    │
│ • Conversation patterns                 │
│ • Work order templates                  │
└─────────────────────────────────────────┘
```

---

## Phase 1: Core Equipment Tools & Smart Work Order Creation (Day 1 - Today)

### Objective
Create essential equipment retrieval tools, integrate them into the technician agent, and implement equipment-aware work order creation with intelligent follow-up questions.

### Deliverables

#### 1. Create `src/mastra/tools/equipment-tools.ts`

**Tools to implement:**

1. **`get-equipment-tool`** - Fetch detailed equipment by display ID or name
   - Input: equipment display_id or name
   - Output: Full equipment details (id, name, type, manufacturer, model, serial_number, location, metadata)
   - Performance: Optimized field return (essential fields only)

2. **`list-equipment-tool`** - Search/filter equipment
   - Input: search term, type, manufacturer filters
   - Output: Paginated list of equipment (condensed format)
   - Pattern: Mirror existing `listWorkOrdersTool` approach
   - Returns: display_id, name, type, manufacturer, model

3. **`format-equipment-tool`** - Display equipment as readable tables
   - Input: Single equipment object or array of equipment
   - Output: Formatted markdown table
   - Pattern: Like `formatWorkOrdersTool`, ensures consistent formatting

#### 2. Update `src/mastra/agents/technician-assistant-agent.ts`

**Changes:**
- Register all three equipment tools
- Enhance SYSTEM_PROMPT with equipment instructions:
  - Automatically use `list-equipment-tool` with search when users mention equipment by name
  - Auto-fetch equipment details before creating work orders
  - Add intelligent question triggers based on equipment context

**New System Prompt Sections:**
```
**Equipment Tools:**
- list-eq-tool: List/search equipment by name, type, manufacturer
- get-eq-tool: Get specific equipment by display ID (e.g., EQ-ACME-PUMP-001)
- format-eq-tool: Format equipment data into readable tables

**Equipment Context Rules:**
1. When user mentions equipment by name, use list-eq-tool first
2. Always fetch full equipment details before creating work orders
3. Use equipment metadata to inform follow-up questions
4. Format all equipment output with format-eq-tool

**Creating Work Orders with Equipment:**
1. If equipment is mentioned:
   - Use list-eq-tool to find equipment by name
   - Use get-eq-tool to fetch full details
   - Display equipment details to confirm correct item

2. Ask Equipment-Specific Follow-up Questions:
   - For pumps: Flow rate? Pressure readings? Leakage? Noise?
   - For motors: Runtime hours? Temperature? Vibration? Load?
   - For compressors: Pressure? Temperature? Oil level? Duty cycle?
   - For other equipment: Use metadata fields to ask context

3. Always link equipment_id when provided

4. After creation, display work order with equipment context
```

### Contextual Question Templates

Create internal reference (comments in agent file):

```typescript
// Equipment-specific follow-up questions
const equipmentContextQuestions = {
  pump: ['Flow rate normal?', 'Pressure readings?', 'Leakage observed?', 'Unusual noise?'],
  motor: ['Runtime hours?', 'Temperature high?', 'Vibration issues?', 'Load percentage?'],
  compressor: ['Pressure normal?', 'Temperature high?', 'Oil level?', 'Duty cycle?'],
  cnc: ['Accuracy issues?', 'Tool wear?', 'Coolant level?', 'Spindle noise?'],
  generic: ['When did this start?', 'Has it gotten worse?', 'Any recent changes?', 'Safety concerns?'],
};

// Work-order creation flow questions
const workOrderFlowQuestions = {
  identify_issue: 'What is the main issue or concern with this equipment?',
  confirm_type: 'Is this preventive maintenance or a reactive repair?',
  urgency: 'How urgent is this? (Low/Medium/High/Critical)',
  assign: 'Should this be assigned to anyone specific?',
  deadline: 'Any deadline for completion?',
};
```

### Success Criteria
- Agent correctly identifies equipment when mentioned by name
- Agent asks at least 1-2 contextual follow-up questions based on equipment type
- Work order created with correct equipment_id linked
- Interaction feels natural and contextual (not robotic)

### Performance Targets
- Equipment list/get: ~100ms (synchronous)
- Agent response time: <2s (equipment tools included)
- Work order creation with context: <3s

---

## Phase 2: Vector Database & Document Chunking (Day 2 - Tomorrow)

### Objective
Build background process to index equipment context into vector database without slowing down user interactions.

### Architecture Pattern

```
User Query
    ↓
Agent generates response (primary path - FAST, no vector DB)
    ↓
Response returned to user (< 2s)
    ↓
[Parallel, async process - BACKGROUND, doesn't block]
    ├→ Extract equipment context from conversation
    ├→ Index to vector database
    ├→ Store query patterns
    └→ Build context cache
```

### Deliverables

#### 1. Create `src/mastra/services/equipment-context-service.ts`

**Responsibilities:**
- Extract equipment mentions from agent conversations
- Create context summaries (not full transcripts)
- Asynchronously write to vector database
- Handle errors gracefully (logging only, no user impact)

**Functions:**
```typescript
interface EquipmentContextEntry {
  equipment_id: string;
  company_id: string;
  query_type: 'list' | 'get' | 'create_wo' | 'update_wo' | 'other';
  context_summary: string; // Brief summary of what happened
  equipment_type?: string;
  user_query?: string; // Anonymized/sanitized
  timestamp: string;
}

async function indexEquipmentContext(
  equipment_id: string,
  queryType: string,
  contextSummary: string,
  runtimeContext: RuntimeContext
): Promise<void>

async function saveEquipmentContextToVectorDB(
  entry: EquipmentContextEntry
): Promise<boolean>
```

#### 2. Update `src/mastra/tools/equipment-tools.ts`

**Add async indexing calls** (fire-and-forget):
- After `get-equipment-tool` executes → trigger indexing
- After work order creation with equipment → trigger indexing
- Don't await these calls; let them run in background

**Pattern:**
```typescript
// In equipment tool execute functions
const tool = createTool({
  execute: async ({ context, runtimeContext }) => {
    // ... normal tool logic
    const result = await someApiCall();
    
    // Async indexing - fire and forget
    indexEquipmentContext(
      equipment.id,
      'get',
      `User queried equipment: ${equipment.name}`,
      runtimeContext
    ).catch(err => {
      console.error('Failed to index equipment context (non-blocking):', err);
      // Silently fail - don't impact user
    });
    
    return result;
  }
});
```

#### 3. Vector Database Storage

**Data to store initially:**
- Equipment metadata summaries (equipment_id, type, manufacturer, model, key specs)
- Query patterns (what equipment is frequently asked about)
- Work order contexts (which equipment has maintenance issues)
- User query patterns (anonymized: "searched for pump", "created WO for motor")

**NOT stored yet:**
- Full work order descriptions
- Full document contents (Phase 5)
- Full conversation transcripts

### Performance Requirements
- Async indexing: 0ms perceived latency
- Background process: <500ms (doesn't matter if longer)
- Error handling: Graceful degradation (indexing failure ≠ agent failure)

### Success Criteria
- Equipment contexts are stored in vector DB
- Agent response time unaffected by indexing operations
- Vector DB has baseline data by end of day

---

## Phase 2: Vector Database & Document Chunking (Day 2 - Tomorrow)

### Objective
Set up vector database infrastructure and implement document chunking for equipment manuals and troubleshooting guides.

### Architecture Pattern

```
Vector DB Infrastructure
    ↓
Document Upload → Chunking Service → Embedding Generation → Vector Storage
    ↓
Equipment Metadata Indexing
    ↓
Query by equipment_id for fast retrieval
```

### Deliverables

#### 1. Vector Database Setup

**Technology choices (to be decided):**
- Vector store: Supabase pgvector, Pinecone, or Weaviate
- Embedding model: OpenAI embeddings, Nomic Embed, or similar
- Infrastructure: Database migrations, index creation

**Vector database schema:**
```sql
-- Equipment metadata vectors
equipment_vectors:
  - id (primary key)
  - equipment_id (FK to equipment)
  - embedding (vector)
  - metadata_text (equipment specs)
  - created_at

-- Document chunk vectors
document_chunks:
  - id (primary key)
  - document_id (FK to documents table)
  - equipment_id (FK to equipment) -- optional, for equipment-specific docs
  - chunk_index
  - content_text
  - embedding (vector)
  - chunk_type ('manual' | 'troubleshooting' | 'spec' | 'maintenance')
  - created_at

-- Query pattern vectors (from Phase 3)
query_patterns:
  - id (primary key)
  - equipment_id (FK to equipment)
  - company_id
  - query_summary
  - embedding
  - frequency_count
  - last_queried
```

#### 2. Document Chunking Strategy

**Chunking approach:**
- Documents: Equipment manuals, maintenance guides, troubleshooting documents
- Chunk size: 500-1000 characters with 100 character overlap
- Metadata: Preserve equipment_id, section titles, document type

**Chunking algorithm (pseudocode):**
```
1. Load document file
2. Split by sections (if available)
3. For each section:
   - Split into chunks of 500-1000 chars
   - Add 100 char overlap from previous chunk
   - Create metadata: {document_id, equipment_id, section, chunk_index}
   - Generate embedding
   - Store in vector DB
4. Create index on equipment_id for fast filtering
```

#### 3. Implementation Tasks

**Create `src/mastra/services/document-chunking-service.ts`:**
```typescript
interface DocumentChunk {
  document_id: string;
  equipment_id?: string;
  chunk_index: number;
  content: string;
  section?: string;
  chunk_type: 'manual' | 'troubleshooting' | 'spec' | 'maintenance';
  metadata: Record<string, unknown>;
}

async function chunkDocument(
  documentPath: string,
  documentId: string,
  equipmentId?: string
): Promise<DocumentChunk[]>

async function storeChunksInVectorDB(
  chunks: DocumentChunk[]
): Promise<boolean>
```

**Create migration:** `supabase/migrations/20251113_vector_db_setup.sql`
- Create pgvector extension (if using Supabase)
- Create tables for equipment vectors, document chunks, query patterns
- Create indexes for fast retrieval

#### 4. Document Storage Integration

**Update `src/lib/api/documents/` endpoints** (if needed):
- Add document_id to documents
- Add equipment_id foreign key (optional - allows equipment-specific docs)
- Add chunk_type field

**Create document upload processor:**
- When document uploaded → trigger chunking service
- Store chunks in vector DB asynchronously
- Update document status → "indexed"

### Success Criteria
- Vector DB infrastructure operational
- Equipment metadata indexed with embeddings
- Document chunking pipeline working
- At least 1 sample equipment manual chunked and stored
- Retrieval latency <1s for single queries

---

## Phase 4: Question Contexts & Agent Enhancement (Day 4)

### Objective
Implement smart follow-up questions based on equipment type and build semantic retrieval into agent workflow.

### Deliverables

#### 1. Create `src/mastra/services/question-generator-service.ts`

**Equipment-specific question banks:**
```typescript
const equipmentContextQuestions: Record<string, string[]> = {
  pump: [
    'What is the current flow rate or pressure reading?',
    'Have you noticed any unusual noise or vibration?',
    'Is there any leakage from seals or connections?',
    'Has the pump efficiency changed recently?',
  ],
  motor: [
    'What are the current temperature readings?',
    'Have you noticed any unusual vibration or noise?',
    'How many hours has this motor been running?',
    'What is the current load percentage?',
  ],
  compressor: [
    'What is the current discharge pressure?',
    'Is the temperature within normal range?',
    'What is the oil level and condition?',
    'What is the current duty cycle?',
  ],
  cnc: [
    'Are there any accuracy or tolerance issues?',
    'When was the last tool change or maintenance?',
    'Is the coolant level and concentration adequate?',
    'Are you hearing any unusual spindle noise?',
  ],
  conveyor: [
    'Is the belt properly aligned?',
    'Are bearings running at normal temperature?',
    'Have you noticed any slippage or unusual noise?',
    'What is the load being transported?',
  ],
  generic: [
    'When did you first notice this issue?',
    'Has the problem gotten worse over time?',
    'Have there been any recent changes or maintenance?',
    'Is there any safety risk or danger?',
  ],
};

const workOrderContextQuestions: Record<string, string> = {
  urgency: 'How urgent is this issue? Would you say Low, Medium, High, or Critical?',
  prevention: 'Is this preventive maintenance or a reactive repair?',
  assignment: 'Should this be assigned to a specific technician?',
  deadline: 'Is there a deadline for when this needs to be completed?',
  safety: 'Are there any safety concerns or hazards related to this?',
};

function getEquipmentQuestions(equipmentType: string): string[] // Returns 2-3 most relevant questions
function getWorkOrderQuestions(context: string): string[] // Returns relevant follow-up questions
```

#### 2. Update System Prompt in `technician-assistant-agent.ts`

**Integrate question generation into instructions:**

```
**Smart Question Generation:**
1. Always ask 1-2 equipment-specific follow-up questions when equipment is involved
2. Match questions to the equipment type from metadata
3. Ask follow-ups naturally as part of conversation (not as lists)
4. Prioritize questions that help diagnose the issue
5. For work order creation, ask about urgency and assignment

**Question Priority:**
- First: Diagnostic questions (what's wrong?)
- Second: Context questions (when did it start?)
- Third: Administrative questions (who, when, priority)

**Don't ask if:**
- Information already provided by user
- Information available in equipment metadata
- Would require interrupting natural conversation flow
```

#### 3. Update Agent Memory Configuration

**Enhance memory to track equipment context:**
```typescript
memory: new Memory({
  storage,
  options: {
    lastMessages: 10,
    workingMemory: {
      enabled: true,
      scope: 'thread',
      // NEW: Track equipment mentions in working memory
      trackEntities: ['equipment', 'work_order'], // Will help recall context
    },
    threads: {
      generateTitle: true,
    },
    // Phase 5+: Semantic recall for equipment queries
    semanticRecall: false, // Enable in Phase 5
  },
});
```

#### 4. Add Semantic Retrieval to Agent (Phase 5 Integration)

**When to use vector DB for retrieval:**
```typescript
// Trigger semantic search in these scenarios:
1. User asks: "similar issues with this equipment?" → Query vector DB for pattern matches
2. User asks: "maintenance guide for X equipment?" → Query document chunks
3. User asks: "how to troubleshoot Y problem?" → Query troubleshooting chunk vectors
4. Auto-enhance: User creates WO, auto-fetch related docs from vector DB
```

**NOT in every query** (performance optimization):
- Only use vector DB when explicitly needed
- Rely on equipment tools for fast lookups
- Use memory for conversation context
- Vector DB is enhancement, not requirement

### Success Criteria
- Agent asks smart follow-up questions naturally
- Questions are contextual to equipment type
- Conversation feels guided but natural
- Working memory tracks equipment context
- No perceptible slowdown in agent response

---

## Implementation Timeline

### Day 1 (Today) - Phase 1
- **Phase 1:** Create equipment tools, integrate into agent, enhance work order creation (6-8 hours)
- **Testing:** Manual testing with equipment scenarios
- **Deliverable:** Agent can list/get equipment and create smart work orders with contextual follow-ups

### Day 2 (Tomorrow) - Phase 2
- **DB Setup:** Vector database infrastructure (2 hours)
- **Chunking:** Document chunking service (2 hours)
- **Migration:** Database schema and indexes (1 hour)
- **Integration:** Equipment upload processor (1 hour)
- **Deliverable:** Vector DB operational with indexed documents and equipment metadata

### Day 3 - Phase 3
- **Indexing Service:** Equipment context indexer (2 hours)
- **Integration:** Async indexing in equipment tools (1 hour)
- **Testing:** Background process reliability (1 hour)
- **Deliverable:** Equipment contexts indexed, agent response time unaffected

### Day 4 - Phase 4
- **Questions:** Question generator service (1.5 hours)
- **System Prompt:** Enhanced agent instructions (1 hour)
- **Memory:** Track equipment context in working memory (1 hour)
- **Semantic Retrieval:** Vector DB query integration (2 hours)
- **Testing & Polish:** E2E testing, edge cases (1.5 hours)
- **Deliverable:** Full RAG agent with smart questions and semantic search

---

## Performance Targets

| Operation | Target Latency | Phase |
|-----------|---|---|
| List equipment (10 items) | <100ms | 1 |
| Get equipment details | <100ms | 1 |
| Create WO with equipment context | <2s | 2 |
| Async equipment indexing | 0ms perceived | 3 |
| Document chunk retrieval | <500ms | 5 |
| Semantic search (5 results) | <1s | 5 |
| Full agent response | <3s | 4 |

---

## Success Metrics

### Phase 1-2 (Days 1-2)
- ✅ Agent correctly identifies and retrieves equipment
- ✅ Work orders created with equipment_id linked
- ✅ Agent asks 1-2 contextual follow-up questions

### Phase 3 (Day 3)
- ✅ Equipment contexts indexed in vector DB
- ✅ Agent response time unaffected (<3s)
- ✅ Vector DB contains baseline equipment data

### Phase 5 (Day 2)
- ✅ Vector DB operational with embeddings
- ✅ Documents chunked and indexed
- ✅ Retrieval latency <1s

### Phase 4 (Day 4)
- ✅ Smart follow-up questions generated naturally
- ✅ Conversation context maintained across messages
- ✅ Semantic retrieval working for document lookups
- ✅ No noticeable latency degradation

---

## Key Design Decisions

### 1. Synchronous vs Asynchronous
- **Synchronous (Fast Path):** Equipment tools, work order tools, agent response
- **Asynchronous (Background):** Indexing, vector DB storage, semantic analysis
- **Rationale:** Keep user-facing interactions fast, offload heavy processing

### 2. What to Store in Vector DB
- **Early (Phase 5):** Equipment metadata, document chunks, query patterns
- **Later:** Full conversation transcripts, work order templates
- **Never:** Sensitive data, full PII, proprietary information

### 3. When to Use Vector DB
- **Always:** Document lookups, pattern matching, semantic search
- **Sometimes:** Enhanced follow-up questions, context augmentation
- **Never:** As primary source for critical operations (fallback only)

### 4. Question Generation
- **Template-based:** Equipment-specific question banks (fast, reliable)
- **LLM-generated:** Optional enhancement (slower, more creative)
- **User-context:** Remember what's been asked to avoid repetition

---

## Future Enhancements

### Phase 6: Conversational Memory
- Store conversation summaries in vector DB
- Retrieve past interactions for similar issues
- Build equipment issue patterns over time

### Phase 7: Predictive Maintenance
- Analyze work order patterns and equipment data
- Predict equipment failures before they occur
- Suggest preventive maintenance

### Phase 8: Multi-turn Reasoning
- Complex troubleshooting workflows
- Equipment interaction modeling
- Supply chain and part recommendation

---

## Technical Debt & Risks

### Risk 1: Vector DB Latency
**Mitigation:** Keep vector searches optional (enhancement, not requirement)

### Risk 2: Hallucination in Follow-ups
**Mitigation:** Use template-based questions, not LLM-generated

### Risk 3: Equipment Data Quality
**Mitigation:** Validate equipment metadata before indexing

### Risk 4: Background Process Failures
**Mitigation:** Graceful error handling, logging only (no user impact)

---

## References

- Equipment Types: `src/types/equipment.ts`
- Work Order Types: `src/types/work-order.ts`
- Agent: `src/mastra/agents/technician-assistant-agent.ts`
- Tools: `src/mastra/tools/`
- API: `src/app/api/equipment/`
