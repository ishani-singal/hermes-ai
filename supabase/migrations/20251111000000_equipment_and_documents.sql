-- =============================================
-- Equipment and Documents Migration
-- Created: 2025-11-11
-- Purpose: Add equipment catalog and document management tables for RAG
-- =============================================

-- =============================================
-- Equipment Table
-- =============================================
-- Company-scoped equipment catalog
-- Used as context for work orders and AI conversations
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- User-facing ID (readable format: EQ-ACME-0001)
  -- Auto-generated via trigger, NOT NULL enforced after trigger setup
  display_id VARCHAR(50),
  
  -- Equipment details
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  serial_number VARCHAR(255),
  location VARCHAR(255),
  
  -- Metadata for custom fields (company-specific)
  metadata JSONB DEFAULT '{}' NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Constraints
  UNIQUE(company_id, serial_number),
  UNIQUE(display_id),
  CONSTRAINT name_not_empty CHECK (length(trim(name)) > 0)
);

-- =============================================
-- Documents Table
-- =============================================
-- Equipment manuals, safety guides, SOPs, troubleshooting guides
-- Can be company-wide or linked to specific equipment
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  
  -- User-facing ID (readable format: DOC-ACME-0001)
  -- Auto-generated via trigger, NOT NULL enforced after trigger setup
  display_id VARCHAR(50),
  
  -- Metadata
  title VARCHAR(255) NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('manual', 'safety', 'sop', 'troubleshooting', 'other')),
  scope TEXT NOT NULL DEFAULT 'company'
    CHECK (scope IN ('company', 'equipment')),
  
  -- File information
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  page_count INTEGER,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  processing_error TEXT,
  
  -- Archival (for when equipment is deleted, before final removal)
  -- Documents can be archived to exclude from search/RAG without hard delete
  -- This allows recovery and gives admins time to decide on permanent deletion
  archived_at TIMESTAMPTZ,
  archive_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Constraints
  UNIQUE(display_id),
  CONSTRAINT scope_equipment_check 
    CHECK (scope = 'company' OR equipment_id IS NOT NULL),
  CONSTRAINT title_not_empty CHECK (length(trim(title)) > 0)
);

-- =============================================
-- Indexes
-- =============================================

-- Equipment: Company lookup (critical for RLS and queries)
CREATE INDEX idx_equipment_company_id ON equipment(company_id);

-- Equipment: Display ID lookup (user-facing reference)
CREATE INDEX idx_equipment_display_id ON equipment(display_id);

-- Equipment: Search by serial number
CREATE INDEX idx_equipment_serial_number ON equipment(serial_number);

-- Documents: Display ID lookup (user-facing reference)
CREATE INDEX idx_documents_display_id ON documents(display_id);

-- Equipment: Search by type
CREATE INDEX idx_equipment_type ON equipment(type);

-- Documents: Company lookup (critical for RLS and queries)
CREATE INDEX idx_documents_company_id ON documents(company_id);

-- Documents: Equipment lookup (find docs for a specific equipment)
CREATE INDEX idx_documents_equipment_id ON documents(equipment_id) 
  WHERE equipment_id IS NOT NULL;

-- Documents: Status filtering (find processing documents)
CREATE INDEX idx_documents_status ON documents(status);

-- Documents: Scope filtering (company-wide vs equipment-specific)
CREATE INDEX idx_documents_scope ON documents(company_id, scope);

-- Documents: Composite for common queries (find ready docs for equipment)
CREATE INDEX idx_documents_equipment_status ON documents(equipment_id, status) 
  WHERE equipment_id IS NOT NULL AND status = 'ready';

-- Documents: Archived status (exclude from search/RAG/lists)
CREATE INDEX idx_documents_not_archived ON documents(company_id, archived_at)
  WHERE archived_at IS NULL;

-- Documents: Find archived docs for cleanup/recovery
CREATE INDEX idx_documents_archived ON documents(archived_at)
  WHERE archived_at IS NOT NULL;

-- =============================================
-- Display ID Generation Functions
-- =============================================

-- Generate equipment display_id
-- Format: EQ-{COMPANY_CODE}-{SEQUENCE}
-- Example: EQ-ACME-0001
CREATE OR REPLACE FUNCTION generate_equipment_display_id(p_company_code TEXT)
RETURNS TEXT AS $$
DECLARE
  generated_display_id TEXT;
  seq_num INTEGER;
BEGIN
  -- Get the next sequence number for this company
  -- Pattern: EQ-{company_code}-{4-digit-sequence}
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN eq.display_id ~ '^EQ-[A-Z0-9]+-[0-9]{4}$' THEN
          CAST(SPLIT_PART(eq.display_id, '-', 3) AS INTEGER)
        ELSE 0
      END
    ),
    0
  ) + 1 INTO seq_num
  FROM equipment eq
  WHERE eq.company_id IN (
    SELECT c.id FROM companies c WHERE c.company_code = p_company_code
  );

  -- Generate the display_id
  generated_display_id := FORMAT('EQ-%s-%s',
    p_company_code,
    LPAD(seq_num::TEXT, 4, '0')
  );

  RETURN generated_display_id;
END;
$$ LANGUAGE plpgsql;

-- Generate document display_id
-- Format: DOC-{COMPANY_CODE}-{SEQUENCE}
-- Example: DOC-ACME-0001
CREATE OR REPLACE FUNCTION generate_document_display_id(p_company_code TEXT)
RETURNS TEXT AS $$
DECLARE
  generated_display_id TEXT;
  seq_num INTEGER;
BEGIN
  -- Get the next sequence number for this company
  -- Pattern: DOC-{company_code}-{4-digit-sequence}
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN doc.display_id ~ '^DOC-[A-Z0-9]+-[0-9]{4}$' THEN
          CAST(SPLIT_PART(doc.display_id, '-', 3) AS INTEGER)
        ELSE 0
      END
    ),
    0
  ) + 1 INTO seq_num
  FROM documents doc
  WHERE doc.company_id IN (
    SELECT c.id FROM companies c WHERE c.company_code = p_company_code
  );

  -- Generate the display_id
  generated_display_id := FORMAT('DOC-%s-%s',
    p_company_code,
    LPAD(seq_num::TEXT, 4, '0')
  );

  RETURN generated_display_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Triggers
-- =============================================

-- Auto-update equipment.updated_at timestamp
CREATE OR REPLACE FUNCTION update_equipment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_equipment_updated_at();

-- Auto-generate equipment.display_id on insert
CREATE OR REPLACE FUNCTION auto_generate_equipment_display_id()
RETURNS TRIGGER AS $$
DECLARE
  company_code TEXT;
BEGIN
  IF NEW.display_id IS NULL THEN
    -- Get company code
    SELECT c.company_code INTO company_code
    FROM companies c
    WHERE c.id = NEW.company_id;
    
    -- Generate display_id if company exists
    IF company_code IS NOT NULL THEN
      NEW.display_id := generate_equipment_display_id(company_code);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_auto_display_id
  BEFORE INSERT ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_equipment_display_id();

-- Auto-update documents.updated_at timestamp
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Auto-generate documents.display_id on insert
CREATE OR REPLACE FUNCTION auto_generate_document_display_id()
RETURNS TRIGGER AS $$
DECLARE
  company_code TEXT;
BEGIN
  IF NEW.display_id IS NULL THEN
    -- Get company code
    SELECT c.company_code INTO company_code
    FROM companies c
    WHERE c.id = NEW.company_id;
    
    -- Generate display_id if company exists
    IF company_code IS NOT NULL THEN
      NEW.display_id := generate_document_display_id(company_code);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_auto_display_id
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_document_display_id();

-- Clear processing_error when status changes to 'processing'
CREATE OR REPLACE FUNCTION clear_document_processing_error()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'processing' THEN
    NEW.processing_error = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_clear_error
  BEFORE UPDATE ON documents
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION clear_document_processing_error();

-- Archive documents when their equipment is deleted
-- This preserves the document for potential recovery while
-- excluding it from search/RAG without hard deletion
CREATE OR REPLACE FUNCTION archive_documents_on_equipment_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE documents
  SET 
    archived_at = now(),
    archive_reason = 'equipment_deleted',
    equipment_id = NULL
  WHERE equipment_id = OLD.id AND archived_at IS NULL;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_archive_documents
  BEFORE DELETE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION archive_documents_on_equipment_delete();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - READ (All authenticated users in company)
-- =============================================

-- Equipment: Users can view equipment from their companies
CREATE POLICY equipment_select_policy ON equipment
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Documents: Users can view documents from their companies
CREATE POLICY documents_select_policy ON documents
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- =============================================
-- RLS POLICIES - WRITE (Admin-only for MVP)
-- =============================================

-- MVP STRATEGY: Only admins can create/update/delete equipment and documents
-- This allows API endpoints to use user session (createServerClient)
-- without complex permission logic during pilot phase
--
-- Note: We handle more granular permissions at the API level
-- (e.g., technicians can upload documents) until we add role-based RLS

-- Equipment: INSERT (Admin-only)
CREATE POLICY equipment_insert_admin_policy ON equipment
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- Equipment: UPDATE (Admin-only)
CREATE POLICY equipment_update_admin_policy ON equipment
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- Equipment: DELETE (Admin-only)
CREATE POLICY equipment_delete_admin_policy ON equipment
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- Documents: INSERT (Admin-only at DB level)
-- Note: API can allow technicians to upload, we'll check role in API
CREATE POLICY documents_insert_admin_policy ON documents
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- Documents: UPDATE (Admin-only at DB level)
-- Note: API can allow status updates via background jobs
CREATE POLICY documents_update_admin_policy ON documents
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- Documents: DELETE (Admin-only)
CREATE POLICY documents_delete_admin_policy ON documents
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role = 'admin'
    )
  );

-- =============================================
-- Notes on RLS and API Authorization
-- =============================================

-- RLS Limitations (MVP approach):
-- These policies enforce admin-only access at the database level.
-- This is simple and secure, but limits non-admin functionality.
--
-- For POST-MVP permission expansion (e.g., technicians uploading docs):
-- Either add more RLS policies for specific roles, OR
-- switch API to service role key + custom permission checks in application
--
-- Current approach keeps things simple while maintaining security:
-- - RLS prevents data leakage between companies (primary concern)
-- - Admin-only DB access is enforced
-- - API layer can implement more granular permissions as needed
-- - Easy to migrate to service role approach later without schema changes

-- =============================================
-- Document Archival Strategy
-- =============================================

-- When equipment is deleted:
-- 1. Trigger automatically archives all linked documents (archived_at = now())
-- 2. Reason stored in archive_reason ('equipment_deleted')
-- 3. equipment_id set to NULL (becomes company-wide accessible)
--
-- Benefits of archival vs hard delete:
-- - Preserves documents for recovery if equipment deletion was accidental
-- - Excluded from search/RAG queries (WHERE archived_at IS NULL)
-- - Admin can review and decide on permanent deletion
-- - Can implement TTL-based cleanup (e.g., auto-delete after 30 days)
--
-- UI Workflow:
-- 1. Admin deletes equipment
-- 2. System archives related documents automatically
-- 3. Notification: "X documents archived due to equipment deletion. Keep or delete?"
-- 4. Admin can:
--    a) Keep: Update archive_reason to custom note, un-archive (set archived_at = NULL)
--    b) Delete: Hard delete archived documents
--    c) Ignore: Archived docs hidden from UI by default (archived_at IS NULL in queries)
--
-- Future cleanup job:
-- - Periodically delete documents where archived_at < (now() - interval '30 days')
-- - Can be configurable per company

-- =============================================
-- Make display_id columns NOT NULL
-- =============================================
-- This is placed at the end, after triggers are set up
-- Triggers will auto-populate display_id on INSERT
ALTER TABLE equipment ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN display_id SET NOT NULL;
