/**
 * Photo Analysis Tool for Agent
 * 
 * Enables the AI agent to analyze photos using Gemini Vision.
 * Extracts technical descriptions for maintenance context.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { parseImage } from '@/lib/parsers/image-parser';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { contentQueue } from '@/lib/queue/simple-queue';
import type { IndexContentParams } from '@/mastra/services/rag-service';

/**
 * Analyze a photo with Gemini Vision
 */
export const analyzePhotoTool = createTool({
  id: 'analyze-photo-tool',
  description: `Analyze equipment photos to understand what's visible, extract text, and assess condition.
  
  Use this when:
  - User uploads a photo and you need to describe what's in it
  - User asks "what's in this photo?" or "analyze this image"
  - You need to extract serial numbers, labels, or gauge readings from a photo
  - You need to assess equipment condition, damage, or issues
  
  The tool will:
  - Provide a detailed technical description
  - Extract any visible text (serial numbers, model numbers, labels)
  - Identify damage indicators (rust, leaks, cracks, wear)
  - Note gauge readings and measurements
  - Save the description to the database for future reference`,
  
  inputSchema: z.object({
    photoId: z.string().describe('The UUID or display_id of the photo to analyze (e.g., "PHOTO-ACME-0001" or a UUID)'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    description: z.string().optional(),
    photoId: z.string(),
    displayId: z.string().optional(),
    error: z.string().optional(),
    alreadyAnalyzed: z.boolean().optional(),
  }),
  
  execute: async ({ context, runtimeContext }) => {
    const { photoId } = context;
    
    console.log('[AnalyzePhotoTool] Analyzing photo:', photoId);
    
    // Get company ID from runtime context
    let companyId = runtimeContext.get('companyId') as string;
    
    if (!companyId) {
      console.warn('[AnalyzePhotoTool] companyId not found in runtimeContext');
      const ctx = runtimeContext as unknown as { companyId?: string; contextData?: { companyId?: string } };
      companyId = ctx.companyId || ctx.contextData?.companyId || '';
    }
    
    if (!companyId) {
      console.error('[AnalyzePhotoTool] No company ID found');
      return {
        success: false,
        photoId,
        error: 'Company ID not found in context',
      };
    }
    
    console.log('[AnalyzePhotoTool] Using company ID:', companyId);
    
    try {
      const supabase = createServiceRoleClient();
      
      // Fetch photo from database (support both UUID and display_id)
      // Note: display_id is stored in metadata JSONB field
      let query = supabase
        .from('files')
        .select(`
          id, file_url, description, processing_status, bucket_id, metadata,
          equipment_files:equipment_files (
            equipment:equipment (id, name)
          ),
          work_order_files:work_order_files (
            work_order:work_orders (id, title)
          )
        `)
        .eq('company_id', companyId)
        .eq('bucket_id', 'photos');
      
      // Try to match by UUID first, then by display_id in metadata
      if (photoId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's a UUID
        query = query.eq('id', photoId);
      } else {
        // It's likely a display_id like PHOTO-XXX-0001
        query = query.eq('metadata->>display_id', photoId);
      }
      
      const { data: photo, error: fetchError } = await query.maybeSingle();
      
      if (fetchError || !photo) {
        console.error('[AnalyzePhotoTool] Photo not found:', fetchError);
        return {
          success: false,
          photoId,
          error: 'Photo not found or does not belong to your company',
        };
      }
      
      // Check if already analyzed (avoid duplicate vision API calls)
      if (photo.description && photo.description.trim().length > 0) {
        console.log('[AnalyzePhotoTool] Photo already analyzed, returning existing description');
        return {
          success: true,
          photoId: photo.id,
          displayId: photo.metadata?.display_id || undefined,
          description: photo.description,
          alreadyAnalyzed: true,
        };
      }
      
      // Update status to 'processing' (vision analysis phase)
      await supabase
        .from('files')
        .update({ 
          processing_status: 'processing',
          metadata: {
            ...photo.metadata,
            processing_phase: 'vision_analysis',
          }
        })
        .eq('id', photo.id);
      
      console.log('[AnalyzePhotoTool] Calling Gemini Vision for:', photo.file_url);
      
      // Perform vision analysis
      const description = await parseImage(photo.file_url);
      
      if (!description || description.trim().length === 0) {
        console.warn('[AnalyzePhotoTool] No description generated');
        await supabase
          .from('files')
          .update({ processing_status: 'failed' })
          .eq('id', photo.id);
        
        return {
          success: false,
          photoId: photo.id,
          displayId: photo.metadata?.display_id || undefined,
          error: 'No content detected in image',
        };
      }
      
      // Save description to database
      const { error: updateError } = await supabase
        .from('files')
        .update({
          description: description,
          processing_status: 'processing', // Keep as processing, RAG will complete it
          metadata: {
            ...photo.metadata,
            processing_phase: 'vision_complete',
            scene_analysis: description,
            vision_analyzed_at: new Date().toISOString(),
          },
        })
        .eq('id', photo.id);
      
      if (updateError) {
        console.error('[AnalyzePhotoTool] Failed to update photo:', updateError);
        return {
          success: false,
          photoId: photo.id,
          displayId: photo.metadata?.display_id || undefined,
          error: 'Failed to save analysis results',
        };
      }
      
      // Queue photo for RAG indexing
      // NOTE: Future enhancement - move this to a background service that:
      // 1. Polls for files with status='uploaded' (for documents) or 'processing' with vision_complete (for photos)
      // 2. Sets status to 'processing' before starting RAG
      // 3. Sets status to 'ready' after RAG completes
      // 4. Uses metadata.processing_phase to track: vision_analysis → vision_complete → rag_indexing → complete
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const photoData = photo as any;
        const equipment = photoData.equipment_files?.[0]?.equipment;
        const workOrder = photoData.work_order_files?.[0]?.work_order;
        
        const indexParams: IndexContentParams = {
          type: 'photo',
          resourceId: photo.id,
          companyId: companyId,
          content: description, // Use pre-extracted description, skip parsing
          metadata: {
            photo_description: description,
            equipment_id: equipment?.id,
            equipment_name: equipment?.name,
            work_order_id: workOrder?.id,
            work_order_title: workOrder?.title,
          },
        };
        
        // Queue immediately for RAG indexing
        await contentQueue.add(indexParams, `photo-${photo.id}`);
        
        console.log('[AnalyzePhotoTool] Photo queued for RAG indexing');
      } catch (queueError) {
        console.error('[AnalyzePhotoTool] Failed to queue photo for RAG indexing:', queueError);
        // Don't fail the analysis - photo is still analyzed and accessible
      }
      
      console.log('[AnalyzePhotoTool] Analysis completed successfully');
      
      return {
        success: true,
        photoId: photo.id,
        displayId: photo.metadata?.display_id || undefined,
        description,
        alreadyAnalyzed: false,
      };
      
    } catch (error) {
      console.error('[AnalyzePhotoTool] Error analyzing photo:', error);
      return {
        success: false,
        photoId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
