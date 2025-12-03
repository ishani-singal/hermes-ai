/**
 * RAG Common Utilities
 * 
 * Shared functions for chunking, Pinecone operations, and status management
 */

import { MDocument } from '@mastra/rag';
import { namespace } from '@/lib/pinecone/client';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ContentType, PineconeRecord, FileStatus } from './types';

// ============================================
// CHUNKING
// ============================================

export interface ChunkOptions {
  size?: number;
  overlap?: number;
}

/**
 * Chunk text content using Mastra's recursive chunking strategy
 */
export async function chunkText(
  text: string,
  options: ChunkOptions = {}
): Promise<{ text: string }[]> {
  const { size = 1000, overlap = 100 } = options;

  const doc = MDocument.fromText(text);
  const chunks = await doc.chunk({
    strategy: 'recursive',
    size,
    overlap,
  });

  return chunks;
}

// ============================================
// PINECONE OPERATIONS
// ============================================

/**
 * Upsert records to Pinecone
 * Validates companyId and handles errors
 */
export async function upsertRecords(
  records: PineconeRecord[],
  resourceType: ContentType,
  resourceId: string
): Promise<void> {
  if (records.length === 0) {
    console.warn(`[RAG] No records to upsert for ${resourceType} ${resourceId}`);
    return;
  }

  // Validate all records have company_id (multi-tenant security)
  for (const record of records) {
    if (!record.company_id || record.company_id.trim() === '') {
      throw new Error(`[RAG Security] company_id is required for all records`);
    }
  }

  console.log(`[RAG] Upserting ${records.length} records for ${resourceType} ${resourceId}`);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await namespace.upsertRecords(records as any);

  console.log(`[RAG] Upsert complete for ${resourceType} ${resourceId}`);
}

/**
 * Delete all records for a specific resource
 */
export async function deleteRecords(
  resourceType: ContentType,
  resourceId: string
): Promise<void> {
  const idPrefix = `${resourceType.substring(0, 3)}-${resourceId}`;
  
  console.log(`[RAG] Deleting records with prefix: ${idPrefix}`);
  
  // Note: Pinecone doesn't have a native prefix delete, 
  // we'd need to query and delete by IDs
  // For now, this is a placeholder for future implementation
  console.warn(`[RAG] deleteRecords not fully implemented yet`);
}

// ============================================
// STATUS MANAGEMENT
// ============================================

/**
 * Update file processing status in Supabase
 */
export async function updateFileStatus(
  fileId: string,
  status: FileStatus,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Get current metadata to preserve existing fields
  const { data: currentFile } = await supabase
    .from('files')
    .select('metadata')
    .eq('id', fileId)
    .single();

  const updateData: Record<string, unknown> = {
    processing_status: status,
  };

  if (metadata || currentFile?.metadata) {
    updateData.metadata = {
      ...currentFile?.metadata,
      ...metadata,
    };
  }

  const { error } = await supabase
    .from('files')
    .update(updateData)
    .eq('id', fileId);

  if (error) {
    console.error(`[RAG] Failed to update status for ${fileId}:`, error);
    throw error;
  }

  console.log(`[RAG] Updated ${fileId} status to: ${status}`);
}

/**
 * Get current file metadata from Supabase
 */
export async function getFileMetadata(
  fileId: string
): Promise<Record<string, unknown> | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('files')
    .select('metadata, processing_status, description, file_url, file_name')
    .eq('id', fileId)
    .single();

  if (error) {
    console.error(`[RAG] Failed to get metadata for ${fileId}:`, error);
    return null;
  }

  return {
    ...data.metadata,
    processing_status: data.processing_status,
    description: data.description,
    file_url: data.file_url,
    file_name: data.file_name,
  };
}

// ============================================
// RECORD BUILDERS
// ============================================

/**
 * Build base Pinecone record with common fields
 */
export function buildBaseRecord(
  idPrefix: string,
  resourceId: string,
  resourceType: ContentType,
  companyId: string,
  chunkIndex: number,
  text: string,
  optionalFields?: {
    equipmentId?: string;
    equipmentName?: string;
    workOrderId?: string;
    workOrderTitle?: string;
  }
): PineconeRecord {
  const record: PineconeRecord = {
    _id: `${idPrefix}-${resourceId}-chunk-${chunkIndex}`,
    text,
    company_id: companyId,
    resource_id: resourceId,
    resource_type: resourceType,
    chunk_index: chunkIndex,
    created_at: new Date().toISOString(),
  };

  if (optionalFields?.equipmentId) {
    record.equipment_id = optionalFields.equipmentId;
  }
  if (optionalFields?.equipmentName) {
    record.equipment_name = optionalFields.equipmentName;
  }
  if (optionalFields?.workOrderId) {
    record.work_order_id = optionalFields.workOrderId;
  }
  if (optionalFields?.workOrderTitle) {
    record.work_order_title = optionalFields.workOrderTitle;
  }

  return record;
}
