# Hermes AI

An AI-powered assistant for manufacturing technicians on the shop floor. Built with Next.js, Supabase, and Mastra.

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) — free to use, modify, and share for any noncommercial purpose (personal projects, research, education, evaluation).

**Commercial use is not covered by this license.** If you want to use this software, or anything derived from it, in a for-profit product or service, contact Ishani Singal to arrange a commercial license. Commercial terms are negotiated case-by-case and may include a revenue-sharing arrangement.

## Features

- 🤖 **AI Chat Assistant**: Powered by Google Gemini 2.0 Flash via Mastra
- 💬 **Persistent Memory**: Conversations are saved and continue across sessions
- 🎤 **Voice Input**: Browser-based speech-to-text for hands-free operation
- 🔊 **Voice Output**: Google Cloud TTS reads responses aloud in streaming mode
- 🔧 **Work Order Management**: Create, view, and update work orders via chat or UI
- 👥 **Multi-tenant**: Company-based access control with user roles
- 🔐 **Authentication**: Secure auth with Supabase
- 📊 **Dashboard**: Overview of work orders and key metrics

## Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Backend**: Next.js API Routes, Supabase PostgreSQL
- **AI Agent**: Mastra with Memory support
- **Voice**: Browser Speech Recognition API + Google Cloud TTS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Getting Started

### Prerequisites

- Node.js 20+ 
- npm or yarn
- Supabase account (or local Supabase setup)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (see `docs/code/environment-variables.md`)

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

5. Run database migrations:

```bash
supabase db reset  # For local development
# or
supabase db push   # To push migrations to existing database
```

6. Open [http://localhost:3000](http://localhost:3000) with your browser

### Initial Setup

1. Create an account via the signup page
2. Create or join a company
3. Start chatting with the AI assistant or manage work orders

### Voice Features

**Push-to-Talk Mode** (Microphone button):
- Click microphone to start listening
- Speak your message
- Click microphone again or press Send to submit

**Streaming Voice Mode** (Radio/Stream button):
- Click stream button to start continuous conversation
- Speak your request → AI responds with text AND voice
- AI automatically speaks responses aloud using Google TTS
- Click stream button again to stop

**Requirements for Voice Output:**
- Set `GOOGLE_CLOUD_SPEECH_API_KEY` in `.env.local` (server-only, not exposed to frontend)
- Enable Cloud Text-to-Speech API in Google Cloud Console

## Documentation

- **[Memory Implementation](docs/code/memory-implementation.md)**: Details on Mastra memory system
- **[Memory Setup Guide](docs/code/mastra-memory-setup-guide.md)**: Complete setup instructions
- **[Environment Variables](docs/code/environment-variables.md)**: Required configuration
- **[Authorization Architecture](docs/code/authorization-architecture.md)**: How auth and permissions work
- **[Folder Structure](docs/code/folder-structure.md)**: Project organization

## Key Features

### AI Assistant with Memory

The AI assistant remembers your conversations within each session:
- **Session Persistence**: Conversations persist when switching tabs
- **Working Memory**: Agent tracks current work orders and tasks being discussed
- **Context Awareness**: Understands the flow of multi-turn conversations
- **Fresh Start**: Each page refresh or logout starts a new conversation

**Note**: For v1, conversation history resets on page refresh. This keeps the UX simple and fast.

See [Memory Implementation](docs/code/memory-implementation.md) for technical details.

### Work Order Management

Interact with work orders via:
- **Natural language chat**: "Create a work order for pump repair"
- **Direct UI**: Forms and lists in the Work Orders tab
- **Filtering**: Search by title, filter by status/priority

### Multi-tenant Architecture

- Users can belong to multiple companies
- Row Level Security (RLS) ensures data isolation
- Role-based access control (admin, editor, viewer)

## Project Structure

```
hai-technician-assistant/
├── src/
│   ├── app/                      # Next.js app directory
│   │   ├── (auth)/              # Auth pages (login, signup)
│   │   ├── api/                 # API routes
│   │   │   ├── ai/             # Chat and memory endpoints
│   │   │   ├── auth/           # Auth endpoints
│   │   │   └── work-orders/    # Work order CRUD
│   │   └── dashboard/          # Main dashboard
│   ├── components/              # React components
│   │   ├── chat/               # Chat UI with memory
│   │   ├── work-orders/        # Work order components
│   │   └── ui/                 # Shared UI components
│   ├── lib/                    # Utilities
│   │   ├── auth/               # Auth helpers
│   │   └── supabase/           # Supabase clients
│   ├── mastra/                 # AI agent configuration
│   │   ├── agents/             # Agent definitions
│   │   └── tools/              # Agent tools
│   └── types/                  # TypeScript types
├── supabase/
│   └── migrations/             # Database migrations
└── docs/                       # Documentation
```

## Development

### Running Locally

```bash
# Start Supabase (local)
supabase start

# Start Next.js dev server
npm run dev

# Optional: Run Mastra dev mode
npm run mastra:dev
```

### Building for Production

```bash
npm run build
npm start
```

## Deployment

See [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for hosting options.

### Environment Variables for Production

Ensure the following are set:
- `DATABASE_URL`: Supabase PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `GOOGLE_CLOUD_SPEECH_API_KEY`: Google Cloud API key for TTS (server-only)
- `INTERNAL_API_BASE_URL`: Internal API URL for server-to-server calls

## Contributing

See individual documentation files for detailed architectural information.

## License

Proprietary - All rights reserved
