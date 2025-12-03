/**
 * RAG Service - Main Entry Point
 * 
 * Unified service for all RAG operations:
 * - INDEXING: Parse, chunk, embed, and store content in Pinecone
 * - RETRIEVAL: Search and retrieve relevant context from Pinecone
 * 
 * This module re-exports all public APIs and provides the main router function.
 */

// Re-export types
export type {
  ContentType,
  FileStatus,
  IndexDocumentParams,
  IndexPhotoParams,
  IndexContentParams,
  SearchParams,
  SearchResult,
  PineconeRecord,
  DocumentAnalysisResult,
  PhotoAnalysisResult,
} from './types';

// Re-export document operations
export { indexDocument, runDocumentAnalysis } from './document-indexer';

// Re-export photo operations
export { indexPhoto, runPhotoAnalysis } from './photo-indexer';

// Re-export search operations
export { search, needsRAGSearch, formatContext, extractCitations } from './search';

// Re-export common utilities (for advanced use cases)
export { 
  chunkText, 
  updateFileStatus, 
  getFileMetadata 
} from './common';

// Import for router function
import { indexDocument, runDocumentAnalysis } from './document-indexer';
import { indexPhoto, runPhotoAnalysis } from './photo-indexer';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { IndexContentParams } from './types';

/**
 * Index arbitrary content (photos, videos, chat conversations, documents)
 * 
 * ROUTER FUNCTION: Dispatches to specialized indexing functions based on content type.
 * For bulk uploads, also handles AI analysis before indexing.
 */
export async function indexContent(params: IndexContentParams): Promise<void> {
  const { 
    type, 
    resourceId, 
    companyId, 
    fileUrl, 
    content, 
    metadata, 
    documentTitle, 
    documentType, 
    scope 
  } = params;

  // Check if this resource needs AI analysis first (bulk upload case)
  const needsAnalysis = metadata.needs_analysis === true;

  switch (type) {
    case 'document':
      if (!fileUrl) throw new Error('fileUrl is required for document indexing');

      // For bulk uploads, run analysis first
      if (needsAnalysis) {
        await runDocumentAnalysis(resourceId, companyId, fileUrl, documentTitle || 'Untitled');
      }

      return indexDocument({
        documentId: resourceId,
        companyId,
        documentTitle: documentTitle || (metadata.document_title as string) || 'Untitled',
        documentType: documentType || (metadata.document_type as string) || 'other',
        equipmentId: metadata.equipment_id as string | undefined,
        equipmentName: metadata.equipment_name as string | undefined,
        workOrderId: metadata.work_order_id as string | undefined,
        workOrderTitle: metadata.work_order_title as string | undefined,
        scope: scope || (metadata.scope as 'company' | 'equipment') || 'company',
        fileUrl,
      });

    case 'photo':
      if (!fileUrl && !content) throw new Error('fileUrl or content is required for photo indexing');

      // For bulk uploads, run scene analysis first
      let photoContent = content;
      if (needsAnalysis && fileUrl) {
        // Run scene analysis and get the description
        photoContent = await runPhotoAnalysis(resourceId, companyId, fileUrl);
        
        // Also update the files.description field
        const supabase = createServiceRoleClient();
        await supabase
          .from('files')
          .update({ description: photoContent })
          .eq('id', resourceId);
      }

      return indexPhoto({
        photoId: resourceId,
        companyId,
        fileUrl: fileUrl || '',
        content: photoContent,
        equipmentId: metadata.equipment_id as string | undefined,
        equipmentName: metadata.equipment_name as string | undefined,
        workOrderId: metadata.work_order_id as string | undefined,
        workOrderTitle: metadata.work_order_title as string | undefined,
      });

    case 'video':
      // TODO: Implement video indexing when needed
      throw new Error('Video indexing not yet implemented');

    case 'chat':
      // TODO: Implement chat indexing when needed
      throw new Error('Chat indexing not yet implemented');

    default:
      throw new Error(`Unknown content type: ${type}`);
  }
}
