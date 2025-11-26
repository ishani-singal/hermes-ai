/**
 * Photo Analysis Tool for Agent
 * 
 * Fetches or generates photo analysis using Gemini Vision.
 * Backend handles RAG indexing - this tool only manages vision analysis.
 * If analysis exists, returns cached result. Otherwise analyzes and saves.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { parseImage } from '@/lib/parsers/image-parser';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Get Photo with Equipment Context
 * Retrieves a photo and includes any linked equipment information
 * Useful when creating work orders from photos
 */
export const getPhotoWithContextTool = createTool({
  id: 'get-photo-context-tool',
  description: `Get photo details including any linked equipment and analysis.
  
  Use this when:
  - User wants to create a work order from a photo and you need to know what equipment it's for
  - You need to get the photo ID/display ID for reference
  - User asks "what equipment is in this photo?"
  
  Returns:
  - Photo details (ID, display ID)
  - Any linked equipment (name, display ID)
  - Photo analysis/description if available`,
  
  inputSchema: z.object({
    photoId: z.string().describe('The UUID or display_id of the photo (e.g., "PHOTO-ACME-0001" or a UUID)'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    photoId: z.string(),
    displayId: z.string().optional(),
    description: z.string().optional(),
    equipmentId: z.string().optional(),
    equipmentDisplayId: z.string().optional(),
    equipmentName: z.string().optional(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, runtimeContext }) => {
    const { photoId } = context;
    
    console.log('[GetPhotoContextTool] Getting photo context:', photoId);
    
    let companyId = runtimeContext.get('companyId') as string;
    if (!companyId) {
      const ctx = runtimeContext as unknown as { companyId?: string; contextData?: { companyId?: string } };
      companyId = ctx.companyId || ctx.contextData?.companyId || '';
    }
    
    if (!companyId) {
      console.error('[GetPhotoContextTool] No company ID found');
      return {
        success: false,
        photoId,
        error: 'Company ID not found in context',
      };
    }
    
    try {
      const supabase = createServiceRoleClient();
      
      // Fetch photo with equipment link
      let query = supabase
        .from('files')
        .select(`
          id, file_url, description, processing_status, bucket_id, metadata,
          equipment_files:equipment_files (
            equipment:equipment (id, name, display_id)
          )
        `)
        .eq('company_id', companyId)
        .eq('bucket_id', 'photos');
      
      // Try UUID first, then display_id
      if (photoId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        query = query.eq('id', photoId);
      } else {
        query = query.eq('metadata->>display_id', photoId);
      }
      
      const { data: photo, error: fetchError } = await query.maybeSingle();
      
      if (fetchError || !photo) {
        console.error('[GetPhotoContextTool] Photo not found:', fetchError);
        return {
          success: false,
          photoId,
          error: 'Photo not found or does not belong to your company',
        };
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const equipmentLink = (photo as any).equipment_files?.[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const equipment = equipmentLink?.equipment as any;
      
      return {
        success: true,
        photoId: photo.id,
        displayId: photo.metadata?.display_id || undefined,
        description: photo.description,
        equipmentId: equipment?.id,
        equipmentDisplayId: equipment?.display_id,
        equipmentName: equipment?.name,
      };
      
    } catch (error) {
      console.error('[GetPhotoContextTool] Error getting photo context:', error);
      return {
        success: false,
        photoId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});

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
      // Note: RAG queuing is handled by backend, not by agent tool
      const { error: updateError } = await supabase
        .from('files')
        .update({
          description: description,
          metadata: {
            ...photo.metadata,
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

/**
 * Patch Photo Tool
 * Updates photo metadata to link it to equipment or work orders
 */
export const patchPhotoTool = createTool({
  id: 'patch-photo-tool',
  description: `Update photo metadata to link it to equipment or work orders.
  
  Use this when:
  - You've created a work order and need to link the source photo to it
  - You need to link/unlink a photo from equipment
  - You need to link/unlink a photo from a work order
  - You want to update link type (before/after/evidence/reference)
  
  Returns:
  - Updated photo details
  - Confirmation of links applied`,
  
  inputSchema: z.object({
    photoId: z.string().describe('The photo UUID or display_id to update'),
    equipment_id: z.string().optional().describe('Equipment display ID or UUID to link. Pass null to remove equipment link.'),
    work_order_id: z.string().optional().describe('Work order display ID or UUID to link. Pass null to remove work order link.'),
    link_type: z.enum(['before', 'after', 'evidence', 'reference', 'profile', 'other']).optional().describe('Type of link (default: evidence for work orders, reference for equipment)'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    photoId: z.string(),
    displayId: z.string().optional(),
    linkedEquipment: z.boolean().optional(),
    linkedWorkOrder: z.boolean().optional(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, runtimeContext }) => {
    const { photoId, equipment_id, work_order_id, link_type } = context;
    
    if (!photoId) {
      return { success: false, photoId: '', error: 'Photo ID is required' };
    }
    
    console.log('[PatchPhotoTool] Updating photo:', photoId, { equipment_id, work_order_id, link_type });
    
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
          patchPayload.link_type = link_type || 'evidence';
        }
      }
      
      const response = await fetch(
        `${BASE_URL}/api/photos/${photoId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(patchPayload),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PatchPhotoTool] PATCH failed:', errorText);
        return {
          success: false,
          photoId,
          error: errorText || `HTTP ${response.status}`,
        };
      }
      
      const result = await response.json();
      
      return {
        success: true,
        photoId: result.data?.id || photoId,
        displayId: result.data?.display_id || undefined,
        linkedEquipment: !!equipment_id,
        linkedWorkOrder: !!work_order_id,
      };
      
    } catch (error) {
      console.error('[PatchPhotoTool] Error updating photo:', error);
      return {
        success: false,
        photoId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
