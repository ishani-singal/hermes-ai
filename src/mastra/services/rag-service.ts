/**
 * RAG (Retrieval-Augmented Generation) Service
 * 
 * Unified service for all RAG operations:
 * - INDEXING: Parse, chunk, embed, and store content in Pinecone
 * - RETRIEVAL: Search and retrieve relevant context from Pinecone
 * 
 * Supports multiple content types: documents (PDF), photos, videos, chat conversations
 */

import { MDocument } from '@mastra/rag';
import { namespace } from '@/lib/pinecone/client';
import { parsePDF } from '@/lib/parsers/pdf-parser';
import { parseImage } from '@/lib/parsers/image-parser';
import { parseVideo } from '@/lib/parsers/video-parser';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ============================================
// TYPES
// ============================================

export type ContentType = 'document' | 'photo' | 'video' | 'chat';

export interface IndexDocumentParams {
  documentId: string;
  companyId: string;
  documentTitle: string;
  documentType: string;
  equipmentId?: string;
  equipmentName?: string;
  workOrderId?: string;
  workOrderTitle?: string;
  scope: 'company' | 'equipment';
  fileUrl: string;
}

export interface IndexContentParams {
  type: ContentType;
  resourceId: string;
  companyId: string;
  fileUrl?: string;
  content?: string;  // Pre-extracted text (for chat conversations)
  metadata: Record<string, unknown>;
}

export interface SearchParams {
  query: string;
  companyId: string;
  equipmentId?: string;
  documentType?: string;
  topK?: number;
}

export interface SearchResult {
  text: string;
  documentTitle?: string;
  documentType?: string;
  pageNumber?: number;
  score: number;
  resourceId: string;
  resourceType: ContentType;
  equipmentId?: string;
  equipmentName?: string;
}

// ============================================
// INDEXING OPERATIONS (Write to Pinecone)
// ============================================

/**
 * Process and index a document (PDF)
 * 
 * This is the main entry point called by the queue worker.
 * Handles: Download → Parse → Chunk → Upsert to Pinecone
 */
export async function indexDocument(params: IndexDocumentParams): Promise<void> {
  const {
    documentId,
    companyId,
    documentTitle,
    documentType,
    equipmentId,
    equipmentName,
    workOrderId,
    workOrderTitle,
    scope,
    fileUrl,
  } = params;

  console.log(`[RAG] Indexing document: ${documentId}`);
  const supabase = createServiceRoleClient();

  try {
    // Update status to processing
    await supabase.from('files').update({ processing_status: 'processing' }).eq('id', documentId);

    // Step 1: Parse PDF to extract text
    console.log(`[RAG] Parsing PDF from: ${fileUrl}`);
    const text = await parsePDF(fileUrl);

    // Step 2: Chunk text using Mastra
    console.log(`[RAG] Chunking text (${text.length} characters)`);
    const doc = MDocument.fromText(text);
    const chunks = await doc.chunk({
      strategy: 'recursive',
      size: 1000,
      overlap: 100,
    });

    if (chunks.length === 0) {
      throw new Error('No chunks generated from text');
    }

    console.log(`[RAG] Generated ${chunks.length} chunks`);

    // Step 3: Prepare records for Pinecone (with raw text for serverless inference)
    // From this point, failures don't affect document upload status
    try {
      console.log(`[RAG] Preparing ${chunks.length} records for Pinecone`);
      
      // Validate companyId before indexing (required for multi-tenant security)
      if (!companyId || companyId.trim() === '') {
        throw new Error('company_id is required for indexing documents');
      }

      const records = chunks.map((chunk: { text: string }, idx: number) => {
        const baseRecord: Record<string, string | number> = {
          _id: `doc-${documentId}-chunk-${idx}`,
          text: chunk.text,
          company_id: companyId,
          resource_id: documentId,
          resource_type: 'document' as ContentType,
          document_title: documentTitle,
          document_type: documentType,
          scope,
          chunk_index: idx,
          created_at: new Date().toISOString(),
        };

        if (equipmentId) {
          baseRecord.equipment_id = equipmentId;
        }
        if (equipmentName) {
          baseRecord.equipment_name = equipmentName;
        }
        if (workOrderId) {
          baseRecord.work_order_id = workOrderId;
        }
        if (workOrderTitle) {
          baseRecord.work_order_title = workOrderTitle;
        }

        return baseRecord;
      });

      // Step 4: Upsert to Pinecone (serverless inference will embed the text)
      console.log(`[RAG] Upserting ${records.length} records to Pinecone`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await namespace.upsertRecords(records as any);

      console.log(`[RAG] Document indexing complete: ${documentId}`);
      
      // Update status to ready
      await supabase.from('files').update({ processing_status: 'ready' }).eq('id', documentId);
    } catch (ragError) {
      // Log RAG errors but don't fail the document upload
      console.error(`[RAG] Indexing failed for ${documentId} (document still uploaded):`, ragError);
      // Optionally store this error somewhere for later retry
      await supabase.from('files').update({ processing_status: 'failed' }).eq('id', documentId);
    }

  } catch (error) {
    console.error(`[RAG] Error processing document ${documentId}:`, error);
    // Note: RAG indexing failures don't affect document upload status
    // Document remains 'uploaded' and available for download
    await supabase.from('files').update({ processing_status: 'failed' }).eq('id', documentId);
    throw error;
  }
}

/**
 * Index arbitrary content (photos, videos, chat conversations)
 * 
 * Generic function for indexing different content types.
 * Can be extended in the future.
 */
export async function indexContent(params: IndexContentParams): Promise<void> {
  const { type, resourceId, companyId, fileUrl, content, metadata } = params;

  console.log(`[RAG] Indexing ${type}: ${resourceId}`);
  const supabase = createServiceRoleClient();

  try {
    // Update status to processing (if not already set by vision analysis)
    // For photos, this may already be 'processing' from vision analysis
    const { data: currentFile } = await supabase
      .from('files')
      .select('processing_status, metadata')
      .eq('id', resourceId)
      .single();
    
    if (currentFile?.processing_status !== 'processing') {
      await supabase.from('files')
        .update({ 
          processing_status: 'processing',
          metadata: {
            ...currentFile?.metadata,
            processing_phase: 'rag_indexing',
          }
        })
        .eq('id', resourceId);
    } else {
      // Already processing (e.g., from vision analysis), just update phase
      await supabase.from('files')
        .update({ 
          metadata: {
            ...currentFile?.metadata,
            processing_phase: 'rag_indexing',
          }
        })
        .eq('id', resourceId);
    }

    // Step 1: Extract text based on content type
    let text: string;
    
    if (content) {
      // Pre-extracted content (e.g., photo descriptions from vision analysis)
      text = content;
      console.log(`[RAG] Using pre-extracted content (${text.length} characters)`);
    } else if (type === 'document' && fileUrl) {
      text = await parsePDF(fileUrl);
    } else if (type === 'photo' && fileUrl) {
      text = await parseImage(fileUrl);
    } else if (type === 'video' && fileUrl) {
      text = await parseVideo(fileUrl);
    } else if (type === 'chat' && content) {
      text = content;
    } else {
      throw new Error(`Invalid content type or missing content: ${type}`);
    }

    // Step 2: Chunk using Mastra
    const doc = MDocument.fromText(text);
    const chunks = await doc.chunk({
      strategy: 'recursive',
      size: 1000,
      overlap: 100,
    });

    console.log(`[RAG] Generated ${chunks.length} chunks for ${type}`);

    // Step 3: Prepare records with raw text for serverless inference
    if (!companyId || companyId.trim() === '') {
      throw new Error('company_id is required for indexing content');
    }

    const records = chunks.map((chunk: { text: string }, idx: number) => ({
      _id: `${type}-${resourceId}-chunk-${idx}`,
      text: chunk.text,
      company_id: companyId,
      resource_id: resourceId,
      resource_type: type,
      chunk_index: idx,
      created_at: new Date().toISOString(),
      ...metadata,
    }));

    // Step 4: Upsert to Pinecone (serverless inference will embed the text)
    console.log(`[RAG] Upserting ${records.length} records for ${type}`);
    await namespace.upsertRecords(records);

    console.log(`[RAG] ${type} indexing complete: ${resourceId}`);
    
    // Update status to ready and mark processing complete
    await supabase.from('files')
      .update({ 
        processing_status: 'ready',
        metadata: {
          ...currentFile?.metadata,
          processing_phase: 'complete',
          rag_indexed_at: new Date().toISOString(),
        }
      })
      .eq('id', resourceId);

  } catch (error) {
    console.error(`[RAG] Error indexing ${type} ${resourceId}:`, error);
    await supabase.from('files').update({ processing_status: 'failed' }).eq('id', resourceId);
    throw error;
  }
}

// ============================================
// RETRIEVAL OPERATIONS (Read from Pinecone)
// ============================================

/**
 * Check if query needs RAG search (skip greetings, confirmations)
 */
export function needsRAGSearch(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  // Skip simple greetings and confirmations
  const skipPatterns = [
    /^(hi|hello|hey|thanks|thank you|okay|ok|yes|no|sure)$/,
    /^(good morning|good afternoon|good evening)$/,
    /^(how are you|what's up|how's it going)$/,
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(lowerQuery)) {
      return false;
    }
  }

  // Trigger RAG for technical questions (keywords suggest need for documentation)
  const technicalKeywords = [
    'how to',
    'troubleshoot',
    'error',
    'manual',
    'guide',
    'procedure',
    'maintenance',
    'repair',
    'fix',
    'problem',
    'issue',
    'specification',
    'install',
    'configure',
  ];

  for (const keyword of technicalKeywords) {
    if (lowerQuery.includes(keyword)) {
      return true;
    }
  }

  // Default: Use RAG if query is long enough (likely a question)
  return query.length > 20;
}

/**
 * Search for relevant content using semantic search
 */
export async function search(params: SearchParams): Promise<SearchResult[]> {
  const { query, companyId, equipmentId, documentType, topK = 3 } = params;

  try {
    // Validate companyId is present (required for multi-tenant security)
    if (!companyId || companyId.trim() === '') {
      throw new Error('[RAG Security] company_id is required for all search operations');
    }

    console.log(`[RAG] Searching for: "${query.substring(0, 100)}..." (company: ${companyId})`);

    // Build filter for Pinecone query - company_id is always required
    const filter: Record<string, { $eq: string }> = {
      company_id: { $eq: companyId },
    };

    if (equipmentId) {
      filter.equipment_id = { $eq: equipmentId };
    }

    if (documentType) {
      filter.document_type = { $eq: documentType };
    }

    // For serverless inference, filter must be inside the query object
    const searchParams: {
      query: { 
        topK: number; 
        inputs: { text: string };
        filter: Record<string, { $eq: string }>;
      };
      fields: string[];
    } = {
      query: {
        topK,
        inputs: { text: query },
        filter: filter,
      },
      fields: ['text', 'document_title', 'document_type', 'page_number', 'resource_id', 'resource_type', 'equipment_id', 'equipment_name', 'company_id'],
    };
    
    const searchResults = await namespace.searchRecords(searchParams);

    console.log(`[RAG] Found ${searchResults.result?.hits?.length ?? 0} results`);

    // Extract and format results from searchRecords response
    const results: SearchResult[] = [];

    for (const hit of searchResults.result?.hits || []) {
      if (!hit.fields) {
        continue;
      }

      const fields = hit.fields as Record<string, unknown>;

      // Verify company_id matches (defense in depth)
      const resultCompanyId = fields.company_id as string;
      if (resultCompanyId && resultCompanyId !== companyId) {
        console.error(`[RAG Security] CRITICAL: Result company_id mismatch! Expected: ${companyId}, Got: ${resultCompanyId}`);
        continue;
      }

      results.push({
        text: typeof fields.text === 'string' ? fields.text : '',
        documentTitle: typeof fields.document_title === 'string' ? fields.document_title : undefined,
        documentType: typeof fields.document_type === 'string' ? fields.document_type : undefined,
        pageNumber: typeof fields.page_number === 'number' ? fields.page_number : undefined,
        score: hit._score ?? 0,
        resourceId: typeof fields.resource_id === 'string' ? fields.resource_id : '',
        resourceType: (typeof fields.resource_type === 'string' ? fields.resource_type : 'document') as ContentType,
        equipmentId: typeof fields.equipment_id === 'string' ? fields.equipment_id : undefined,
        equipmentName: typeof fields.equipment_name === 'string' ? fields.equipment_name : undefined,
      });
    }

    return results;

  } catch (error) {
    console.error('[RAG] Error searching:', error);
    throw new Error(`Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Format search results for AI context
 */
export function formatContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const contextParts = results.map((result, idx) => {
    const source = result.documentTitle 
      ? `${result.documentTitle}${result.pageNumber ? `, Page ${result.pageNumber}` : ''}`
      : `${result.resourceType} ${result.resourceId}`;
    
    return `[Document ${idx + 1}: ${source}]
${result.text}`;
  });

  return `\nRelevant Documentation:\n${contextParts.join('\n\n')}`;
}

/**
 * Extract citations from search results
 */
export function extractCitations(results: SearchResult[]): string[] {
  return results.map((result, idx) => {
    const source = result.documentTitle 
      ? `${result.documentTitle}${result.pageNumber ? `, Page ${result.pageNumber}` : ''}`
      : `${result.resourceType} ${result.resourceId}`;
    
    return `[${idx + 1}] ${source}`;
  });
}
