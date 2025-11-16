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
import { parsePDF } from './parsers/pdf-parser';
import { parseImage } from './parsers/image-parser';
import { parseVideo } from './parsers/video-parser';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  scope: 'company' | 'equipment';
  fileUrl: string;
}

export interface IndexContentParams {
  type: ContentType;
  resourceId: string;
  companyId: string;
  fileUrl?: string;
  content?: string;  // Pre-extracted text (for chat conversations)
  metadata: Record<string, any>;
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
    scope,
    fileUrl,
  } = params;

  console.log(`[RAG] Indexing document: ${documentId}`);

  try {
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
      
      const records = chunks.map((chunk: any, idx: number) => {
        const baseRecord: Record<string, any> = {
          _id: `doc-${documentId}-chunk-${idx}`,
          text: chunk.text, // Field for serverless inference (default field_map)
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

        return baseRecord;
      });

      // Step 4: Upsert to Pinecone (serverless inference will embed the text)
      console.log(`[RAG] Upserting ${records.length} records to Pinecone`);
      await namespace.upsertRecords(records);

      console.log(`[RAG] Document indexing complete: ${documentId}`);
    } catch (ragError) {
      // Log RAG errors but don't fail the document upload
      console.error(`[RAG] Indexing failed for ${documentId} (document still uploaded):`, ragError);
      // Optionally store this error somewhere for later retry
    }

  } catch (error) {
    console.error(`[RAG] Error processing document ${documentId}:`, error);
    // Note: RAG indexing failures don't affect document upload status
    // Document remains 'uploaded' and available for download
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

  try {
    // Step 1: Extract text based on content type
    let text: string;
    
    if (type === 'document' && fileUrl) {
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
    const records = chunks.map((chunk: any, idx: number) => ({
      _id: `${type}-${resourceId}-chunk-${idx}`,
      text: chunk.text, // Field for serverless inference
      company_id: companyId,
      resource_id: resourceId,
      resource_type: type,
      chunk_index: idx,
      created_at: new Date().toISOString(),
      ...metadata, // Spread additional metadata
    }));

    // Step 4: Upsert to Pinecone (serverless inference will embed the text)
    console.log(`[RAG] Upserting ${records.length} records for ${type}`);
    await namespace.upsertRecords(records);

    console.log(`[RAG] ${type} indexing complete: ${resourceId}`);

  } catch (error) {
    console.error(`[RAG] Error indexing ${type} ${resourceId}:`, error);
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
    console.log(`[RAG] Searching for: "${query.substring(0, 100)}..." (company: ${companyId})`);

    // Build filter for Pinecone query
    const filter: Record<string, any> = {
      company_id: { $eq: companyId },
    };

    if (equipmentId) {
      filter.equipment_id = { $eq: equipmentId };
    }

    if (documentType) {
      filter.document_type = { $eq: documentType };
    }

    // For serverless inference, query with text using search_records endpoint
    // Using searchRecords method which accepts query text directly  
    const searchParams: any = {
      query: {
        topK,
        inputs: { text: query }, // Raw query text - Pinecone will embed it via serverless inference
      },
      fields: ['text', 'document_title', 'document_type', 'page_number', 'resource_id', 'resource_type', 'equipment_id', 'equipment_name'],
    };
    
    // Add filter if there are any conditions
    if (Object.keys(filter).length > 0) {
      searchParams.filter = filter;
    }
    
    const searchResults = await namespace.searchRecords(searchParams);

    console.log(`[RAG] Found ${searchResults.result?.hits?.length ?? 0} results`);

    // Extract and format results from searchRecords response
    const results: SearchResult[] = [];

    for (const hit of searchResults.result?.hits || []) {
      if (!hit.fields) {
        continue;
      }

      const fields = hit.fields as any;

      results.push({
        text: typeof fields.text === 'string' ? fields.text : '',
        documentTitle: fields.document_title,
        documentType: fields.document_type,
        pageNumber: fields.page_number,
        score: hit._score ?? 0,
        resourceId: fields.resource_id,
        resourceType: fields.resource_type,
        equipmentId: fields.equipment_id,
        equipmentName: fields.equipment_name,
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
