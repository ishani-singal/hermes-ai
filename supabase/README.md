# Supabase Setup Guide

## Quick Start

### 1. Get your credentials
1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **Settings → API**
3. Copy the following:
   - Project URL
   - **Publishable key** (sb_publishable_...) - safe for browser
   - **Secret key** (sb_secret_...) - keep this secret, server-only!

> **Note:** Older projects may show `anon` and `service_role` keys. These work the same way but the new publishable/secret keys are recommended for better rotation and security.

### 2. Configure environment variables
1. Open `.env.local`
2. Add your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
```

### 3. Test the connection
Run the dev server and check for errors:
```bash
npm run dev
```

## Project Structure

```
supabase/
├── migrations/          # SQL migration files (version controlled)
└── README.md           # This file

src/lib/supabase/
├── client.ts           # Client-side Supabase client (browser)
└── server.ts           # Server-side admin client (API routes only)
```

## Usage

### Client-side (components, pages)
```typescript
import { supabase } from '@/lib/supabase/client'

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
})

// Query data
const { data: equipment } = await supabase
  .from('equipment')
  .select('*')
```

### Server-side (API routes, server components)
```typescript
import { supabaseAdmin } from '@/lib/supabase/server'

// Bypass RLS for admin operations
const { data, error } = await supabaseAdmin
  .from('equipment')
  .insert({ name: 'CNC Machine' })
```

## Authentication Setup

### Configure auth providers
1. Go to **Authentication → Providers** in Supabase dashboard
2. Enable **Email** provider (enabled by default)
3. Configure email templates in **Authentication → Email Templates**
4. (Optional) Enable OAuth providers (Google, GitHub, etc.)

### Configure auth settings
1. Go to **Authentication → URL Configuration**
2. Add your site URL: `http://localhost:3000` (dev) or your production URL
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://your-production-url.com/auth/callback`

## Storage Setup

### Create storage buckets
1. Go to **Storage** in Supabase dashboard
2. Create buckets:
   - `documents` - for PDFs, manuals
   - `media` - for images, videos
   - `tts` - for text-to-speech audio files (temporary)

### Configure bucket policies
For each bucket, set up policies in **Storage → Policies**:
```sql
-- Example: Allow authenticated users to upload to their company folder
CREATE POLICY "Users can upload to company folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM users WHERE id = auth.uid()
  )
);
```

## Database Migrations

### Using Supabase CLI (recommended)
```bash
# Install CLI globally
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Pull existing schema
supabase db pull

# Create new migration
supabase migration new add_users_table

# Apply migrations
supabase db push
```

### Manual approach
1. Create SQL files in `supabase/migrations/`
2. Name them with timestamps: `20241017000000_initial_schema.sql`
3. Run them manually in SQL Editor or via CLI

## Next Steps

- [ ] Fill in `.env.local` with your Supabase credentials
- [ ] Configure auth providers and URLs
- [ ] Create storage buckets
- [ ] Design database schema
- [ ] Create initial migration files
- [ ] Set up Row Level Security (RLS) policies

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)
