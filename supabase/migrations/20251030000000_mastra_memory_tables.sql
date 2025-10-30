-- =============================================
-- Mastra Memory RLS Policies
-- =============================================
-- Mastra's PostgresStore automatically creates the following tables:
--   - mastra_threads
--   - mastra_messages  
--
-- This migration adds Row Level Security (RLS) policies to ensure
-- users can only access their own conversations.
-- =============================================

-- Note: If tables don't exist yet, Mastra will create them on first run.
-- This migration file only adds RLS policies and can be run safely even if tables exist.

-- Enable Row Level Security (only if tables exist)
-- These commands will fail gracefully if tables don't exist yet
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mastra_threads') THEN
    ALTER TABLE mastra_threads ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mastra_messages') THEN
    ALTER TABLE mastra_messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies: Users can only access their own threads/messages
-- resourceId will be the user's ID (Mastra uses camelCase column names)
-- Drop existing policies if they exist to avoid conflicts

-- Threads policies
DROP POLICY IF EXISTS threads_select_own ON mastra_threads;
DROP POLICY IF EXISTS threads_insert_own ON mastra_threads;
DROP POLICY IF EXISTS threads_update_own ON mastra_threads;
DROP POLICY IF EXISTS threads_delete_own ON mastra_threads;

CREATE POLICY threads_select_own ON mastra_threads
  FOR SELECT
  USING ("resourceId" = auth.uid()::text);

CREATE POLICY threads_insert_own ON mastra_threads
  FOR INSERT
  WITH CHECK ("resourceId" = auth.uid()::text);

CREATE POLICY threads_update_own ON mastra_threads
  FOR UPDATE
  USING ("resourceId" = auth.uid()::text);

CREATE POLICY threads_delete_own ON mastra_threads
  FOR DELETE
  USING ("resourceId" = auth.uid()::text);

-- Messages policies
DROP POLICY IF EXISTS messages_select_own ON mastra_messages;
DROP POLICY IF EXISTS messages_insert_own ON mastra_messages;

CREATE POLICY messages_select_own ON mastra_messages
  FOR SELECT
  USING (
    thread_id IN (
      SELECT id FROM mastra_threads WHERE "resourceId" = auth.uid()::text
    )
  );

CREATE POLICY messages_insert_own ON mastra_messages
  FOR INSERT
  WITH CHECK (
    thread_id IN (
      SELECT id FROM mastra_threads WHERE "resourceId" = auth.uid()::text
    )
  );

-- =============================================
-- Indexes for Performance (if tables exist)
-- =============================================
-- These will be created by Mastra, but we add them here for better query performance

DO $$ 
BEGIN
  -- Thread indexes (using camelCase column names)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mastra_threads') THEN
    CREATE INDEX IF NOT EXISTS idx_mastra_threads_resource_id ON mastra_threads("resourceId");
    CREATE INDEX IF NOT EXISTS idx_mastra_threads_created_at ON mastra_threads("createdAtZ" DESC);
  END IF;
  
  -- Message indexes (thread_id is snake_case, createdAt is camelCase)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mastra_messages') THEN
    CREATE INDEX IF NOT EXISTS idx_mastra_messages_thread_id ON mastra_messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_mastra_messages_created_at ON mastra_messages("createdAtZ");
  END IF;
END $$;

