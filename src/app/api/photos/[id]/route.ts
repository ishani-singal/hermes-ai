/**
 * PATCH /api/photos/[id] - Update a photo
 * 
 * Authorization: 
 * - Update: Authenticated users (admin, editor can update)
 * 
 * Supports updating:
 * - description (manual edits)
 * - link_type
 * - equipment_id / work_order_id links (triggers re-indexing)
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, forbidden, notFound } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import { contentQueue } from '@/lib/queue/simple-queue';
import type { IndexContentParams } from '@/mastra/services/rag-service';

export const PATCH = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const photoId = params?.id as string;

    if (!photoId) {
      return badRequest('Photo ID is required');
    }

    // Check if user can update photos
    if (!helpers.canPerformAction(user!, 'update', 'documents')) {
      return forbidden('You do not have permission to update photos');
    }

    const supabase = createServiceRoleClient();

    // Parse request body
    let body: {
      description?: string;
      equipment_id?: string | null;
      work_order_id?: string | null;
      link_type?: string;
    };
    
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    // Fetch existing photo
    const { data: photo, error: fetchError } = await supabase
      .from('files')
      .select(`
        id, 
        company_id, 
        description, 
        file_url,
        metadata,
        processing_status,
        equipment_files:equipment_files (
          equipment:equipment (id, name)
        ),
        work_order_files:work_order_files (
          work_order:work_orders (id, title)
        )
      `)
      .eq('company_id', user!.companyId)
      .eq('bucket_id', 'photos')
      .or(`id.eq.${photoId},metadata->>display_id.eq.${photoId}`)
      .maybeSingle();

    if (fetchError || !photo) {
      return notFound('Photo not found or does not belong to your company');
    }

    // Track if we need to re-index
    let needsReindex = false;
    const updates: Record<string, unknown> = {};

    // Handle description update
    if (body.description !== undefined) {
      updates.description = body.description;
      updates.metadata = {
        ...photo.metadata,
        user_edited: true,
        edited_at: new Date().toISOString(),
      };
      needsReindex = true;
    }

    // Apply database updates
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('files')
        .update(updates)
        .eq('id', photo.id);

      if (updateError) {
        console.error('Error updating photo:', updateError);
        return badRequest('Failed to update photo');
      }
    }

    // Handle equipment link changes
    if (body.equipment_id !== undefined) {
      // Remove existing equipment link
      await supabase
        .from('equipment_files')
        .delete()
        .eq('file_id', photo.id);

      // Add new equipment link if provided
      if (body.equipment_id) {
        // Validate equipment exists and belongs to company
        const { data: equipment, error: equipmentError } = await supabase
          .from('equipment')
          .select('id, name')
          .eq('company_id', user!.companyId)
          .or(`id.eq.${body.equipment_id},display_id.eq.${body.equipment_id}`)
          .maybeSingle();

        if (equipmentError || !equipment) {
          return badRequest('Equipment not found or does not belong to your company');
        }

        const { error: linkError } = await supabase
          .from('equipment_files')
          .insert({
            equipment_id: equipment.id,
            file_id: photo.id,
            link_type: body.link_type || 'reference',
          });

        if (linkError) {
          console.error('Error linking photo to equipment:', linkError);
          return badRequest('Failed to link photo to equipment');
        }

        needsReindex = true;
      }
    }

    // Handle work order link changes
    if (body.work_order_id !== undefined) {
      // Remove existing work order link
      await supabase
        .from('work_order_files')
        .delete()
        .eq('file_id', photo.id);

      // Add new work order link if provided
      if (body.work_order_id) {
        // Validate work order exists and belongs to company
        const { data: workOrder, error: workOrderError } = await supabase
          .from('work_orders')
          .select('id, title')
          .eq('company_id', user!.companyId)
          .or(`id.eq.${body.work_order_id},display_id.eq.${body.work_order_id}`)
          .maybeSingle();

        if (workOrderError || !workOrder) {
          return badRequest('Work order not found or does not belong to your company');
        }

        const { error: linkError } = await supabase
          .from('work_order_files')
          .insert({
            work_order_id: workOrder.id,
            file_id: photo.id,
            link_type: body.link_type || 'evidence',
          });

        if (linkError) {
          console.error('Error linking photo to work order:', linkError);
          return badRequest('Failed to link photo to work order');
        }

        needsReindex = true;
      }
    }

    // Trigger re-indexing if needed
    if (needsReindex && photo.description) {
      try {
        // Fetch updated links
        const { data: updatedPhoto } = await supabase
          .from('files')
          .select(`
            id,
            description,
            equipment_files:equipment_files (
              equipment:equipment (id, name)
            ),
            work_order_files:work_order_files (
              work_order:work_orders (id, title)
            )
          `)
          .eq('id', photo.id)
          .single();

        if (updatedPhoto) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const photoData = updatedPhoto as any;
          const equipment = photoData.equipment_files?.[0]?.equipment;
          const workOrder = photoData.work_order_files?.[0]?.work_order;

          const indexParams: IndexContentParams = {
            type: 'photo',
            resourceId: photo.id,
            companyId: user!.companyId,
            content: updatedPhoto.description || photo.description,
            metadata: {
              photo_description: updatedPhoto.description || photo.description,
              equipment_id: equipment?.id,
              equipment_name: equipment?.name,
              work_order_id: workOrder?.id,
              work_order_title: workOrder?.title,
            },
          };

          // Queue for re-indexing with updated metadata
          // Note: If original job is still queued, both will execute and upsert the same Pinecone record
          const jobId = `photo-${photo.id}`;
          await contentQueue.add(indexParams, jobId);
          
          console.log('[PhotoUpdate] Photo queued for re-indexing');
        }
      } catch (queueError) {
        console.error('[PhotoUpdate] Failed to queue photo for re-indexing:', queueError);
        // Don't fail the update - photo is still updated
      }
    }

    return success({ 
      message: 'Photo updated successfully',
      needsReindex,
    });
  });
