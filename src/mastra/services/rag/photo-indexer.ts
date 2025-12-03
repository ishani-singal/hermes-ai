/**
 * Photo Indexer
 * 
 * Handles photo indexing operations:
 * - Scene analysis (vision AI)
 * - Text chunking from descriptions
 * - Pinecone upsert
 */

import { parseImage } from '@/lib/parsers/image-parser';
import { 
  chunkText, 
  upsertRecords, 
  updateFileStatus, 
  getFileMetadata,
  buildBaseRecord 
} from './common';
import type { IndexPhotoParams, PineconeRecord } from './types';

/**
 * Process and index a photo
 * 
 * Handles: Vision analysis (if not pre-extracted) → Chunk → Upsert to Pinecone
 */
export async function indexPhoto(params: IndexPhotoParams): Promise<void> {
  const {
    photoId,
    companyId,
    fileUrl,
    content,
    equipmentId,
    equipmentName,
    workOrderId,
    workOrderTitle,
  } = params;

  console.log(`[RAG:Photo] Indexing photo: ${photoId}`);

  try {
    // Get current file state
    const currentMeta = await getFileMetadata(photoId);
    const currentStatus = currentMeta?.processing_status as string;

    // Update status to indexing if not already
    if (currentStatus !== 'indexing') {
      await updateFileStatus(photoId, 'indexing', {
        ...currentMeta,
        processing_phase: 'rag_indexing',
      });
    }

    // Step 1: Get text content - use pre-extracted or analyze now
    let text: string;

    if (content) {
      // Pre-extracted content from vision analysis
      text = content;
      console.log(`[RAG:Photo] Using pre-extracted content (${text.length} characters)`);
    } else if (fileUrl) {
      // Analyze image now
      console.log(`[RAG:Photo] Analyzing image: ${fileUrl}`);
      text = await parseImage(fileUrl);
    } else {
      throw new Error('No content or fileUrl provided for photo indexing');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No description generated from photo');
    }

    // Step 2: Chunk text
    const chunks = await chunkText(text);

    console.log(`[RAG:Photo] Generated ${chunks.length} chunks`);

    // Step 3: Build Pinecone records
    const records: PineconeRecord[] = chunks.map((chunk, idx) => 
      buildBaseRecord(
        'photo',
        photoId,
        'photo',
        companyId,
        idx,
        chunk.text,
        { equipmentId, equipmentName, workOrderId, workOrderTitle }
      )
    );

    // Step 4: Upsert to Pinecone
    await upsertRecords(records, 'photo', photoId);

    // Update status to ready
    await updateFileStatus(photoId, 'ready', {
      ...currentMeta,
      processing_phase: 'complete',
      rag_indexed_at: new Date().toISOString(),
    });

    console.log(`[RAG:Photo] Indexing complete: ${photoId}`);

  } catch (error) {
    console.error(`[RAG:Photo] Error indexing photo ${photoId}:`, error);
    await updateFileStatus(photoId, 'failed', {
      processing_phase: 'indexing_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Run scene analysis on a photo (for bulk uploads)
 * Analyzes the image and updates metadata with description
 */
export async function runPhotoAnalysis(
  photoId: string,
  companyId: string,
  fileUrl: string
): Promise<string> {
  console.log(`[RAG:Photo] Running scene analysis for: ${photoId}`);

  try {
    // Get current metadata
    const currentMeta = await getFileMetadata(photoId);

    // Update status to analyzing
    await updateFileStatus(photoId, 'analyzing', {
      ...currentMeta,
      processing_phase: 'vision_analysis',
      analysis_started_at: new Date().toISOString(),
    });

    // Run vision analysis
    const description = await parseImage(fileUrl);

    if (!description || description.trim().length === 0) {
      throw new Error('No content detected in image');
    }

    console.log(`[RAG:Photo] Scene analysis complete for: ${photoId} (${description.length} chars)`);

    // Update with analysis results
    // Note: We don't update the files.description here - that's done by the upload API
    // We just update metadata to track the analysis
    await updateFileStatus(photoId, 'analyzing', {
      ...currentMeta,
      scene_analysis: description,
      vision_analyzed_at: new Date().toISOString(),
      processing_phase: 'analysis_complete',
    });

    return description;

  } catch (error) {
    console.error(`[RAG:Photo] Scene analysis failed for ${photoId}:`, error);
    
    const currentMeta = await getFileMetadata(photoId);
    await updateFileStatus(photoId, 'failed', {
      ...currentMeta,
      analysis_error: error instanceof Error ? error.message : 'Unknown error',
      processing_phase: 'analysis_failed',
    });
    
    throw error;
  }
}
