/**
 * Document Analysis Tool for Agent
 * 
 * Enables the AI agent to analyze uploaded documents using PDF parsing and AI summarization.
 * Provides structured summaries and indexes content for RAG.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { parsePDF } from '@/lib/parsers/pdf-parser';
import { summarizeDocument } from '@/lib/parsers/pdf-summarizer';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { contentQueue } from '@/lib/queue/simple-queue';
import type { IndexContentParams } from '@/mastra/services/rag-service';

/**
 * Analyze a document with PDF parsing and AI summarization
 */
export const analyzeDocumentTool = createTool({
  id: 'analyze-document-tool',
  description: `Analyze uploaded documents to extract and summarize their content on-demand.
  
  Use this ONLY when:
  - User explicitly asks to summarize a document ("summarize this", "what's in this document?")
  - User asks specific questions about document content
  - You need to understand document structure before answering questions
  
  DO NOT use this automatically on upload - documents are automatically indexed for search.
  
  The tool will:
  - Extract full text from the PDF
  - Generate an AI-powered structured summary (type, topics, equipment, safety warnings)
  - Save the summary to the database for quick reference
  - Return the summary to help you understand and reference the document
  
  Note: This is a costly operation. Only call when user specifically requests document analysis.`,
  
  inputSchema: z.object({
    documentId: z.string().describe('The UUID or display_id of the document to analyze (e.g., "DOC-ACME-0001" or a UUID)'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    summary: z.string().optional(),
    documentId: z.string(),
    displayId: z.string().optional(),
    documentTitle: z.string().optional(),
    error: z.string().optional(),
    alreadyAnalyzed: z.boolean().optional(),
  }),
  
  execute: async ({ context, runtimeContext }) => {
    const { documentId } = context;
    
    console.log('[AnalyzeDocumentTool] Analyzing document:', documentId);
    
    // Get company ID from runtime context
    let companyId = runtimeContext.get('companyId') as string;
    
    if (!companyId) {
      console.warn('[AnalyzeDocumentTool] companyId not found in runtimeContext');
      const ctx = runtimeContext as unknown as { companyId?: string; contextData?: { companyId?: string } };
      companyId = ctx.companyId || ctx.contextData?.companyId || '';
    }
    
    if (!companyId) {
      console.error('[AnalyzeDocumentTool] No company ID found');
      return {
        success: false,
        documentId,
        error: 'Company ID not found in context',
      };
    }
    
    console.log('[AnalyzeDocumentTool] Using company ID:', companyId);
    
    try {
      const supabase = createServiceRoleClient();
      
      // Fetch document from database (support both UUID and display_id)
      let query = supabase
        .from('files')
        .select(`
          id, file_url, file_name, description, processing_status, bucket_id, metadata,
          equipment_files:equipment_files (
            equipment:equipment (id, name)
          ),
          work_order_files:work_order_files (
            work_order:work_orders (id, title)
          )
        `)
        .eq('company_id', companyId)
        .eq('bucket_id', 'documents');
      
      // Try to match by UUID first, then by display_id in metadata
      if (documentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's a UUID
        query = query.eq('id', documentId);
      } else {
        // It's likely a display_id like DOC-XXX-0001
        query = query.eq('metadata->>display_id', documentId);
      }
      
      const { data: document, error: fetchError } = await query.maybeSingle();
      
      if (fetchError || !document) {
        console.error('[AnalyzeDocumentTool] Document not found:', fetchError);
        return {
          success: false,
          documentId,
          error: 'Document not found or does not belong to your company',
        };
      }
      
      const displayId = document.metadata?.display_id || undefined;
      const documentTitle = document.description || document.file_name;
      
      // Check if already analyzed
      if (document.metadata?.ai_summary) {
        console.log('[AnalyzeDocumentTool] Document already analyzed, returning existing summary');
        return {
          success: true,
          documentId: document.id,
          displayId,
          documentTitle,
          summary: document.metadata.ai_summary,
          alreadyAnalyzed: true,
        };
      }
      
      // Update status to 'processing' (analysis phase)
      await supabase
        .from('files')
        .update({ 
          processing_status: 'processing',
          metadata: {
            ...document.metadata,
            processing_phase: 'document_analysis',
          }
        })
        .eq('id', document.id);
      
      console.log('[AnalyzeDocumentTool] Parsing PDF from:', document.file_url);
      
      // Step 1: Parse PDF to extract text
      const fullText = await parsePDF(document.file_url);
      
      if (!fullText || fullText.trim().length === 0) {
        console.warn('[AnalyzeDocumentTool] No text extracted from PDF');
        await supabase
          .from('files')
          .update({ processing_status: 'failed' })
          .eq('id', document.id);
        
        return {
          success: false,
          documentId: document.id,
          displayId,
          documentTitle,
          error: 'No text content detected in PDF',
        };
      }
      
      console.log('[AnalyzeDocumentTool] Generating AI summary');
      
      // Step 2: Generate AI summary
      const summary = await summarizeDocument(fullText, document.file_name);
      
      // Save summary and update status
      const { error: updateError } = await supabase
        .from('files')
        .update({
          processing_status: 'processing', // Keep as processing, RAG will complete it
          metadata: {
            ...document.metadata,
            processing_phase: 'analysis_complete',
            ai_summary: summary,
            full_text_length: fullText.length,
            analyzed_at: new Date().toISOString(),
          },
        })
        .eq('id', document.id);
      
      if (updateError) {
        console.error('[AnalyzeDocumentTool] Failed to update document:', updateError);
        return {
          success: false,
          documentId: document.id,
          displayId,
          documentTitle,
          error: 'Failed to save analysis results',
        };
      }
      
      console.log('[AnalyzeDocumentTool] Analysis completed successfully');
      
      return {
        success: true,
        documentId: document.id,
        displayId,
        documentTitle,
        summary,
        alreadyAnalyzed: false,
      };
      
    } catch (error) {
      console.error('[AnalyzeDocumentTool] Error analyzing document:', error);
      return {
        success: false,
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});

/**
 * Patch Document Tool
 * Updates document metadata to link it to equipment or work orders
 */
export const patchDocumentTool = createTool({
  id: 'patch-document-tool',
  description: `Update document metadata to link it to equipment or work orders.
  
  Use this when:
  - You've created a work order and need to link a related document to it
  - You need to link/unlink a document from equipment
  - You need to link/unlink a document from a work order
  - You want to update link type (reference/evidence/procedure)
  
  Returns:
  - Updated document details
  - Confirmation of links applied`,
  
  inputSchema: z.object({
    documentId: z.string().describe('The document UUID or display_id to update'),
    equipment_id: z.string().optional().describe('Equipment display ID or UUID to link. Pass null to remove equipment link.'),
    work_order_id: z.string().optional().describe('Work order display ID or UUID to link. Pass null to remove work order link.'),
    link_type: z.enum(['before', 'after', 'evidence', 'reference', 'procedure', 'guide', 'other']).optional().describe('Type of link (default: reference)'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    documentId: z.string(),
    displayId: z.string().optional(),
    linkedEquipment: z.boolean().optional(),
    linkedWorkOrder: z.boolean().optional(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, runtimeContext }) => {
    const { documentId, equipment_id, work_order_id, link_type } = context;
    
    if (!documentId) {
      return { success: false, documentId: '', error: 'Document ID is required' };
    }
    
    console.log('[PatchDocumentTool] Updating document:', documentId, { equipment_id, work_order_id, link_type });
    
    try {
      const BASE_URL = process.env.INTERNAL_API_BASE_URL || 'http://localhost:3000';
      const cookieValue = runtimeContext.get('cookie');
      const cookieHeader = cookieValue ? String(cookieValue) : '';
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (cookieHeader) {
        headers['cookie'] = cookieHeader;
      }
      
      const patchPayload: Record<string, unknown> = {};
      
      if (equipment_id !== undefined) {
        patchPayload.equipment_id = equipment_id;
        if (equipment_id) {
          patchPayload.link_type = link_type || 'reference';
        }
      }
      
      if (work_order_id !== undefined) {
        patchPayload.work_order_id = work_order_id;
        if (work_order_id) {
          patchPayload.link_type = link_type || 'reference';
        }
      }
      
      const response = await fetch(
        `${BASE_URL}/api/documents/${documentId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(patchPayload),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PatchDocumentTool] PATCH failed:', errorText);
        return {
          success: false,
          documentId,
          error: errorText || `HTTP ${response.status}`,
        };
      }
      
      const result = await response.json();
      
      return {
        success: true,
        documentId: result.data?.id || documentId,
        displayId: result.data?.display_id || undefined,
        linkedEquipment: !!equipment_id,
        linkedWorkOrder: !!work_order_id,
      };
      
    } catch (error) {
      console.error('[PatchDocumentTool] Error updating document:', error);
      return {
        success: false,
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
