-- =============================================
-- Unified File Status Expansion Migration
-- Created: 2025-12-01
-- Purpose: Add 'analyzing' and 'indexing' states for granular processing visibility
--          Applies to both documents AND photos (unified file processing pipeline)
-- =============================================

-- The files table uses processing_status for documents AND photos.
-- Current states: 'uploaded', 'processing', 'ready', 'failed'
-- New states: 'uploaded', 'analyzing', 'indexing', 'ready', 'failed'
-- 
-- Flow for documents: uploaded -> analyzing (AI summary/equipment extraction) -> indexing (RAG) -> ready
-- Flow for photos:    uploaded -> analyzing (scene analysis/vision) -> indexing (RAG) -> ready
-- 
-- Note: We're replacing 'processing' with more granular 'analyzing' and 'indexing'
-- for better visibility into the file processing pipeline.

-- Step 1: Drop the old constraint FIRST (before any updates)
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_processing_status_check;

-- Step 2: Add new constraint with expanded states (allows both old and new values during transition)
ALTER TABLE files ADD CONSTRAINT files_processing_status_check 
  CHECK (processing_status IN ('uploaded', 'analyzing', 'indexing', 'processing', 'ready', 'failed'));

-- Step 3: Update any existing 'processing' documents to 'analyzing'
-- (they'll transition to proper state on next queue run)
UPDATE files 
SET processing_status = 'analyzing' 
WHERE processing_status = 'processing' 
  AND bucket_id = 'documents';

-- Step 4: Update any existing 'processing' photos to 'analyzing'
-- (photos in 'processing' are likely in vision analysis phase)
UPDATE files 
SET processing_status = 'analyzing' 
WHERE processing_status = 'processing' 
  AND bucket_id = 'photos';

-- Step 5: Now tighten the constraint to remove 'processing' (no longer needed)
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_processing_status_check;
ALTER TABLE files ADD CONSTRAINT files_processing_status_check 
  CHECK (processing_status IN ('uploaded', 'analyzing', 'indexing', 'ready', 'failed'));

-- =============================================
-- Add extracted_equipment_info column to files metadata
-- =============================================
-- This stores structured equipment information extracted from documents
-- Format: { name, manufacturer, model, type, serial_number, confidence }
-- Stored in metadata JSONB field as 'extracted_equipment_info'

-- No schema change needed - we'll store in existing metadata JSONB column
-- Example: metadata->'extracted_equipment_info'->>'manufacturer'

-- =============================================
-- Index for efficient status-based queries
-- =============================================
-- Help queries that filter by processing status (e.g., find all analyzing files)
CREATE INDEX IF NOT EXISTS idx_files_processing_status 
  ON files(processing_status);

-- Composite index for company + status queries (common in UI)
CREATE INDEX IF NOT EXISTS idx_files_company_status 
  ON files(company_id, processing_status);

-- =============================================
-- Comments for documentation
-- =============================================
COMMENT ON COLUMN files.processing_status IS 
  'File processing lifecycle: uploaded -> analyzing (AI: summary for docs, scene analysis for photos) -> indexing (RAG/Pinecone) -> ready. Failed indicates error.';
