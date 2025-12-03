/**
 * Document Indexer
 * 
 * Handles document (PDF) indexing operations:
 * - AI analysis (summary, equipment extraction)
 * - Text extraction and chunking
 * - Pinecone upsert
 */

import { parsePDF } from '@/lib/parsers/pdf-parser';
import { analyzeDocumentWithExtraction } from '@/lib/parsers/pdf-summarizer';
import { 
  chunkText, 
  upsertRecords, 
  updateFileStatus, 
  getFileMetadata,
  buildBaseRecord 
} from './common';
import type { IndexDocumentParams, PineconeRecord } from './types';

/**
 * Process and index a document (PDF)
 * 
 * This is the main entry point called by the queue worker.
 * Handles: Parse → Chunk → Upsert to Pinecone
 * 
 * Note: Document should already be in 'indexing' status when this is called.
 * AI analysis (summary, equipment extraction) happens during upload or via runDocumentAnalysis.
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

  console.log(`[RAG:Document] Indexing document: ${documentId}`);

  try {
    // Ensure status is 'indexing'
    await updateFileStatus(documentId, 'indexing', {
      processing_phase: 'rag_chunking',
    });

    // Step 1: Parse PDF to extract text
    console.log(`[RAG:Document] Parsing PDF from: ${fileUrl}`);
    const text = await parsePDF(fileUrl);

    if (!text || text.trim().length === 0) {
      throw new Error('No text extracted from PDF');
    }

    // Step 2: Chunk text
    console.log(`[RAG:Document] Chunking text (${text.length} characters)`);
    const chunks = await chunkText(text);

    if (chunks.length === 0) {
      throw new Error('No chunks generated from text');
    }

    console.log(`[RAG:Document] Generated ${chunks.length} chunks`);

    // Step 3: Build Pinecone records
    const records: PineconeRecord[] = chunks.map((chunk, idx) => {
      const record = buildBaseRecord(
        'doc',
        documentId,
        'document',
        companyId,
        idx,
        chunk.text,
        { equipmentId, equipmentName, workOrderId, workOrderTitle }
      );

      // Add document-specific fields
      record.document_title = documentTitle;
      record.document_type = documentType;
      record.scope = scope;

      return record;
    });

    // Step 4: Upsert to Pinecone
    try {
      await upsertRecords(records, 'document', documentId);

      // Get current metadata to preserve analysis results
      const currentMeta = await getFileMetadata(documentId);

      // Update status to ready
      await updateFileStatus(documentId, 'ready', {
        ...currentMeta,
        processing_phase: 'complete',
        rag_indexed_at: new Date().toISOString(),
        chunk_count: chunks.length,
      });

      console.log(`[RAG:Document] Indexing complete: ${documentId}`);

    } catch (ragError) {
      // Log RAG errors but preserve the document
      console.error(`[RAG:Document] Indexing failed for ${documentId}:`, ragError);

      const currentMeta = await getFileMetadata(documentId);
      await updateFileStatus(documentId, 'failed', {
        ...currentMeta,
        processing_phase: 'rag_failed',
        rag_error: ragError instanceof Error ? ragError.message : 'Unknown error',
      });
    }

  } catch (error) {
    console.error(`[RAG:Document] Error processing document ${documentId}:`, error);
    await updateFileStatus(documentId, 'failed', {
      processing_phase: 'processing_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Run AI analysis on a document (for bulk uploads)
 * Extracts summary and equipment info, updates metadata
 */
export async function runDocumentAnalysis(
  documentId: string,
  companyId: string,
  fileUrl: string,
  fileName: string
): Promise<void> {
  console.log(`[RAG:Document] Running AI analysis for: ${documentId}`);

  try {
    // Get current metadata
    const currentMeta = await getFileMetadata(documentId);

    // Update status to analyzing
    await updateFileStatus(documentId, 'analyzing', {
      ...currentMeta,
      processing_phase: 'ai_analysis',
      analysis_started_at: new Date().toISOString(),
    });

    // Parse PDF and analyze
    const pdfText = await parsePDF(fileUrl);
    const analysisResult = await analyzeDocumentWithExtraction(pdfText, fileName);

    console.log(`[RAG:Document] AI analysis complete for: ${documentId}`, {
      hasEquipment: !!analysisResult.extractedEquipment,
      confidence: analysisResult.extractedEquipment?.confidence,
    });

    // Update with analysis results (status will be set to 'indexing' by indexDocument)
    await updateFileStatus(documentId, 'analyzing', {
      ...currentMeta,
      document_type: analysisResult.documentType,
      ai_summary: analysisResult.summary,
      extracted_equipment_info: analysisResult.extractedEquipment,
      was_smart_truncated: analysisResult.wasSmartTruncated,
      analysis_completed_at: new Date().toISOString(),
      processing_phase: 'analysis_complete',
    });

  } catch (error) {
    console.error(`[RAG:Document] AI analysis failed for ${documentId}:`, error);
    
    // Don't throw - let indexing continue even if analysis fails
    const currentMeta = await getFileMetadata(documentId);
    await updateFileStatus(documentId, 'analyzing', {
      ...currentMeta,
      analysis_error: error instanceof Error ? error.message : 'Unknown error',
      processing_phase: 'analysis_failed',
    });
  }
}
