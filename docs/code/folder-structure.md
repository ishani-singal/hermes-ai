# Next.js Folder Structure - Technical Documentation

**Version:** 1.0  
**Date:** October 2024  
**Purpose:** Document the folder organization, frontend/backend separation, and where different layers of the application live

---

## Overview

This is a **Next.js 14+ App Router** application with a monolithic full-stack architecture. The structure clearly separates frontend (React components), backend (API routes & services), and shared utilities.

---

## Root Structure

```
hai-technician-assistant/
├── src/                          # All application code
├── public/                       # Static assets
├── supabase/                     # Database migrations & config
├── docs/                         # Documentation
├── .env.local                    # Environment variables
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS config
└── package.json                  # Dependencies
```

---

## Core Principle: Route Groups with Parentheses

**Parentheses `()` create route groups** - they organize files without affecting URLs.

### Example:
```
app/
├── (auth)/
│   └── login/page.tsx       → URL: /login (NOT /auth/login)
└── (dashboard)/
    └── chat/page.tsx        → URL: /chat (NOT /dashboard/chat)
```

### Benefits:
- ✅ Shared layouts per group
- ✅ Clean URLs
- ✅ Logical organization
- ✅ Different auth requirements per group

---

## Complete Folder Structure

```
src/
├── app/                                    # ROUTES (Frontend Pages + API)
│   ├── (auth)/                            # 🎨 FRONTEND: Unauthenticated pages
│   │   ├── layout.tsx                     # Auth layout (centered card)
│   │   ├── login/
│   │   │   └── page.tsx                   # Sign in page
│   │   └── signup/
│   │       └── page.tsx                   # Sign up page
│   │
│   ├── (dashboard)/                       # 🎨 FRONTEND: Protected pages
│   │   ├── layout.tsx                     # Dashboard layout (header, nav)
│   │   ├── page.tsx                       # Dashboard home
│   │   ├── chat/
│   │   │   └── page.tsx                   # Chat interface
│   │   ├── work-orders/
│   │   │   ├── page.tsx                   # Work order list
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Work order detail
│   │   ├── equipment/
│   │   │   ├── page.tsx                   # Equipment list
│   │   │   └── import/
│   │   │       └── page.tsx               # CSV import
│   │   └── documents/
│   │       └── page.tsx                   # Document library
│   │
│   ├── api/                               # ⚙️ BACKEND: API Routes
│   │   ├── auth/
│   │   │   └── signup/
│   │   │       ├── create-company/
│   │   │       │   └── route.ts           # POST /api/auth/signup/create-company
│   │   │       └── join-company/
│   │   │           └── route.ts           # POST /api/auth/signup/join-company
│   │   ├── chat/
│   │   │   └── route.ts                   # POST /api/chat
│   │   ├── work-orders/
│   │   │   ├── route.ts                   # GET/POST /api/work-orders
│   │   │   └── [id]/
│   │   │       └── route.ts               # GET/PATCH/DELETE /api/work-orders/:id
│   │   ├── equipment/
│   │   │   ├── route.ts                   # GET/POST /api/equipment
│   │   │   └── import/
│   │   │       └── route.ts               # POST /api/equipment/import
│   │   ├── documents/
│   │   │   ├── route.ts                   # GET/POST /api/documents
│   │   │   └── upload/
│   │   │       └── route.ts               # POST /api/documents/upload
│   │   └── conversations/
│   │       └── route.ts                   # GET/POST /api/conversations
│   │
│   ├── layout.tsx                         # Root layout
│   ├── page.tsx                           # Landing page (/)
│   └── globals.css                        # Global styles
│
├── services/                               # ⚙️ BACKEND: Business Logic
│   ├── ai/
│   │   ├── gemini-client.ts               # Gemini API wrapper
│   │   ├── context-builder.ts             # Assemble context for AI
│   │   ├── function-registry.ts           # Register AI callable functions
│   │   ├── function-executor.ts           # Execute AI function calls
│   │   └── prompt-templates.ts            # System prompts
│   │
│   ├── rag/
│   │   ├── embedding-service.ts           # Generate embeddings (Vertex AI)
│   │   ├── vector-store.ts                # Pinecone client wrapper
│   │   ├── document-processor.ts          # Chunk & index documents
│   │   └── semantic-search.ts             # Search & retrieve relevant docs
│   │
│   ├── tts/
│   │   └── text-to-speech-service.ts      # Google Text-to-Speech
│   │
│   ├── stt/
│   │   └── speech-to-text-service.ts      # Google Speech-to-Text
│   │
│   └── work-orders/
│       └── work-order-service.ts          # Work order business logic
│
├── lib/                                    # 🔧 SHARED: Utilities
│   ├── supabase/
│   │   ├── client.ts                      # Browser Supabase client
│   │   └── server.ts                      # Server-side Supabase client
│   ├── auth/
│   │   └── context.tsx                    # Auth context (useAuth hook)
│   └── utils.ts                           # Helper functions
│
├── components/                             # 🎨 FRONTEND: React Components
│   ├── ui/                                # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── card.tsx
│   │   ├── textarea.tsx
│   │   └── form.tsx
│   │
│   ├── chat/
│   │   ├── chat-interface.tsx             # Main chat UI
│   │   ├── message-list.tsx               # Message display
│   │   ├── message-input.tsx              # Text input
│   │   └── voice-recorder.tsx             # Voice input button
│   │
│   ├── work-orders/
│   │   ├── work-order-list.tsx            # List view
│   │   ├── work-order-card.tsx            # Individual card
│   │   └── work-order-form.tsx            # Create/edit form
│   │
│   ├── equipment/
│   │   ├── equipment-list.tsx             # List view
│   │   └── csv-upload.tsx                 # CSV import UI
│   │
│   ├── documents/
│   │   └── document-list.tsx              # Document library
│   │
│   ├── auth/
│   │   └── user-menu.tsx                  # User dropdown (logout)
│   │
│   └── providers/
│       └── auth-provider.tsx              # Auth context provider wrapper
│
├── hooks/                                  # 🪝 FRONTEND: Custom React Hooks
│   ├── use-chat.ts                        # Chat state management
│   ├── use-work-orders.ts                 # Work order data fetching
│   └── use-equipment.ts                   # Equipment data fetching
│
├── types/                                  # 📝 SHARED: TypeScript Types
│   ├── database.ts                        # Database table interfaces
│   ├── ai.ts                              # AI-related types
│   └── index.ts                           # General shared types
│
└── middleware.ts                           # ⚙️ BACKEND: Route protection
```

---

## Frontend vs Backend

### 🎨 **Frontend (Client-Side)**
**Runs in the browser**

**Location:**
- `src/app/(auth)/` - Auth pages
- `src/app/(dashboard)/` - Protected pages
- `src/components/` - React components
- `src/hooks/` - Custom React hooks

**Characteristics:**
- Uses `'use client'` directive (or is child of client component)
- Can call APIs via `fetch()`
- Handles UI, forms, user interactions
- **Cannot** access environment variables (except `NEXT_PUBLIC_*`)
- **Cannot** directly query database
- **Cannot** access API keys

**Example:**
```typescript
'use client'

export default function ChatPage() {
  const { user } = useAuth()
  
  const sendMessage = async (text: string) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text })
    })
    return response.json()
  }
  
  return <ChatInterface onSend={sendMessage} />
}
```

---

### ⚙️ **Backend (Server-Side)**
**Runs on Node.js server**

**Location:**
- `src/app/api/` - API routes
- `src/services/` - Business logic
- `src/lib/supabase/server.ts` - Server utilities
- `src/middleware.ts` - Route protection

**Characteristics:**
- Runs on server (or serverless functions)
- Has access to all environment variables
- Can query databases directly
- Can call external APIs with secrets
- Handles business logic, validation
- No JSX/React components

**Example:**
```typescript
// src/app/api/chat/route.ts
import { createClient } from '@/lib/supabase/server'
import { geminiClient } from '@/services/ai/gemini-client'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { message } = await request.json()
  
  // Call AI service (backend only)
  const response = await geminiClient.chat(message)
  
  // Save to database (backend only)
  await supabase.from('conversation_messages').insert({
    conversation_id: '...',
    content: response,
    role: 'assistant'
  })
  
  return Response.json({ response })
}
```

---

## Data Flow Example: AI Chat Request

```
[User types message in chat UI]
    ↓
🎨 Frontend: components/chat/chat-interface.tsx
    ├── Displays UI
    └── Calls: fetch('/api/chat', { message })
    ↓
⚙️ Backend: app/api/chat/route.ts
    ├── Validates authentication
    ├── Gets user's company context
    └── Calls: services/ai/context-builder.ts
    ↓
⚙️ Backend: services/ai/context-builder.ts
    ├── Fetches equipment from Supabase
    ├── Fetches recent work orders
    └── Calls: services/rag/semantic-search.ts
    ↓
⚙️ Backend: services/rag/semantic-search.ts
    ├── Generates embedding (Vertex AI)
    ├── Searches Pinecone vector DB
    └── Returns relevant document chunks
    ↓
⚙️ Backend: services/ai/gemini-client.ts
    ├── Constructs prompt with context
    ├── Calls Gemini API
    └── Returns AI response
    ↓
⚙️ Backend: services/ai/function-executor.ts
    └── (If AI wants to create work order)
        └── Calls: services/work-orders/work-order-service.ts
    ↓
⚙️ Backend: app/api/chat/route.ts
    ├── Saves conversation to Supabase
    └── Returns response to client
    ↓
🎨 Frontend: components/chat/chat-interface.tsx
    └── Displays AI response
```

---

## Where Different Concerns Live

| Concern | Location | Type |
|---------|----------|------|
| **User auth UI** | `app/(auth)/login`, `app/(auth)/signup` | 🎨 Frontend |
| **Chat UI** | `components/chat/` | 🎨 Frontend |
| **Work order UI** | `components/work-orders/` | 🎨 Frontend |
| **Equipment UI** | `components/equipment/` | 🎨 Frontend |
| **API endpoints** | `app/api/` | ⚙️ Backend |
| **AI logic** | `services/ai/` | ⚙️ Backend |
| **RAG search** | `services/rag/` | ⚙️ Backend |
| **TTS/STT** | `services/tts/`, `services/stt/` | ⚙️ Backend |
| **Database queries** | `app/api/`, `services/` | ⚙️ Backend |
| **Route protection** | `middleware.ts` | ⚙️ Backend |
| **Auth context** | `lib/auth/context.tsx` | 🔧 Shared |
| **Database types** | `types/database.ts` | 📝 Shared |
| **Utilities** | `lib/utils.ts` | 🔧 Shared |
| **React hooks** | `hooks/` | 🪝 Frontend |

---

## Key Principles

### ✅ **DO:**
- Keep frontend components in `components/`
- Keep API routes in `app/api/`
- Keep business logic in `services/`
- Use route groups `(auth)`, `(dashboard)` for organization
- Use `'use client'` for interactive React components
- Use server-side Supabase client in API routes
- Store secrets in `.env.local` (never commit)

### ❌ **DON'T:**
- Don't put business logic in React components
- Don't access database directly from frontend
- Don't expose API keys in frontend code
- Don't mix API routes with page routes
- Don't use client-side Supabase client in API routes
- Don't commit `.env.local`

---

## Mobile-Friendly Patterns

All UI components follow these mobile-first patterns:

```typescript
// 1. Full-width responsive containers
<div className="w-full max-w-md mx-auto p-4">

// 2. Touch-friendly buttons (min 44x44px)
<button className="min-h-[44px] px-4 py-2 w-full">

// 3. Base font size to prevent iOS zoom
<input className="text-base p-3" />

// 4. Responsive layouts
<div className="flex flex-col lg:flex-row">
  <aside className="hidden lg:block">Sidebar</aside>
  <main className="flex-1">Content</main>
</div>

// 5. Mobile-first breakpoints
className="text-sm md:text-base lg:text-lg"
```

---

## Next Steps

When adding new features:

1. **New page?** → Add to `app/(dashboard)/feature/page.tsx`
2. **New API endpoint?** → Add to `app/api/feature/route.ts`
3. **New service?** → Add to `services/feature/`
4. **New component?** → Add to `components/feature/`
5. **New type?** → Add to `types/`

Always maintain the frontend/backend separation!

---

**Last Updated:** October 19, 2024
