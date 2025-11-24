-- =============================================
-- Files and Attachments Migration
-- Created: 2025-11-14
-- Purpose: Unified files table (photos, documents) with separate link tables for Work Orders and Equipment
-- =============================================

-- =============================================
-- Storage Buckets
-- =============================================
-- Photos Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  20971520, -- 20MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Documents Bucket (Ensure it exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 1. Files Table (Photos, Documents)
-- =============================================
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Storage Details
  bucket_id TEXT NOT NULL CHECK (bucket_id IN ('photos', 'documents')),
  storage_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  
  -- File Metadata
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- MIME type
  file_size BIGINT NOT NULL,
  
  -- AI/Analysis
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  -- TODO: Add JSON Schema validation for metadata column based on bucket_id
  -- Documents should have: display_id, document_type, scope, page_count, archived_at, archive_reason
  -- Photos should have: display_id, ocr_text, scene_summary, extracted_serials[], detected_objects[], damage_indicators[]
  -- Can use CHECK constraint with jsonb_matches_schema() once schemas are defined
  processing_status TEXT DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'ready', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================
-- 2. Work Order Links
-- =============================================
CREATE TABLE work_order_files (
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  
  -- link_type describes WHEN/WHY this file was attached:
  -- 'before' - Photo taken before work started (typically photo)
  -- 'after' - Photo taken after work completed (typically photo)
  -- 'evidence' - Photo or document showing the issue/repair
  -- 'reference' - Supporting documentation (manual page, spec sheet)
  -- 'other' - Miscellaneous attachment
  link_type TEXT CHECK (link_type IN ('before', 'after', 'evidence', 'reference', 'other')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  PRIMARY KEY (work_order_id, file_id)
);

-- =============================================
-- 3. Equipment Links
-- =============================================
CREATE TABLE equipment_files (
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  
  -- link_type describes WHY this file is attached to equipment:
  -- 'profile' - Main photo/image representing this equipment (typically a photo)
  -- 'manual' - Instruction manual, service guide (typically a document)
  -- 'reference' - Reference photo, schematic, diagram (photo or document)
  -- 'other' - Miscellaneous attachment
  -- Note: Frontend should validate that only photos (bucket_id='photos') can be 'profile'
  link_type TEXT CHECK (link_type IN ('profile', 'manual', 'reference', 'other')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  PRIMARY KEY (equipment_id, file_id)
);

-- =============================================
-- Display ID Generation
-- =============================================

-- Generate document display_id
-- Format: DOC-{COMPANY_CODE}-{SEQUENCE}
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
        WHEN (metadata->>'display_id') ~ '^DOC-[A-Z0-9]+-[0-9]{4}$' THEN
          CAST(SPLIT_PART(metadata->>'display_id', '-', 3) AS INTEGER)
        ELSE 0
      END
    ),
    0
  ) + 1 INTO seq_num
  FROM files
  WHERE company_id IN (
    SELECT c.id FROM companies c WHERE c.company_code = p_company_code
  )
  AND bucket_id = 'documents';

  -- Generate the display_id
  generated_display_id := FORMAT('DOC-%s-%s',
    p_company_code,
    LPAD(seq_num::TEXT, 4, '0')
  );

  RETURN generated_display_id;
END;
$$ LANGUAGE plpgsql;

-- Generate photo display_id
-- Format: PHOTO-{COMPANY_CODE}-{SEQUENCE}
CREATE OR REPLACE FUNCTION generate_photo_display_id(p_company_code TEXT)
RETURNS TEXT AS $$
DECLARE
  generated_display_id TEXT;
  seq_num INTEGER;
BEGIN
  -- Get the next sequence number for this company
  -- Pattern: PHOTO-{company_code}-{4-digit-sequence}
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN (metadata->>'display_id') ~ '^PHOTO-[A-Z0-9]+-[0-9]{4}$' THEN
          CAST(SPLIT_PART(metadata->>'display_id', '-', 3) AS INTEGER)
        ELSE 0
      END
    ),
    0
  ) + 1 INTO seq_num
  FROM files
  WHERE company_id IN (
    SELECT c.id FROM companies c WHERE c.company_code = p_company_code
  )
  AND bucket_id = 'photos';

  -- Generate the display_id
  generated_display_id := FORMAT('PHOTO-%s-%s',
    p_company_code,
    LPAD(seq_num::TEXT, 4, '0')
  );

  RETURN generated_display_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate display_id trigger
CREATE OR REPLACE FUNCTION auto_generate_file_display_id()
RETURNS TRIGGER AS $$
DECLARE
  company_code TEXT;
  new_display_id TEXT;
BEGIN
  -- Only generate if display_id is not already set
  IF (NEW.metadata->>'display_id') IS NULL THEN
    -- Get company code
    SELECT c.company_code INTO company_code
    FROM companies c
    WHERE c.id = NEW.company_id;
    
    -- Generate display_id based on bucket_id if company exists
    IF company_code IS NOT NULL THEN
      IF NEW.bucket_id = 'documents' THEN
        new_display_id := generate_document_display_id(company_code);
      ELSIF NEW.bucket_id = 'photos' THEN
        new_display_id := generate_photo_display_id(company_code);
      END IF;
      
      -- Update metadata with display_id
      IF new_display_id IS NOT NULL THEN
        IF NEW.metadata IS NULL THEN
          NEW.metadata := '{}'::jsonb;
        END IF;
        
        NEW.metadata := jsonb_set(
          NEW.metadata,
          '{display_id}',
          to_jsonb(new_display_id)
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER files_auto_display_id
  BEFORE INSERT ON files
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_file_display_id();

-- =============================================
-- Data Migration (Consolidate old tables)
-- =============================================

-- 1. Migrate work_order_attachments -> files + work_order_files
DO $$
DECLARE
  r RECORD;
  new_file_id UUID;
BEGIN
  -- Loop through existing attachments if the table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'work_order_attachments') THEN
    FOR r IN SELECT * FROM work_order_attachments LOOP
      new_file_id := gen_random_uuid();
      
      -- Insert into files
      INSERT INTO files (
        id, company_id, uploaded_by, bucket_id, storage_path, 
        file_url, file_name, file_type, file_size, created_at
      )
      SELECT 
        new_file_id,
        wo.company_id,
        r.uploaded_by,
        'documents', -- Default bucket for legacy files
        '', -- Unknown storage path
        r.file_url,
        r.file_name,
        COALESCE(r.file_type, 'application/octet-stream'),
        r.file_size,
        r.created_at
      FROM work_orders wo WHERE wo.id = r.work_order_id;
      
      -- Insert into work_order_files
      INSERT INTO work_order_files (work_order_id, file_id, link_type)
      VALUES (r.work_order_id, new_file_id, 'evidence');
    END LOOP;
  END IF;
END $$;

-- 2. Migrate documents -> files + equipment_files
DO $$
DECLARE
  r RECORD;
  new_file_id UUID;
  doc_metadata JSONB;
BEGIN
  -- Loop through existing documents if the table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'documents') THEN
    FOR r IN SELECT * FROM documents LOOP
      -- Use existing ID if possible
      new_file_id := r.id;
      
      -- Construct metadata
      doc_metadata := jsonb_build_object(
        'display_id', r.display_id,
        'document_type', r.type,
        'scope', r.scope,
        'page_count', r.page_count,
        'processing_error', r.processing_error,
        'archived_at', r.archived_at,
        'archive_reason', r.archive_reason
      );

      -- Insert into files
      INSERT INTO files (
        id, company_id, uploaded_by, bucket_id, storage_path, 
        file_url, file_name, file_type, file_size, 
        description, metadata, processing_status,
        created_at, updated_at
      )
      VALUES (
        new_file_id,
        r.company_id,
        NULL, -- documents table didn't have uploaded_by
        'documents',
        '', -- Unknown storage path
        r.file_url,
        r.title, -- Use title as file_name
        'application/pdf', -- Default to PDF
        r.file_size,
        r.title, -- Use title as description
        doc_metadata,
        CASE 
          WHEN r.status = 'analyzing' THEN 'processing'
          ELSE r.status 
        END,
        r.created_at,
        r.updated_at
      );
      
      -- Insert into equipment_files if linked to equipment
      IF r.equipment_id IS NOT NULL THEN
        INSERT INTO equipment_files (equipment_id, file_id, link_type)
        VALUES (r.equipment_id, new_file_id, 'manual'); -- Default to manual
      END IF;
      
    END LOOP;
  END IF;
END $$;

-- Drop old tables if they exist
DROP TABLE IF EXISTS work_order_attachments;
DROP TABLE IF EXISTS documents;

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_files_company ON files(company_id);
CREATE INDEX idx_files_bucket ON files(bucket_id);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);

CREATE INDEX idx_work_order_files_file ON work_order_files(file_id);
CREATE INDEX idx_equipment_files_file ON equipment_files(file_id);

-- =============================================
-- Triggers
-- =============================================
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_files_updated_at();

-- =============================================
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_files ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - READ
-- =============================================

-- Files: Users can view files from their company
CREATE POLICY files_select_policy ON files
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Work Order Files: Users can view links for their company's work orders
CREATE POLICY work_order_files_select_policy ON work_order_files
  FOR SELECT
  USING (
    work_order_id IN (
      SELECT id FROM work_orders
      WHERE company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Equipment Files: Users can view links for their company's equipment
CREATE POLICY equipment_files_select_policy ON equipment_files
  FOR SELECT
  USING (
    equipment_id IN (
      SELECT id FROM equipment
      WHERE company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- =============================================
-- RLS POLICIES - WRITE
-- =============================================

-- Files: Upload/Insert
CREATE POLICY files_insert_policy ON files
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
    AND (uploaded_by = auth.uid() OR uploaded_by IS NULL)
  );

-- Files: Update (Owner or Admin)
CREATE POLICY files_update_policy ON files
  FOR UPDATE
  USING (
    (uploaded_by = auth.uid()) OR
    (company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    ))
  );

-- Files: Delete (Owner or Admin)
CREATE POLICY files_delete_policy ON files
  FOR DELETE
  USING (
    (uploaded_by = auth.uid()) OR
    (company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    ))
  );

-- Work Order Files: Link/Unlink (Admin/Editor)
-- Simplified for MVP: Allow if user has access to the work order
CREATE POLICY work_order_files_insert_policy ON work_order_files
  FOR INSERT
  WITH CHECK (
    work_order_id IN (
      SELECT id FROM work_orders
      WHERE company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY work_order_files_delete_policy ON work_order_files
  FOR DELETE
  USING (
    work_order_id IN (
      SELECT id FROM work_orders
      WHERE company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Equipment Files: Link/Unlink (Admin/Editor)
CREATE POLICY equipment_files_insert_policy ON equipment_files
  FOR INSERT
  WITH CHECK (
    equipment_id IN (
      SELECT id FROM equipment
      WHERE company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY equipment_files_delete_policy ON equipment_files
  FOR DELETE
  USING (
    equipment_id IN (
      SELECT id FROM equipment
      WHERE company_id IN (
        SELECT company_id FROM user_companies 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- =============================================
-- Storage Policies (Photos Bucket)
-- =============================================
-- Note: Similar policies should be applied to 'documents' bucket

CREATE POLICY "Users can upload photos to their company folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can view photos from their companies"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos'
  AND auth.role() = 'authenticated'
  AND (
    (owner = auth.uid()) OR
    ((storage.foldername(name))[1] IN (
      SELECT company_id::text FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    ))
  )
);

