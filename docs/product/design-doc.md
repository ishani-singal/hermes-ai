# Manufacturing Technician Copilot - Technical Design Document

**Version:** 1.0  
**Date:** October 2024  
**Document Type:** Technical Design  
**Audience:** Engineering Team

---

## Table of Contents

1. System Architecture Overview
2. Feature Technical Specifications
3. Tech Stack Details
4. Deployment Architecture
5. Data Architecture
6. API Design
7. AI/ML Implementation
8. Security & Authentication
9. Performance & Scalability
10. Post-MVP Scaling Strategy

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

**Architecture Pattern:** Monolithic Full-Stack Application (Next.js)

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS APPLICATION                      │
│                                                             │
│  Frontend Layer (React)                                     │
│  ├── Chat interface                                         │
│  ├── Work order management                                  │
│  ├── Equipment management                                   │
│  ├── Document library                                       │
│  └── User settings                                          │
│                                                             │
│  API Layer (Next.js API Routes)                             │
│  ├── /api/chat                                              │
│  ├── /api/work-orders                                       │
│  ├── /api/equipment                                         │
│  ├── /api/documents                                         │
│  └── /api/conversations                                     │
│                                                             │
│  WebSocket Server (Custom Server)                           │
│  └── /ws/voice (real-time audio streaming)                 │
│                                                             │
│  Services Layer                                             │
│  ├── AI Orchestration                                       │
│  ├── RAG Service                                            │
│  ├── Document Processing                                    │
│  └── Session Memory                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────────────┐
    │            External Services                       │
    ├── Supabase (DB, Auth, Storage)                    │
    ├── Pinecone (Vector Search)                        │
    ├── Google Cloud (Gemini, STT, TTS, Embeddings)    │
    └── Monitoring (Sentry, future)                     │
    └───────────────────────────────────────────────────┘
```

### 1.2 Request Flow Patterns

**Voice Conversation Flow:**
```
1. User opens chat → WebSocket connection established
2. User taps mic → Browser captures audio stream
3. Audio chunks (100ms intervals) → WebSocket → Backend
4. Backend → Google Speech-to-Text API
5. Real-time transcription → WebSocket → Browser
6. User stops → Full transcript processed
7. Backend: RAG search (if needed) → Context assembly
8. Backend → Google Gemini API
9. AI response generated
10. (Optional) Text-to-Speech generation
11. Response → WebSocket → Browser
12. Display text + play audio
13. Save to database
```

**Work Order Creation (AI-Assisted):**
```
1. User describes issue in chat
2. AI identifies intent (function calling)
3. AI extracts parameters (equipment, priority, description)
4. Multi-turn dialogue for missing info
5. AI presents summary → User confirms
6. Validate data → Insert into Supabase
7. Return work order ID → Display in UI
8. Link conversation to work order
```

**Document Search (RAG):**
```
1. User asks question
2. Generate query embedding (Google Vertex AI)
3. Similarity search in Pinecone (top 5 chunks)
4. Fetch metadata from Supabase
5. Construct prompt: context + RAG results + query
6. Send to Gemini → Generate response with citations
7. Display response with source references
```

---

## 2. Feature Technical Specifications

### 2.1 Conversational AI Agent

**Input Methods:**

**Text Input:**
- Standard textarea with auto-expand
- Character limit: 5000
- Markdown rendering in responses
- Message persistence to `conversation_messages` table

**Voice Input (Real-time Streaming):**
- Browser MediaRecorder API
- Audio encoding: WebM Opus (48kHz)
- Chunk interval: 100ms
- WebSocket protocol (bidirectional)
- Google Cloud Speech-to-Text Streaming API
- Interim results displayed (real-time feedback)
- Final transcription on silence detection or manual stop

**Image Input:**
- File picker + drag-drop support
- Camera API integration (mobile)
- Upload to Supabase Storage
- Max size: 10MB per image
- Formats: JPEG, PNG
- GPT-4 Vision API for analysis (via prompt injection)

**Voice Output (TTS):**
- Google Cloud Text-to-Speech (WaveNet voices)
- Generated on-demand (per response)
- Cached in Supabase Storage (7-day TTL)
- Audio format: MP3, 24kbps
- Playback via HTML5 Audio API
- Toggle on/off per user preference

**AI Capabilities:**
- Context window: Last 10 messages + system prompt
- Function calling for tool execution
- Citation extraction from RAG results
- Multi-turn dialogue management
- Company-scoped knowledge (equipment, docs, work orders)

**Technical Components:**
```
AIService
├── chat(message, context) → AIResponse
├── searchDocuments(query, companyId) → Document[]
├── executeFunction(functionName, params) → Result
└── buildContext(userId, companyId) → Context

Context = {
  equipment: Equipment[],
  activeWorkOrders: WorkOrder[],
  conversationHistory: Message[],
  retrievedDocs: DocumentChunk[]
}
```

---

### 2.2 Work Order Management

**Data Model (Conceptual):**
```
WorkOrder {
  id: UUID
  companyId: UUID
  equipmentId: UUID
  title: string (max 255)
  description: string (max 5000)
  status: enum (open, in_progress, completed, cancelled)
  priority: enum (low, medium, high, critical)
  createdBy: UUID
  assignedTo: UUID (nullable)
  dueDate: timestamp (nullable)
  completedAt: timestamp (nullable)
  metadata: JSONB (attachments, notes, history)
  timestamps: created_at, updated_at
}
```

**API Endpoints:**
```
POST   /api/work-orders          Create work order
GET    /api/work-orders          List with filters (status, priority, equipment)
GET    /api/work-orders/:id      Get single work order
PATCH  /api/work-orders/:id      Update work order
DELETE /api/work-orders/:id      Delete work order
POST   /api/work-orders/:id/attachments  Upload files
```

**Views Implementation:**

**List View:**
- Server-side pagination (25 items/page)
- Query parameters: `?page=1&status=open&priority=high&sort=due_date`
- React Table or similar component
- Filter UI: Multi-select dropdowns

**Kanban Board:**
- Three columns: Open, In Progress, Completed
- React DnD library for drag-and-drop
- Optimistic UI updates
- WebSocket updates for real-time sync (future)

**Business Logic:**
```
WorkOrderService
├── create(data) → WorkOrder
├── list(filters, pagination) → WorkOrder[]
├── update(id, changes) → WorkOrder
├── delete(id) → boolean
├── changeStatus(id, newStatus) → WorkOrder
└── addAttachment(id, file) → Attachment
```

---

### 2.3 Data Integration

**Equipment Upload:**

**CSV Processing:**
```
1. User uploads CSV file
2. Parse with Papaparse library
3. Validate headers and data types
4. Check for duplicates (by serial_number)
5. Bulk insert to Supabase (batch of 100)
6. Return summary: success count, errors[]
```

**CSV Template:**
```csv
name,type,manufacturer,model,serial_number,location,notes
CNC Machine A,CNC,Haas,VF-2,SN12345,Building 2 - Bay 5,""
Conveyor Belt B,Conveyor,ACME,CB-100,SN67890,Building 1 - Line 3,""
```

**API Endpoints:**
```
POST   /api/equipment/import     Bulk CSV upload
POST   /api/equipment            Create single equipment
GET    /api/equipment            List equipment (with search)
GET    /api/equipment/:id        Get single equipment
PUT    /api/equipment/:id        Update equipment
DELETE /api/equipment/:id        Delete equipment
```

**Document Processing Pipeline:**

```
Upload → Extract → Chunk → Embed → Store

1. Upload Phase:
   - POST /api/documents/upload
   - Validate file type (PDF, DOCX)
   - Upload to Supabase Storage: {companyId}/{docId}/{filename}
   - Create document record in DB
   
2. Extract Phase:
   - PDF: pdf-parse library (Node.js)
   - DOCX: mammoth library
   - Extract plain text + page numbers
   
3. Chunk Phase:
   - Split into 500-token chunks
   - 50-token overlap between chunks
   - Preserve page number metadata
   - Algorithm: Sliding window with sentence boundaries
   
4. Embed Phase:
   - Batch chunks (max 100 per API call)
   - Google Vertex AI Text Embeddings
   - 1536-dimensional vectors
   
5. Store Phase:
   - Upsert vectors to Pinecone (with metadata)
   - Store chunks in Supabase (for text retrieval)
   - Link chunks to parent document
```

**Document Processing Service:**
```
DocumentProcessor
├── processDocument(fileUrl, documentId, companyId)
│   ├── downloadFile()
│   ├── extractText() → string
│   ├── chunkText(text) → Chunk[]
│   ├── generateEmbeddings(chunks) → Embedding[]
│   ├── storeInPinecone(embeddings, metadata)
│   └── storeInSupabase(chunks)
└── handleErrors(error) → ErrorReport
```

**Processing Time Estimates:**
- 10-page PDF: ~30 seconds
- 50-page PDF: ~2 minutes
- 100-page PDF: ~5 minutes

---

### 2.4 Intelligence Layer (RAG)

**RAG Architecture:**

```
Query → Embed → Search → Retrieve → Construct Prompt → Generate

Components:
1. Query Embedding: Google Vertex AI
2. Vector Search: Pinecone similarity search
3. Text Retrieval: Supabase (get chunk text by ID)
4. Prompt Construction: System prompt + RAG context + query
5. Generation: Google Gemini 1.5 Flash
```

**RAG Service Implementation:**
```typescript
class RAGService {
  async search(query: string, companyId: string, k: number = 5) {
    // 1. Generate query embedding
    const embedding = await this.embedQuery(query);
    
    // 2. Search Pinecone
    const results = await pinecone.query({
      vector: embedding,
      topK: k,
      filter: { company_id: companyId },
      includeMetadata: true
    });
    
    // 3. Fetch full text from Supabase
    const chunkIds = results.matches.map(m => m.id);
    const chunks = await supabase
      .from('document_chunks')
      .select('*, documents(*)')
      .in('id', chunkIds);
    
    // 4. Return with relevance scores
    return chunks.map((chunk, i) => ({
      text: chunk.chunk_text,
      document: chunk.documents.title,
      page: chunk.page_number,
      relevance: results.matches[i].score
    }));
  }
  
  buildPrompt(query: string, context: RAGContext, ragResults: RAGResult[]) {
    return `You are a manufacturing assistant.

Company Equipment:
${context.equipment.map(e => `- ${e.name}: ${e.type} (${e.model})`).join('\n')}

Active Work Orders:
${context.workOrders.map(wo => `- WO-${wo.id}: ${wo.title} (${wo.status})`).join('\n')}

Relevant Documentation:
${ragResults.map(r => `[${r.document}, p${r.page}]: ${r.text}`).join('\n\n')}

User Question: ${query}

Instructions:
- Use the documentation above to answer
- Cite sources in your response
- If unsure, say so clearly`;
  }
}
```

**Citation Format:**
```
AI Response: "Based on your CNC Model X manual (page 87), error 404 
indicates spindle overheat. To reset: ..."

Citation Display:
[1] Haas VF-2 Troubleshooting Guide, Section 4.3, Page 87
```

---

### 2.5 Session Management

**Memory Architecture:**

**In-Memory (Runtime):**
```typescript
// Active sessions while WebSocket connected
class SessionManager {
  private sessions: Map<string, ActiveSession> = new Map();
  
  createSession(userId: string, companyId: string): string {
    const sessionId = uuid();
    this.sessions.set(sessionId, {
      sessionId,
      userId,
      companyId,
      messages: [],
      contextWindow: [], // Last 10 messages
      startTime: new Date(),
      lastActivity: new Date()
    });
    return sessionId;
  }
  
  addMessage(sessionId: string, message: Message) {
    const session = this.sessions.get(sessionId);
    session.messages.push(message);
    session.contextWindow = session.messages.slice(-10);
    session.lastActivity = new Date();
  }
  
  // Cleanup idle sessions (>30 min)
  cleanupIdleSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > 30 * 60 * 1000) {
        this.persistSession(id); // Save to DB
        this.sessions.delete(id);
      }
    }
  }
}
```

**Persistent (Database):**
```
conversation_sessions table:
- Records all conversations (even after session ends)
- Linked to user, company
- Status: active, completed, abandoned

conversation_messages table:
- All messages with role (user, assistant, system)
- Metadata: citations, function calls, timestamps
- Linked to session
```

**Cross-Session Context (RAG):**
```
After session ends or periodically:
1. Generate summary of important conversations
2. Chunk conversation (treat like a document)
3. Generate embeddings
4. Store in Pinecone with type="conversation"
5. Now searchable: "What did we discuss about conveyor belt?"
```

---

## 3. Tech Stack Details

### 3.1 Frontend Stack

```yaml
Framework: Next.js 14 (App Router)
Language: TypeScript 5.x
Styling: Tailwind CSS 3.x
Components: shadcn/ui (Radix UI primitives)
State: React Context + useReducer (no external state lib)
Forms: React Hook Form
Validation: Zod
HTTP: Native Fetch API
WebSocket: Native WebSocket API
```

**Key Libraries:**
```json
{
  "next": "^14.0.0",
  "react": "^18.2.0",
  "typescript": "^5.2.0",
  "tailwindcss": "^3.3.0",
  "@radix-ui/react-*": "various",
  "react-hook-form": "^7.47.0",
  "zod": "^3.22.0",
  "lucide-react": "^0.263.0"
}
```

### 3.2 Backend Stack

```yaml
Runtime: Node.js 20.x LTS
Framework: Next.js API Routes + Custom Server
Language: TypeScript 5.x
WebSocket: ws library 8.x
HTTP Server: Node.js native http module
```

**Custom Server (for WebSocket):**
```typescript
// server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ 
    server, 
    path: '/ws/voice' 
  });

  wss.on('connection', handleVoiceConnection);

  server.listen(3000);
});
```

### 3.3 AI/ML Stack

```yaml
LLM: Google Gemini 1.5 Flash
STT: Google Cloud Speech-to-Text v2
TTS: Google Cloud Text-to-Speech v1
Embeddings: Google Vertex AI Text Embeddings
Vector DB: Pinecone (managed)
```

**SDK Versions:**
```json
{
  "@google/generative-ai": "^0.1.3",
  "@google-cloud/speech": "^6.0.0",
  "@google-cloud/text-to-speech": "^5.0.0",
  "@pinecone-database/pinecone": "^2.0.0"
}
```

**API Configuration:**
```typescript
// Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1000,
    topP: 0.95
  }
});

// Speech-to-Text
const speechClient = new SpeechClient();
const streamingConfig = {
  config: {
    encoding: 'WEBM_OPUS',
    sampleRateHertz: 48000,
    languageCode: 'en-US',
    model: 'latest_long',
    useEnhanced: true
  },
  interimResults: true
};

// Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});
const index = pinecone.index('manufacturing-copilot');
```

### 3.4 Database & Storage

```yaml
Primary DB: PostgreSQL 15 (via Supabase)
Vector Extension: pgvector 0.5.x (fallback)
Auth: Supabase Auth (JWT-based)
File Storage: Supabase Storage
DB Client: @supabase/supabase-js 2.x
```

**Supabase Client Setup:**
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side (with service role for admin operations)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### 3.5 Development Tools

```yaml
Package Manager: pnpm (or npm)
Version Control: Git + GitHub
Code Formatting: Prettier
Linting: ESLint
Type Checking: TypeScript strict mode
Testing: Jest + React Testing Library (future)
```

---

## 4. Deployment Architecture

### 4.1 Deployment Options Comparison

| Platform | Type | Cost | WebSocket | Docker | Recommendation |
|----------|------|------|-----------|--------|----------------|
| **Render** | PaaS | $0 (free), $7 (paid) | ✅ Yes | Optional | MVP testing → production |
| **Fly.io** | PaaS | $0 (free, no sleep) | ✅ Yes | Required | Best free tier |
| **Railway** | PaaS | $5+ (usage-based) | ✅ Yes | Optional | Simple alternative |
| **Vercel** | Serverless | $0 (free) | ❌ No* | N/A | Frontend only option |

*Vercel Edge Functions support WebSocket-like connections but not suitable for long-lived audio streaming

### 4.2 Recommended Deployment Strategy

**Option A: Single Deployment (Render/Fly.io)**
```
All-in-One Next.js Application
├── Hosted on: Render ($7/mo) or Fly.io (free)
├── Frontend + API + WebSocket in one process
├── Custom server.js for WebSocket support
└── Environment variables for all services
```

**Deployment Configuration (Render):**
```yaml
# render.yaml
services:
  - type: web
    name: manufacturing-copilot
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start:server
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXT_PUBLIC_SUPABASE_URL
        sync: false
      - key: GOOGLE_API_KEY
        sync: false
      # ... other env vars
```

**Dockerfile (for Fly.io):**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:server"]
```

### 4.3 External Services Configuration

**Environment Variables:**
```bash
# Application
NODE_ENV=production
PORT=3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google Cloud
GOOGLE_API_KEY=AIza...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Pinecone
PINECONE_API_KEY=xxx
PINECONE_ENVIRONMENT=us-west1-gcp
PINECONE_INDEX_NAME=manufacturing-copilot

# Optional
SENTRY_DSN=https://...
```

### 4.4 CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npm run type-check
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Render
        uses: johnbeynon/render-deploy-action@v0.0.8
        with:
          service-id: ${{ secrets.RENDER_SERVICE_ID }}
          api-key: ${{ secrets.RENDER_API_KEY }}
```

---

## 5. Data Architecture

### 5.1 Database Schema (High-Level)

**Core Tables:**

```
users (public.users - managed by application)
├── id (UUID, PK, FK → auth.users)
│   └── References Supabase auth.users(id) for authentication
│       auth.users handles passwords, sessions, email verification
│       public.users stores business/profile data
├── email (VARCHAR, UNIQUE)
├── full_name (VARCHAR)
├── default_company_id (UUID, FK → companies, NULLABLE)
└── timestamps
└── Note: Trigger auto-creates public.users when auth.users record created

user_companies (junction table for multi-company access)
├── id (UUID, PK)
├── user_id (UUID, FK → users)
├── company_id (UUID, FK → companies)
├── role (ENUM: admin, editor, viewer)
├── is_active (BOOLEAN, DEFAULT true)
├── created_at, updated_at
└── UNIQUE(user_id, company_id)

companies
├── id (UUID, PK)
├── name (VARCHAR, NOT NULL)
├── primary_contact_email (VARCHAR, NOT NULL)
│   └── Fallback contact for support, recovery, critical notifications
│       Can differ from admin user emails
│       Used for billing/support if all admins deleted
├── settings (JSONB, DEFAULT '{}')
│   └── General company settings (user policies, AI config, feature flags, etc.)
│       Schema validated in application layer via Zod
└── timestamps

schemas (custom field definitions per entity type)
├── id (UUID, PK)
├── company_id (UUID, FK → companies)
├── entity_type (ENUM: 'work_orders', 'equipment', 'documents', etc.)
├── schema_definition (JSONB)
│   └── Field definitions (name, type, required, validation, etc.)
│       If no schema exists for entity_type, use default/core fields only
├── created_at, updated_at
└── UNIQUE(company_id, entity_type)

equipment
├── id (UUID, PK)
├── company_id (UUID, FK)
├── name (VARCHAR, required)
├── type, manufacturer, model, serial_number
├── location (VARCHAR)
├── metadata (JSONB) - custom fields
└── timestamps

work_orders
├── id (UUID, PK)
├── company_id (UUID, FK → companies)
├── equipment_id (UUID, FK → equipment, NULLABLE)
├── title, description
├── status (ENUM), priority (ENUM)
├── created_by, assigned_to (FK → users)
├── due_date, completed_at (nullable)
├── custom_fields (JSONB, DEFAULT '{}')
│   └── Company-specific fields (cost, vendor, parts, etc.)
│       Schema defined in companies.settings.work_orders.custom_fields_schema
│       Validated in application layer via Zod
└── timestamps

documents
├── id (UUID, PK)
├── company_id, equipment_id (FK, nullable)
├── title, type (ENUM: manual, sop, tsg, other)
├── file_url, file_size, page_count
└── timestamps

document_chunks
├── id (UUID, PK)
├── document_id (FK)
├── chunk_text, chunk_index, page_number
├── embedding (VECTOR(1536)) - pgvector fallback
├── metadata (JSONB)
└── timestamp

conversation_sessions
├── id (UUID, PK)
├── user_id, company_id (FK)
├── started_at, ended_at, status
├── summary (TEXT, AI-generated)
└── timestamps

conversation_messages
├── id (UUID, PK)
├── session_id (FK)
├── role (ENUM: user, assistant, system)
├── content (TEXT)
├── metadata (JSONB) - citations, function calls
└── timestamp

invites (optional, for admin invite flow)
├── id (UUID, PK)
├── company_id (UUID, FK → companies)
├── email (VARCHAR)
├── role (ENUM: admin, editor, viewer)
├── token (VARCHAR, UNIQUE)
├── expires_at (TIMESTAMP)
├── used_at (TIMESTAMP, NULLABLE)
├── created_by (UUID, FK → users)
└── created_at
```

**Indexes (Performance):**
```sql
-- Frequently queried fields
CREATE INDEX idx_work_orders_company ON work_orders(company_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_equipment_company ON equipment(company_id);
CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_messages_session ON conversation_messages(session_id);
CREATE INDEX idx_user_companies_user ON user_companies(user_id);
CREATE INDEX idx_user_companies_company ON user_companies(company_id);
CREATE INDEX idx_schemas_company ON schemas(company_id);
CREATE UNIQUE INDEX idx_schemas_company_entity ON schemas(company_id, entity_type);

-- Vector search (pgvector fallback)
CREATE INDEX idx_chunks_embedding ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops);

-- JSONB indexes for custom fields (optional, add as needed)
CREATE INDEX idx_companies_settings ON companies USING GIN (settings);
CREATE INDEX idx_work_orders_custom_fields ON work_orders USING GIN (custom_fields);
CREATE INDEX idx_schemas_definition ON schemas USING GIN (schema_definition);
```

**Company Settings & Custom Schemas:**

**Company Settings (`companies.settings`):**
- Stores general company configurations (user policies, AI settings, feature flags, notifications, etc.)
- Flexible JSONB structure allows adding new settings without schema migrations
- Schema validation performed in application layer using Zod
- Examples: max_ai_messages_per_day, mfa_required, allow_contractors, email_notifications_enabled

**Custom Schemas (`schemas` table):**
- Defines custom field schemas for any entity type (work_orders, equipment, documents, etc.)
- One row per company per entity_type (enforced by UNIQUE constraint)
- If no schema exists for an entity_type, use default/core fields only
- Stores field definitions (name, type, required, validation rules, options, etc.)
- Supports various field types: text, number, date, select, multiselect, checkbox, etc.
- Schema validation performed in application layer using Zod
- Avoids cluttering companies table with multiple schema columns
- Easy to extend to new entity types without database migrations

**Entity Custom Fields (e.g., `work_orders.custom_fields`):**
- Stores actual custom field data for each entity instance
- Structure must match company's schema for that entity_type
- Enables CSV import from existing CMMS systems
- Dynamic UI form generation based on company schema
- AI can extract custom fields during work order creation
- Examples: cost_estimate, vendor, parts_needed, safety_level

**Schema Mapping & Field Aliasing:**

Companies often use different terminology for the same concepts (e.g., "work order" vs "maintenance task" vs "service request"). Additionally, companies may want to rename standard fields to match their internal vocabulary (e.g., "priority" → "urgency level"). To support this, the `schema_definition` JSONB in the `schemas` table includes both field definitions AND field mappings.

**Schema Definition Structure:**

```typescript
// Example schema_definition for work_orders entity_type
{
  // Entity-level alias (what the company calls this entity)
  entity_alias: "maintenance_task",  // or "work_order", "service_request", etc.
  
  // Field mappings (core + custom fields)
  fields: [
    {
      internal_name: "title",           // Internal DB column name
      display_name: "Task Summary",     // Customer's preferred label
      type: "text",
      required: true,
      core_field: true                  // Maps to actual DB column
    },
    {
      internal_name: "priority",
      display_name: "Urgency Level",
      type: "select",
      options: ["low", "medium", "high", "critical"],
      required: true,
      core_field: true
    },
    {
      internal_name: "cost_estimate",
      display_name: "Estimated Cost",
      type: "number",
      required: false,
      core_field: false                 // Stored in custom_fields JSONB
    },
    {
      internal_name: "parts_needed",
      display_name: "Required Parts",
      type: "multiselect",
      required: false,
      core_field: false
    }
  ]
}
```

**Implementation Pattern:**

```typescript
interface WorkOrderSchema {
  entity_alias: string;
  fields: FieldDefinition[];
}

interface FieldDefinition {
  internal_name: string;    // Never changes (DB column or custom_fields key)
  display_name: string;     // Customer-facing label (customizable)
  type: string;             // text, number, date, select, multiselect, checkbox, etc.
  required: boolean;
  core_field: boolean;      // true = DB column, false = custom_fields JSONB
  options?: string[];       // For select/multiselect types
  validation?: any;         // Additional validation rules
}

class SchemaMapper {
  private schema: WorkOrderSchema;
  
  constructor(companyId: string) {
    // Load from schemas table
    this.schema = await this.loadSchema(companyId, 'work_orders');
  }
  
  // Convert DB row → Flattened customer view (for API responses, UI display)
  toCustomerView(dbRow: WorkOrder): FlattenedWorkOrder {
    const flattened: Record<string, any> = {};
    
    for (const field of this.schema.fields) {
      const value = field.core_field 
        ? dbRow[field.internal_name]              // From core column
        : dbRow.custom_fields?.[field.internal_name];  // From JSONB
      
      flattened[field.display_name] = value;
    }
    
    return flattened;
  }
  
  // Convert customer input → DB structure (for API requests, form submissions)
  toDbStructure(customerData: Record<string, any>): Partial<WorkOrder> {
    const dbData: any = { custom_fields: {} };
    
    for (const field of this.schema.fields) {
      const value = customerData[field.display_name];
      
      if (field.core_field) {
        dbData[field.internal_name] = value;
      } else {
        dbData.custom_fields[field.internal_name] = value;
      }
    }
    
    return dbData;
  }
  
  // Get entity alias for UI (e.g., page titles, buttons)
  getEntityAlias(): string {
    return this.schema.entity_alias;
  }
  
  // Generate UI form schema (for dynamic form generation)
  getFormSchema(): FormField[] {
    return this.schema.fields.map(field => ({
      name: field.display_name,
      type: field.type,
      required: field.required,
      options: field.options
    }));
  }
  
  // Map CSV column names to internal structure (for bulk import)
  mapCsvRow(csvRow: Record<string, any>): Partial<WorkOrder> {
    const mapped: any = { custom_fields: {} };
    
    for (const field of this.schema.fields) {
      // Try to match CSV column to display_name (case-insensitive)
      const csvValue = Object.entries(csvRow).find(
        ([key]) => key.toLowerCase() === field.display_name.toLowerCase()
      )?.[1];
      
      if (csvValue !== undefined) {
        if (field.core_field) {
          mapped[field.internal_name] = csvValue;
        } else {
          mapped.custom_fields[field.internal_name] = csvValue;
        }
      }
    }
    
    return mapped;
  }
}
```

**Usage Examples:**

```typescript
// API Endpoint: GET /api/work-orders
const mapper = new SchemaMapper(companyId);
const dbRows = await supabase.from('work_orders').select('*');
const response = dbRows.map(row => mapper.toCustomerView(row));

// Result:
[
  {
    "Task Summary": "Replace conveyor belt",
    "Urgency Level": "high",
    "Estimated Cost": 5000,
    "Required Parts": ["Belt Assembly", "Mounting Bolts"]
  }
]

// API Endpoint: POST /api/work-orders
const customerInput = {
  "Task Summary": "Repair hydraulic pump",
  "Urgency Level": "critical",
  "Estimated Cost": 12000
};
const dbStructure = mapper.toDbStructure(customerInput);
await supabase.from('work_orders').insert(dbStructure);

// Stored as:
{
  title: "Repair hydraulic pump",
  priority: "critical",
  custom_fields: {
    cost_estimate: 12000
  }
}

// UI: Dynamic form generation
const formFields = mapper.getFormSchema();
// Renders form with "Task Summary", "Urgency Level", etc. as labels

// UI: Page titles
const entityName = mapper.getEntityAlias(); // "maintenance_task"
return <h1>Create New {entityName}</h1>;  // "Create New maintenance_task"

// CSV Import
const csvData = [
  { "Task Summary": "...", "Urgency Level": "high", "Estimated Cost": 5000 },
  // ... more rows
];
const importData = csvData.map(row => mapper.mapCsvRow(row));
await supabase.from('work_orders').insert(importData);
```

**Benefits:**

1. **Unified Interface**: Frontend always works with customer-facing `display_name`, backend handles all mapping
2. **Flexible Terminology**: Each company can use their own vocabulary without code changes
3. **CSV Import**: Maps customer CSV columns to internal structure automatically
4. **AI Integration**: AI can use customer terminology in conversations (e.g., "Create a new maintenance task")
5. **Backward Compatible**: Existing `custom_fields` JSONB approach still works
6. **No Schema Migrations**: All configuration stored in `schemas` table
7. **Type Safety**: Validation performed in application layer via Zod based on schema definition

**Default Behavior:**

- If no schema exists for a company's entity_type, use default field mappings where `display_name = internal_name`
- Schema can be created during company onboarding or CSV import (auto-generate from CSV headers)
- Admin users can modify schema via settings UI

**Multi-Company User Access:**

Users can belong to multiple companies (common for contractors). The `user_companies` junction table manages this many-to-many relationship.

**Access Patterns:**

- **Regular Employee**: One record in `user_companies` (single company)
- **Contractor**: Multiple records in `user_companies` (multiple companies)
- **Former Employee**: `is_active = false` (revoke access without deletion)

**Example Data:**

```sql
-- Regular employee (John) - works for one company
INSERT INTO user_companies VALUES
  ('uc-1', 'john-id', 'acme-corp', 'editor', true);

-- Contractor (Jane) - works for multiple companies
INSERT INTO user_companies VALUES
  ('uc-2', 'jane-id', 'acme-corp', 'editor', true),
  ('uc-3', 'jane-id', 'beta-mfg', 'admin', true),
  ('uc-4', 'jane-id', 'gamma-ind', 'viewer', true);
```

**Session Management:**

When a user logs in:
1. Fetch all companies they have access to from `user_companies` where `is_active = true`
2. Set `activeCompanyId` in session (defaults to `default_company_id` or first company)
3. All queries filtered by `activeCompanyId` from session
4. Company switcher in header UI allows switching between companies
5. Switching company updates session and re-validates access

**UI Logic:**

```typescript
// Check if user needs company switcher
const userCompanies = await supabase
  .from('user_companies')
  .select('*, companies(*)')
  .eq('user_id', userId)
  .eq('is_active', true);

const needsSwitcher = userCompanies.length > 1;

// Render UI accordingly
{needsSwitcher ? (
  <CompanySwitcher companies={userCompanies} />
) : (
  <span>{userCompanies[0].companies.name}</span>
)}
```

### 5.2 Row-Level Security (RLS)

**Supabase RLS Policies:**

```sql
-- Users can only see data for their active company
-- Note: activeCompanyId is stored in session/context, not in users table
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY equipment_select_policy ON equipment
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY equipment_insert_policy ON equipment
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true
        AND role = 'admin'
    )
  );

-- Similar policies for work_orders, documents, etc.
-- Note: Role-based access is enforced through user_companies.role
```

### 5.3 Vector Storage (Pinecone)

**Index Configuration:**
```typescript
// Create index (one-time setup)
await pinecone.createIndex({
  name: 'manufacturing-copilot',
  dimension: 1536, // Google Vertex AI embedding size
  metric: 'cosine',
  spec: {
    serverless: {
      cloud: 'gcp',
      region: 'us-west1'
    }
  }
});
```

**Vector Metadata Structure:**
```json
{
  "id": "chunk-uuid-123",
  "values": [0.123, -0.456, ...], // 1536 dimensions
  "metadata": {
    "document_id": "doc-uuid-456",
    "company_id": "company-uuid-789",
    "chunk_index": 0,
    "document_title": "Haas VF-2 Manual",
    "document_type": "manual",
    "equipment_id": "equip-uuid-101",
    "page_number": 87,
    "chunk_text": "Error 404 indicates..." // First 500 chars for preview
  }
}
```

**Upserting Vectors:**
```typescript
await index.upsert({
  vectors: chunks.map((chunk, i) => ({
    id: `${documentId}-chunk-${i}`,
    values: embeddings[i],
    metadata: {
      document_id: documentId,
      company_id: companyId,
      chunk_index: i,
      document_title: document.title,
      chunk_text: chunk.substring(0, 500),
      page_number: chunk.pageNumber
    }
  }))
});
```

**Querying Vectors:**
```typescript
const results = await index.query({
  vector: queryEmbedding,
  topK: 5,
  filter: {
    company_id: { $eq: companyId },
    document_type: { $in: ['manual', 'tsg'] } // Optional
  },
  includeMetadata: true
});
```

### 5.4 File Storage (Supabase Storage)

**Bucket Structure:**
```
documents/
  └── {company_id}/
      └── {document_id}/
          └── {filename}.pdf

media/
  └── {company_id}/
      └── images/{file_id}.jpg
      └── videos/{file_id}.mp4
      └── audio/{file_id}.webm

tts/
  └── {timestamp}.mp3  # Temporary TTS audio files
```

**Storage Policies:**
```sql
-- Users can only upload to their company folder
CREATE POLICY documents_upload_policy ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM users WHERE id = auth.uid())
  );

-- Users can read their company's files
CREATE POLICY documents_select_policy ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM users WHERE id = auth.uid())
  );
```

## 6. API Design

### 6.1 REST API Endpoints

**Authentication:**
- All endpoints require JWT token in Authorization header
- Format: `Authorization: Bearer <jwt_token>`

**Chat API:**
```
POST /api/chat
- Purpose: Send message to AI and receive response
- Request: { message, conversationId?, voiceEnabled? }
- Response: { conversationId, message, citations[], audioUrl?, functionCalls[] }
```

**Work Orders API:**
```
GET    /api/work-orders
- Query params: status, priority, equipment, page, limit, sort
- Response: Paginated list of work orders

POST   /api/work-orders
- Purpose: Create new work order
- Request: { title, description, equipmentId, priority, dueDate? }

GET    /api/work-orders/:id
- Purpose: Get single work order details

PATCH  /api/work-orders/:id
- Purpose: Update work order (status, assignment, notes)

DELETE /api/work-orders/:id
- Purpose: Delete work order

POST   /api/work-orders/:id/attachments
- Purpose: Upload files to work order
```

**Equipment API:**
```
POST   /api/equipment/import
- Purpose: Bulk CSV upload
- Request: multipart/form-data with CSV file
- Response: { imported, errors[] }

POST   /api/equipment
- Purpose: Create single equipment

GET    /api/equipment
- Query params: search, type, limit
- Response: Equipment list

GET    /api/equipment/:id
PUT    /api/equipment/:id
DELETE /api/equipment/:id
```

**Documents API:**
```
POST   /api/documents/upload
- Purpose: Upload PDF/DOCX for processing
- Request: multipart/form-data
- Response: { id, status: "processing", estimatedTime }

GET    /api/documents/:id/status
- Purpose: Check processing status
- Response: { status, chunksProcessed, error? }

GET    /api/documents
- Query params: type, equipmentId
- Response: Document list with metadata

DELETE /api/documents/:id
```

**Conversations API:**
```
GET    /api/conversations/:sessionId
- Purpose: Get full conversation history
- Response: { messages[], startedAt, endedAt, status }

GET    /api/conversations
- Query params: userId, status, limit
- Response: List of conversation sessions
```

### 6.2 WebSocket API

**Connection:**
```
Endpoint: wss://your-app.com/ws/voice
Authentication: Token in query param or header
```

**Message Types (Client → Server):**
```
1. Binary Audio Data: Raw audio chunks (100ms intervals)

2. Control Messages (JSON):
   - { type: "start_recording", sessionId }
   - { type: "end_speech", transcript }
   - { type: "ping" }
```

**Message Types (Server → Client):**
```
1. Transcription Updates:
   - { type: "transcription", text, isFinal }

2. AI Response:
   - { type: "ai_response", message, audioUrl?, conversationId }

3. Error:
   - { type: "error", code, message }

4. Heartbeat:
   - { type: "pong" }
```

### 6.3 Error Response Format

**Standard Error Structure:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "field": "fieldName",
    "details": {}
  }
}
```

**Common Error Codes:**
```
Authentication:
- UNAUTHORIZED: No token provided
- INVALID_TOKEN: Token expired/invalid
- FORBIDDEN: Insufficient permissions

Validation:
- INVALID_INPUT: Field validation failed
- MISSING_FIELD: Required field not provided
- DUPLICATE_ENTRY: Unique constraint violation

Business Logic:
- RESOURCE_NOT_FOUND: Resource doesn't exist
- COMPANY_MISMATCH: Resource belongs to different company
- PROCESSING_FAILED: Document/AI processing failed

Rate Limiting:
- RATE_LIMIT_EXCEEDED: Too many requests

External Services:
- AI_SERVICE_ERROR: LLM/STT/TTS API failed
- STORAGE_ERROR: File operations failed
- VECTOR_DB_ERROR: Pinecone query failed
```

---

## 7. AI/ML Implementation

### 7.1 Google Gemini Integration

**Configuration:**
```
Model: gemini-1.5-flash
Temperature: 0.7
Max Output Tokens: 1000
Top P: 0.95
```

**Key Features:**
- Chat completion with conversation history
- Function calling for work order creation
- System instruction (context injection)
- Streaming responses (future enhancement)

**Function Definitions:**
```
create_work_order:
  - Parameters: title, description, equipment_name, priority
  - Returns: Work order ID
  
search_equipment:
  - Parameters: query, type?
  - Returns: Equipment list
  
update_work_order_status:
  - Parameters: workOrderId, newStatus
  - Returns: Updated work order
```

### 7.2 Speech-to-Text (Google Cloud)

**Configuration:**
```
Model: latest_long
Encoding: WEBM_OPUS
Sample Rate: 48000 Hz
Language: en-US
Enhanced Model: Yes
Features:
  - Automatic punctuation: Yes
  - Interim results: Yes
  - Single utterance: No
```

**Voice Activity Detection:**
- Detect silence after final transcription
- Timeout: 2 seconds of silence
- Trigger AI response processing

**Error Handling:**
- Connection loss: Reconnect with backoff
- Poor audio quality: Prompt user to retry
- STT API error: Fallback to text input

### 7.3 Text-to-Speech (Google Cloud)

**Configuration:**
```
Voice: en-US-Neural2-J (Male) or en-US-Neural2-F (Female)
Language: en-US
Audio Encoding: MP3
Speaking Rate: 1.0 (adjustable for noisy environments)
Pitch: 0.0
Volume: 0.0 dB
```

**Optimization:**
- Cache generated audio (7-day TTL)
- Store in Supabase Storage
- Hash text content for cache key
- Pre-generate for common responses (future)

### 7.4 Embeddings & Vector Search

**Embedding Generation:**
```
Model: Google Vertex AI text-embedding-004
Dimensions: 1536
Batch Size: Max 250 texts per API call
Use Cases:
  - Document chunks
  - User queries
  - Conversation summaries
```

**Vector Search (Pinecone):**
```
Index Configuration:
  - Metric: Cosine similarity
  - Dimension: 1536
  - Namespace: Per company or metadata filtering

Query Parameters:
  - Top K: 5 (default, configurable)
  - Filters: company_id, document_type, equipment_id
  - Include Metadata: Yes

Response:
  - Matching vectors with IDs
  - Similarity scores
  - Metadata for each match
```

**Search Strategy:**
```
1. Generate query embedding
2. Search Pinecone with filters (company_id)
3. Retrieve top 5 matches
4. Fetch full text from Supabase using chunk IDs
5. Rank by relevance score
6. Return with source attribution
```

### 7.5 Document Processing Pipeline

**Stages:**
```
1. Upload:
   - Validate file type (PDF, DOCX)
   - Upload to Supabase Storage
   - Create document record

2. Extract:
   - PDF: Use pdf-parse library
   - DOCX: Use mammoth library
   - Extract plain text + page numbers
   - Preserve document structure

3. Chunk:
   - Chunk size: 500 tokens
   - Overlap: 50 tokens
   - Strategy: Sentence-aware sliding window
   - Preserve page number metadata

4. Embed:
   - Batch chunks (250 per request)
   - Generate embeddings via Vertex AI
   - Associate with document metadata

5. Store:
   - Upsert vectors to Pinecone
   - Store chunks in Supabase
   - Link chunks to parent document
   - Update document status: "completed"
```

**Processing Time Estimates:**
- 10-page PDF: ~30 seconds
- 50-page PDF: ~2 minutes
- 100-page PDF: ~5 minutes

**Error Handling:**
- PDF parsing errors: Mark as failed, notify user
- Embedding API errors: Retry with exponential backoff
- Storage errors: Rollback and clean up partial data

### 7.6 RAG Implementation

**Context Construction:**
```
System Prompt Components:
1. Company Context:
   - Equipment inventory
   - Active work orders
   - User role and permissions

2. Retrieved Documentation:
   - Top 5 relevant chunks
   - Source document titles
   - Page numbers

3. Conversation History:
   - Last 10 messages
   - Role identification (user/assistant)

4. Instructions:
   - Citation requirements
   - Handling uncertainty
   - Function calling guidelines
```

**Prompt Template Structure:**
```
You are a manufacturing assistant for {company_name}.

Company Equipment:
- [Equipment list]

Active Work Orders:
- [Work order summaries]

Relevant Documentation:
[Retrieved chunks with sources]

Conversation History:
[Last 10 messages]

User Question: {user_query}

Instructions: [Guidelines for response format, citations, etc.]
```

**Citation Extraction:**
- Parse document references from chunks
- Format: "[Document Title, Page X]"
- Include in response metadata
- Display as footnotes in UI

---

## 8. Security & Authentication

### 8.1 Authentication

**Dual-Table User Pattern:**

The application uses a dual-table pattern for user management:
- **`auth.users`** (Supabase-managed): Handles authentication (passwords, sessions, email verification)
- **`public.users`** (Application-managed): Stores business/profile data (full_name, default_company_id, etc.)

Both tables share the same UUID for each user. A database trigger auto-creates `public.users` when `auth.users` record is created. This pattern enables:
- Migration flexibility (auth provider can be swapped without losing business data)
- Custom fields without extending Supabase's auth schema
- Standard relational foreign keys to `public.users`

**Supabase Auth:**
- Method: JWT-based authentication
- Token Storage: HTTP-only cookies (server-side) or localStorage (client-side)
- Token Expiry: 7 days (configurable)
- Refresh Token: Automatic renewal

**Sign Up/Sign In Flow:**
```
1. User provides email + password
2. Supabase creates auth.users record (handles password hashing, email verification)
3. Database trigger creates matching public.users record with same UUID
4. User assigned to company via one of two methods:
   a) Admin invite: User accepts invite → Added to user_companies with pre-set company + role
   b) Self-registration: User creates new company → Added to user_companies as admin
5. JWT token returned to client with user_id
6. Fetch user's companies from user_companies table
7. Set active company (from default_company_id or first available)
8. Token + activeCompanyId stored in session
9. All subsequent requests filtered by activeCompanyId
```

**Company Assignment Methods:**

**Option A: Admin Invite (Recommended for existing companies)**
```typescript
// Admin creates invite
POST /api/invites
{
  email: "technician@example.com",
  companyId: "acme-corp",
  role: "technician"
}
→ Sends email with invite token

// User accepts invite and signs up
POST /api/auth/accept-invite
{
  inviteToken: "xyz...",
  password: "...",
  fullName: "John Doe"
}
→ Creates auth.users + public.users + adds to user_companies
```

**Option B: Self-Registration (Create new company)**
```typescript
// User signs up and creates company
POST /api/auth/signup/create-company
{
  email: "admin@newcompany.com",
  password: "...",
  fullName: "Jane Smith",
  companyName: "ACME Manufacturing"
}
→ Creates auth.users + public.users + company + adds creator to user_companies as admin
→ User's email becomes company's primary contact email

// OR join existing company
POST /api/auth/signup/join-company
{
  email: "user@newcompany.com",
  password: "...",
  fullName: "John Doe",
  companyName: "ACME Manufacturing"  // Must match existing company
}
→ Creates auth.users + public.users + adds user to user_companies as viewer
→ Auto-approved (no admin approval needed for MVP)
```
   - If exists: Add to user_companies as admin
   - If not: Send invite → Becomes admin on acceptance
```

**WebSocket Authentication:**
- Token passed in connection query parameter or header
- Validated before establishing connection
- Connection closed on invalid/expired token

### 8.2 Authorization (RBAC)

**Roles (Per-Company):**

User roles are defined per company in the `user_companies` table. A user can have different roles at different companies.

```
Admin:
  - Full CRUD on equipment, documents, work orders
  - User management (invite/remove users)
  - Company settings

Technician:
  - Read equipment
  - Create/update work orders
  - Upload documents
  - Full chat access

Viewer:
  - Read-only access to all resources
  - No chat access (optional restriction)
```

**Example: Same User, Different Roles:**
```sql
-- Jane has different roles at different companies
user_companies:
{ user_id: "jane-id", company_id: "acme-corp", role: "technician" }
{ user_id: "jane-id", company_id: "beta-mfg", role: "admin" }
{ user_id: "jane-id", company_id: "gamma-ind", role: "viewer" }
```

**Permission Checking:**
```typescript
// Check user's role for active company
async function checkPermission(userId: string, companyId: string, requiredRole: string) {
  const userCompany = await supabase
    .from('user_companies')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .single();
  
  if (!userCompany) return false;
  
  // Check if user has required role
  const roleHierarchy = { admin: 3, technician: 2, viewer: 1 };
  return roleHierarchy[userCompany.role] >= roleHierarchy[requiredRole];
}
```

**Authorization Flow:**
- Middleware extracts userId and activeCompanyId from session
- Fetch user's role for that company from user_companies
- Validate role permits the requested action
- Row-level checks ensure resource belongs to active company

### 8.3 Data Isolation

**Multi-Tenancy Strategy:**
- Company-scoped queries (filter by activeCompanyId from session)
- Users can access multiple companies, but only one at a time
- Row-Level Security (RLS) policies in Supabase validate company access
- Vector search filtered by company metadata
- File storage organized by company folders

**Active Company Context:**
```typescript
// Session stores active company
interface UserSession {
  userId: string;
  activeCompanyId: string;  // Current company context
  role: string;             // Role at active company
}

// All queries use active company
const workOrders = await supabase
  .from('work_orders')
  .select()
  .eq('company_id', session.activeCompanyId);
```

**RLS Policies:**
```
All tables have policies that:
- Filter SELECT to allow access to any company user belongs to (via user_companies)
- Validate INSERT/UPDATE use user's activeCompanyId
- Restrict DELETE based on role at that company
- Enforce at database level (defense in depth)
```

**Company Switching:**
```typescript
// User switches to different company
async function switchCompany(userId: string, newCompanyId: string) {
  // Verify user has access to this company
  const access = await supabase
    .from('user_companies')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', newCompanyId)
    .eq('is_active', true)
    .single();
  
  if (!access) throw new Error('Access denied');
  
  // Update session
  session.activeCompanyId = newCompanyId;
  session.role = access.role;
  
  // All subsequent queries now use new company context
}
```

### 8.4 API Security

**Rate Limiting:**
- 100 requests per 15 minutes per IP
- Higher limits for authenticated users
- Separate limits for AI endpoints (costly operations)

**Input Validation:**
- Schema validation using Zod
- Sanitize all user inputs
- File type validation on upload
- Size limits enforced

**CORS Configuration:**
- Whitelist frontend domain
- Credentials allowed for authenticated requests
- Proper headers for WebSocket upgrade

**Secrets Management:**
- Environment variables for all API keys
- Never commit secrets to git
- Rotate keys periodically
- Use separate keys for dev/staging/prod

---

## 9. Performance & Scalability

### 9.1 Performance Targets

**Response Times:**
```
API Endpoints:
- GET requests: < 200ms (p95)
- POST requests: < 500ms (p95)
- Document search (RAG): < 1000ms (p95)
- AI chat response: < 3000ms (p95)

WebSocket:
- Voice transcription latency: < 300ms
- Connection establishment: < 1000ms

Page Load:
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Largest Contentful Paint: < 2.5s
```

### 9.2 Caching Strategy

**Application-Level Cache:**
```
What to Cache:
- Equipment lists (per company) - 1 hour TTL
- Document metadata - 30 minutes TTL
- User permissions - 15 minutes TTL
- Common AI responses - 1 day TTL (future)

Implementation:
- In-memory cache (NodeCache) for MVP
- Redis for distributed caching (post-MVP)

Cache Invalidation:
- On data updates (equipment, documents)
- Time-based expiry
- Manual purge endpoint for admins
```

**CDN/Edge Caching:**
- Static assets (JS, CSS, images) via Vercel CDN
- Long cache headers for immutable assets
- Short cache for API responses (future optimization)

### 9.3 Database Optimization

**Indexes:**
```
Critical Indexes:
- work_orders: (company_id, status)
- work_orders: (equipment_id)
- equipment: (company_id, type)
- documents: (company_id, type)
- document_chunks: (document_id)
- conversation_messages: (session_id)
- Vector index on document_chunks.embedding (pgvector fallback)
```

**Connection Pooling:**
- Pool size: 20 connections (adjust based on load)
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

**Query Optimization:**
- Use EXPLAIN ANALYZE for slow queries
- Pagination for large result sets (25 items default)
- Selective column fetching (avoid SELECT *)
- Batch operations where possible

### 9.4 Frontend Optimization

**Code Splitting:**
- Dynamic imports for heavy components (Kanban board, PDF viewer)
- Route-based code splitting (automatic in Next.js)
- Lazy load non-critical features

**Asset Optimization:**
- Image optimization with Next.js Image component
- WebP format with fallbacks
- Lazy loading for images below fold
- Font optimization (subset, preload)

**Bundle Size:**
- Target: < 200KB initial JS bundle
- Tree shaking for unused code
- Minimize third-party dependencies

### 9.5 Monitoring & Observability

**Metrics to Track:**
```
Application:
- Request rate and latency (per endpoint)
- Error rate and types
- WebSocket connection count
- Active users (concurrent)

AI/ML:
- AI API usage and costs
- STT/TTS request counts
- Vector search latency
- Document processing queue length

Infrastructure:
- Database connection pool utilization
- Memory usage
- CPU usage
- Storage usage (DB and file storage)
```

**Logging:**
- Structured JSON logs
- Log levels: ERROR, WARN, INFO, DEBUG
- Include: timestamp, user ID, company ID, request ID
- Avoid logging sensitive data (passwords, tokens)

**Error Tracking:**
- Sentry for error monitoring (future)
- Alert on critical errors (>5% error rate)
- Stack traces with source maps
- User context for debugging

---

## 10. Post-MVP Scaling Strategy

### 10.1 Architectural Evolution

**Phase 1: Separate Frontend from Backend (3-6 months)**
```
Current: Monolithic Next.js
Future:
  Frontend (Next.js on Vercel) - Static/SSR pages only
  Backend (Express/Fastify on containers) - API + WebSocket

Benefits:
- Independent scaling
- Better caching strategies
- Optimized infrastructure per layer

Migration Effort: 1-2 weeks
```

**Phase 2: Extract AI/ML Layer (6-12 months)**
```
Add: Python FastAPI service for AI/ML
Responsibilities:
  - Advanced RAG (reranking, hybrid search)
  - LangChain orchestration
  - Model experimentation
  - Batch processing

Benefits:
- Use Python ML ecosystem
- Isolate compute-heavy operations
- Better observability for AI

Migration Effort: 2-3 weeks
```

**Phase 3: Microservices (12+ months)**
```
Decompose into services:
  - User Service
  - Work Order Service
  - Document Service
  - AI/Chat Service
  - Notification Service

Communication:
  - REST for synchronous
  - Message queue for async

Benefits:
- Fine-grained scaling
- Team autonomy
- Technology flexibility

Challenges:
- Operational complexity
- Distributed tracing needed
- Service mesh considerations
```

### 10.2 Containerization & Kubernetes

**Dockerization (Can start during MVP):**
```
Benefits:
- Consistent environments
- Easy local development
- Portable across clouds
- Required for K8s

When: During MVP development or immediately after
```

**Kubernetes Migration (6-12 months post-MVP):**
```
When to Consider:
- Managing 10+ services
- Need auto-scaling
- Enterprise scale (100+ companies)
- Dedicated DevOps team

Managed K8s Options:
- AWS EKS
- Azure AKS
- Google GKE
- DigitalOcean Kubernetes

Migration Effort: 1-2 months
```

### 10.3 Database Scaling

**Vertical Scaling (Supabase Tiers):**
```
Free (500MB) → Pro (8GB) → Team (50GB) → Enterprise (Custom)

When to upgrade:
- Free → Pro: Database >400MB or need more connections
- Pro → Team: 40+ companies or high query volume
- Team → Enterprise: 200+ companies or compliance needs
```

**Horizontal Scaling:**
```
Phase 1: Read Replicas
- Offload read queries to replicas
- Primary for writes, replicas for reads
- When: High read volume (analytics, reporting)

Phase 2: Migrate to Self-Managed
- AWS RDS, Azure Database, or self-hosted
- When: Costs exceed $600/month or need full control
- Migration Effort: 1-2 weeks

Phase 3: Sharding (Enterprise Scale)
- Shard by company (companies 1-100, 101-200, etc.)
- When: 500+ companies, single DB can't handle load
- Complexity: High, requires app-level routing
```

### 10.4 Vector Database Scaling

**Pinecone Tier Upgrades:**
```
Free (100K vectors) → Starter (5M) → Standard (20M+)

When to upgrade:
- Free → Starter: 90K vectors (~900 documents)
- Starter → Standard: Need more performance or vectors

Cost Comparison:
- Free: $0
- Starter: $70/month
- Standard: $200+/month
```

**Alternative: Self-Hosted Vector DB:**
```
Options: Milvus, Weaviate, Qdrant

When to Consider:
- Pinecone costs exceed $500/month
- Need full control
- At enterprise scale (millions of vectors)

Trade-offs:
- Lower recurring cost
- Higher operational overhead
- Requires expertise

Migration Effort: 2-4 weeks
```

### 10.5 Caching & CDN

**Redis for Distributed Caching:**
```
When: Multiple backend instances need shared cache
Setup: Managed Redis (Upstash, Redis Labs, AWS ElastiCache)
Cost: $10-50/month for MVP scale
```

**CDN Enhancement:**
```
Current: Vercel CDN (automatic for frontend)
Future: CloudFlare in front of everything
Benefits:
  - Global edge caching
  - DDoS protection
  - Web Application Firewall
  - Better performance for global users
```

### 10.6 Monitoring at Scale

**Observability Stack:**
```
MVP: Console logs + Sentry
Growth: Add Datadog/New Relic
Enterprise: Full stack
  - Metrics: Prometheus + Grafana
  - Logs: ELK or Loki
  - Traces: Jaeger or Tempo
  - Alerts: PagerDuty/Opsgenie
```

**Key Dashboards:**
```
1. Business Metrics:
   - Active users
   - Work orders created
   - AI conversations per day
   - Feature adoption rates

2. Technical Metrics:
   - API latency (p50, p95, p99)
   - Error rates by endpoint
   - Database query performance
   - AI API costs

3. Infrastructure:
   - CPU/Memory utilization
   - Connection pool stats
   - Storage usage
   - Network throughput
```

### 10.7 Cost Optimization

**AI API Cost Reduction:**
```
Strategies:
- Response caching (30-40% savings)
- Prompt optimization (reduce tokens)
- Model selection (Flash vs Pro based on complexity)
- Batch operations where possible

Monitoring:
- Daily cost tracking
- Per-company usage attribution
- Budget alerts
```

**Database Cost Optimization:**
```
Strategies:
- Archive old data (>1-2 years)
- Optimize queries (reduce compute)
- Right-size instance
- Consider read replicas vs larger primary

Data Retention Policies:
- Work orders: Keep forever
- Conversations: Archive after 1 year
- Logs: Retain 90 days
- TTS audio: Delete after 7 days
```

**Infrastructure Rightsizing:**
```
- Start small, scale up based on metrics
- Use auto-scaling (K8s HPA)
- Scheduled scaling (scale down at night)
- Spot instances for non-critical workloads
```

### 10.8 Security Hardening

**Post-MVP Security Enhancements:**
```
Authentication:
- Multi-factor authentication (MFA)
- Single Sign-On (SSO) for enterprise
- Session management improvements

API Security:
- Advanced rate limiting
- API key management for integrations
- Request signing
- Web Application Firewall (WAF)

Compliance:
- SOC 2 Type II (for enterprise customers)
- GDPR compliance features
- HIPAA compliance (if applicable)
- Audit logging for all actions

Infrastructure:
- Network segmentation
- Secrets management (Vault)
- Regular security audits
- Penetration testing
- Container image scanning
```

### 10.9 Business Continuity

**Backup Strategy:**
```
MVP:
- Supabase automatic daily backups
- 7-day retention

Growth:
- Hourly snapshots (retain 24 hours)
- Daily backups (retain 30 days)
- Monthly archives (retain 12 months)

Testing:
- Quarterly restore tests
- Documented procedures
- RTO < 4 hours, RPO < 1 hour
```

**High Availability:**
```
When Needed: SLA requirements from enterprise customers

Setup:
- Multi-region database replication
- Load balancer with health checks
- Auto-failover
- Geographic redundancy

Cost: 2-3x infrastructure costs
```

**Incident Response:**
```
Preparation:
- On-call rotation
- Incident response playbook
- Communication templates
- Post-mortem process

Severity Levels:
- SEV1 (Critical): Service down - Page immediately
- SEV2 (Major): Degraded - Notify within 1 hour
- SEV3 (Minor): Isolated - Fix in next sprint
```

---

## Appendix: Reference Architecture Diagram

**Current State (MVP):**
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
┌──────┴────────────────────────┐
│  Next.js Application (Render) │
│  - Frontend + API + WebSocket │
└──────┬────────────────────────┘
       │
┌──────┴──────┬─────────┬──────────┐
│  Supabase   │Pinecone │ Google   │
│  (DB/Auth/  │(Vectors)│Cloud AI  │
│   Storage)  │         │          │
└─────────────┴─────────┴──────────┘
```

**Future State (Post-MVP):**
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
┌──────┴─────────────────┐
│ Next.js (Vercel)       │
│ - Frontend only        │
└──────┬─────────────────┘
       │
┌──────┴─────────────────┬──────────────────┐
│  Express Backend (K8s) │ Python AI (K8s)  │
│  - API                 │ - Advanced RAG   │
│  - WebSocket           │ - LangChain      │
└──────┬─────────────────┴──────────────────┘
       │
┌──────┴──────┬─────────┬──────────┬────────┐
│  PostgreSQL │Pinecone │ Google   │ Redis  │
│  (AWS RDS)  │or Milvus│Cloud AI  │(Cache) │
└─────────────┴─────────┴──────────┴────────┘
```


**End of Technical Design Document**

*This document should be used as a reference during implementation. Each section can be expanded into detailed implementation specs as needed.*