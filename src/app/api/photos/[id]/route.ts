/**
 * PATCH /api/photos/[id] - Update a photo
 * DELETE /api/photos/[id] - Delete a photo
 * 
 * Authorization: 
 * - Update: Authenticated users (admin, editor can update)
 * - Delete: Admin only
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
import { RAG_INDEX_DELAY_MS } from '@/lib/config/rag-config';

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

          // Check if photo is already indexed (status='ready') or still in delay period
          const isAlreadyIndexed = photo.processing_status === 'ready';
          const jobId = `photo-${photo.id}`;
          
          if (isAlreadyIndexed) {
            // File already indexed - queue immediate re-index with updated metadata
            await contentQueue.add(indexParams, jobId); // No delay
            console.log('[PhotoUpdate] Photo queued for immediate re-indexing (already indexed)');
          } else {
            // File not yet indexed - queue will dedupe with existing delayed job
            // This replaces the pending job with fresh metadata and resets the delay
            await contentQueue.add(indexParams, jobId, RAG_INDEX_DELAY_MS);
            console.log('[PhotoUpdate] Photo re-queued with updated metadata (delay reset)');
          }
          
          // Update metadata to track last update
          await supabase
            .from('files')
            .update({
              metadata: {
                ...photo.metadata,
                last_metadata_update: new Date().toISOString(),
              },
            })
            .eq('id', photo.id);
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

// =============================================
// DELETE - Delete Photo
// =============================================

export const DELETE = route()
  .auth()
  .handle(async (_request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const photoId = params?.id as string;

    if (!photoId) {
      return badRequest('Photo ID is required');
    }

    // Check if user can delete photos (admin only)
    if (!helpers.canPerformAction(user!, 'delete', 'documents')) {
      return forbidden('You do not have permission to delete photos');
    }

    const supabase = createServiceRoleClient();

    // Fetch existing photo to get storage path
    const { data: photo, error: fetchError } = await supabase
      .from('files')
      .select('id, storage_path, company_id')
      .eq('company_id', user!.companyId)
      .eq('bucket_id', 'photos')
      .or(`id.eq.${photoId},metadata->>display_id.eq.${photoId}`)
      .maybeSingle();

    if (fetchError || !photo) {
      return notFound('Photo not found or does not belong to your company');
    }

    // Delete file from storage
    if (photo.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([photo.storage_path]);

      if (storageError) {
        console.error('Error deleting photo from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete equipment_files links (cascade should handle this, but be explicit)
    await supabase
      .from('equipment_files')
      .delete()
      .eq('file_id', photo.id);

    // Delete work_order_files links
    await supabase
      .from('work_order_files')
      .delete()
      .eq('file_id', photo.id);

    // Delete the file record
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', photo.id);

    if (deleteError) {
      console.error('Error deleting photo record:', deleteError);
      return badRequest('Failed to delete photo');
    }

    // TODO: Also delete from Pinecone if indexed
    // This would require knowing the chunk IDs or doing a filter delete

    return success({ message: 'Photo deleted successfully' });
  });
