-- =============================================
-- Documents Storage Bucket
-- Created: 2025-11-12
-- Purpose: Create Supabase Storage bucket for document files
-- =============================================

-- Create the documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true, -- Public bucket so users can access via signed URLs
  5242880, -- 5MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Storage Policies for documents bucket
-- =============================================

-- Allow authenticated users to upload documents to their company folder
CREATE POLICY "Users can upload documents to their company folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow authenticated users to view documents from their companies
CREATE POLICY "Users can view documents from their companies"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow admins to update documents in their company folder
CREATE POLICY "Admins can update documents in their company folder"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
  )
);

-- Allow admins to delete documents from their company folder
CREATE POLICY "Admins can delete documents from their company folder"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
  )
);

-- =============================================
-- Notes on Storage Structure
-- =============================================
-- Files are stored as: documents/{company_id}/{document_id}/{filename}
-- This ensures:
-- 1. Company isolation via RLS policies
-- 2. Easy cleanup when documents are deleted
-- 3. Organized structure for file management
