/**
 * RAG Search Operations
 * 
 * Semantic search and retrieval from Pinecone
 */

import { namespace } from '@/lib/pinecone/client';
import type { SearchParams, SearchResult, ContentType } from './types';

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

    console.log(`[RAG:Search] Searching for: "${query.substring(0, 100)}..." (company: ${companyId})`);

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
    const searchParams = {
      query: {
        topK,
        inputs: { text: query },
        filter: filter,
      },
      fields: [
        'text',
        'document_title',
        'document_type',
        'page_number',
        'resource_id',
        'resource_type',
        'equipment_id',
        'equipment_name',
        'company_id',
      ],
    };

    const searchResults = await namespace.searchRecords(searchParams);

    console.log(`[RAG:Search] Found ${searchResults.result?.hits?.length ?? 0} results`);

    // Extract and format results
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
    console.error('[RAG:Search] Error searching:', error);
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
