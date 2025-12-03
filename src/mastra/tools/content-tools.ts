/**
 * Content Search Tool for RAG
 * 
 * Enables the AI agent to search for relevant documentation and analyzed photos
 * using semantic search in Pinecone vector database.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { search, formatContext } from '@/mastra/services/rag';

/**
 * Search for relevant documentation and photos
 */
export const searchContentTool = createTool({
  id: 'search-content-tool',
  description: `Search for relevant documentation, manuals, troubleshooting guides, and analyzed photos. 
  Use this when the user asks about:
  - How to perform a task
  - Troubleshooting issues or errors
  - Equipment specifications
  - Maintenance procedures
  - Safety guidelines
  - Repair instructions
  - Previously uploaded photos and their descriptions
  - Visual information about equipment
  
  The search returns both documents (manuals, SOPs) and photos (with AI-generated descriptions).
  Do NOT use this for simple greetings or confirmations.`,
  
  inputSchema: z.object({
    query: z.string().describe('The search query - what to look for in documentation'),
    equipmentId: z.string().optional().describe('Optional: Filter by equipment UUID or display ID (e.g., EQ-ACME-PUMP-001)'),
    documentType: z.enum(['manual', 'safety', 'sop', 'troubleshooting', 'other']).optional().describe('Optional: Filter by document type'),
    topK: z.number().int().min(1).max(5).default(3).optional().describe('Number of results to return (default: 3)'),
  }),
  
  outputSchema: z.object({
    results: z.array(z.object({
      text: z.string(),
      documentTitle: z.string().optional(),
      documentType: z.string().optional(),
      pageNumber: z.number().optional(),
      score: z.number(),
      resourceId: z.string(),
      resourceType: z.string(),
      equipmentId: z.string().optional(),
      equipmentName: z.string().optional(),
    })),
    formattedContext: z.string(),
    citations: z.array(z.string()),
    count: z.number(),
  }),
  
  execute: async ({ context, runtimeContext }) => {
    const { query, equipmentId, documentType, topK } = context;
    
    console.log('[SearchDocsTool] Tool invoked with query:', query);
    console.log('[SearchDocsTool] Equipment ID:', equipmentId);
    console.log('[SearchDocsTool] Document Type:', documentType);
    console.log('[SearchDocsTool] TopK:', topK);
    console.log('[SearchDocsTool] Runtime Context keys:', Array.from((runtimeContext as unknown as Map<string, unknown>).entries?.() || []).map((e: [string, unknown]) => e[0]));
    
    let companyId = runtimeContext.get('companyId') as string;
    
    // Fallback: try to extract companyId from other potential locations
    if (!companyId) {
      console.warn('[SearchDocsTool] companyId not found in runtimeContext, checking alternatives...');
      const ctx = runtimeContext as unknown as { companyId?: string; contextData?: { companyId?: string } };
      companyId = ctx.companyId || ctx.contextData?.companyId || '';
    }
    
    if (!companyId) {
      console.error('[SearchDocsTool] No company ID found in context');
      return {
        results: [],
        formattedContext: 'Error: Company ID not found in context. Cannot perform search.',
        citations: [],
        count: 0,
      };
    }
    
    console.log('[SearchDocsTool] Using company ID:', companyId);
    
    try {
      // If equipmentId is a display ID, we need to resolve it to UUID
      const resolvedEquipmentId = equipmentId;
      if (equipmentId && equipmentId.startsWith('EQ-')) {
        // This would require a supabase call to resolve display_id -> id
        // For now, we'll pass it as-is and let the search handle it
        console.log('[SearchDocsTool] Equipment display ID provided, may need resolution');
      }

      console.log('[SearchDocsTool] Calling rag-service.search with:', { query, companyId, equipmentId: resolvedEquipmentId, documentType, topK: topK ?? 3 });
      const results = await search({
        query,
        companyId,
        equipmentId: resolvedEquipmentId,
        documentType,
        topK: topK ?? 3,
      });

      console.log('[SearchDocsTool] Search completed, found', results.length, 'results');
      const formattedContext = formatContext(results);
      const citations = results.map((r, idx) => 
        `[${idx + 1}] ${r.documentTitle}, Page ${r.pageNumber}`
      );

      return {
        results,
        formattedContext,
        citations,
        count: results.length,
      };
    } catch (error) {
      console.error('[SearchDocsTool] Error searching documents:', error);
      return {
        results: [],
        formattedContext: `Error searching documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        citations: [],
        count: 0,
      };
    }
  },
});
