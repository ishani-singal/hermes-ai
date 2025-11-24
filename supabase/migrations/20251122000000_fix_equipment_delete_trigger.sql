-- =============================================
-- Fix Equipment Delete Trigger
-- Created: 2025-11-22
-- Purpose: Update trigger to work with new files table instead of old documents table
-- =============================================

-- Drop the old trigger and function that references 'documents' table
DROP TRIGGER IF EXISTS equipment_archive_documents ON equipment;
DROP FUNCTION IF EXISTS archive_documents_on_equipment_delete();

-- Create new function that works with 'files' table
CREATE OR REPLACE FUNCTION archive_files_on_equipment_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Archive all files linked to this equipment via equipment_files
  -- Update the metadata to mark as archived
  UPDATE files
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{archived_at}',
    to_jsonb(now()::text)
  ) || jsonb_build_object('archive_reason', 'equipment_deleted')
  WHERE id IN (
    SELECT file_id FROM equipment_files WHERE equipment_id = OLD.id
  ) AND (metadata->>'archived_at') IS NULL;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger
CREATE TRIGGER equipment_archive_files
  BEFORE DELETE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION archive_files_on_equipment_delete();

-- Add comment for documentation
COMMENT ON FUNCTION archive_files_on_equipment_delete() IS 
'Archives files (documents and photos) linked to equipment when equipment is deleted. Sets archived_at and archive_reason in metadata JSONB field.';
