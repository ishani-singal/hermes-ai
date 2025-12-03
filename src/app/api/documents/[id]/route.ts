/**
 * GET /api/documents/[id] - Get single document by UUID
 * PATCH /api/documents/[id] - Update document metadata by UUID
 * DELETE /api/documents/[id] - Delete document by UUID
 * 
 * Internal endpoints that use UUID (primary key)
 * Faster for internal UX operations, but UX should still display display_id to users
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, notFound, forbidden } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import type { Document } from '@/types';
import { contentQueue } from '@/lib/queue/simple-queue';
import type { IndexContentParams } from '@/mastra/services/rag';
import { RAG_INDEX_DELAY_MS } from '@/lib/config/rag-config';

// =============================================
// GET - Get Single Document by UUID
// =============================================

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    // Fetch document using UUID
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('bucket_id', 'documents')
      .eq('id', params.id)
      .eq('company_id', user!.companyId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching document:', error);
      return badRequest(error.message);
    }

    if (!data) {
      return notFound('Document not found');
    }

    return success<Document>(data as Document);
  });

// =============================================
// PATCH - Update Document Metadata by UUID
// =============================================

export const PATCH = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;

    // Check if user can update documents
    if (!helpers.canPerformAction(user!, 'update', 'documents')) {
      return forbidden('You do not have permission to update documents');
    }

    const supabase = createServiceRoleClient();

    // Parse request body
    let body: {
      title?: string;
      type?: string;
      equipment_id?: string | null;
      work_order_id?: string | null;
    };
    
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    // Validate field permissions (if not admin, check allowed fields)
    if (!helpers.isAdmin(user!)) {
      const requestedFields = Object.keys(body);
      const forbiddenFields = helpers.checkForbiddenFields(
        user!,
        'documents',
        requestedFields
      );

      if (forbiddenFields.length > 0) {
        return forbidden(
          `You do not have permission to update: ${forbiddenFields.join(', ')}`
        );
      }
    }

    // Validate field values
    if (body.title !== undefined) {
      if (!body.title || body.title.trim().length === 0) {
        return badRequest('Title cannot be empty');
      }
      if (body.title.length > 255) {
        return badRequest('Title must be 255 characters or less');
      }
    }

    if (body.type !== undefined) {
      const validTypes = ['manual', 'safety', 'sop', 'troubleshooting', 'other'];
      if (!validTypes.includes(body.type)) {
        return badRequest(`Type must be one of: ${validTypes.join(', ')}`);
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.type !== undefined) updateData.type = body.type;

    // Update document using UUID
    const { error: updateError } = await supabase
      .from('files')
      .update(updateData)
      .eq('bucket_id', 'documents')
      .eq('id', params.id)
      .eq('company_id', user!.companyId);

    if (updateError) {
      console.error('Error updating document:', updateError);
      return badRequest(updateError.message);
    }

    // Fetch updated document
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('bucket_id', 'documents')
      .eq('id', params.id)
      .eq('company_id', user!.companyId)
      .maybeSingle();

    if (error || !data) {
      return notFound('Document not found after update');
    }

    // Track if metadata changed (equipment/work order links) to trigger re-indexing
    const needsReindex = body.equipment_id !== undefined || body.work_order_id !== undefined;

    // If equipment or work order changed, queue for re-indexing with updated metadata
    if (needsReindex) {
      try {
        // Fetch updated document with relations for metadata
        const { data: updatedDocument } = await supabase
          .from('files')
          .select(`
            id,
            description,
            file_url,
            processing_status,
            metadata,
            equipment_files:equipment_files (
              equipment:equipment (id, name)
            ),
            work_order_files:work_order_files (
              work_order:work_orders (id, title)
            )
          `)
          .eq('id', data.id)
          .single();

        if (updatedDocument) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docData = updatedDocument as any;
          const equipment = docData.equipment_files?.[0]?.equipment;
          const workOrder = docData.work_order_files?.[0]?.work_order;

          const indexParams: IndexContentParams = {
            type: 'document',
            resourceId: data.id,
            companyId: user!.companyId,
            fileUrl: updatedDocument.file_url,
            documentTitle: updatedDocument.description || data.file_name,
            documentType: updatedDocument.metadata?.document_type || 'other',
            scope: updatedDocument.metadata?.scope || 'company',
            metadata: {
              ai_summary: updatedDocument.metadata?.ai_summary,
              equipment_id: equipment?.id,
              equipment_name: equipment?.name,
              work_order_id: workOrder?.id,
              work_order_title: workOrder?.title,
            },
          };

          // Check if document is already indexed or still in delay period
          const isAlreadyIndexed = updatedDocument.processing_status === 'ready';
          const jobId = `doc-${data.id}`;

          if (isAlreadyIndexed) {
            // File already indexed - queue immediate re-index with updated metadata
            await contentQueue.add(indexParams, jobId); // No delay
            console.log('[DocumentUpdate] Document queued for immediate re-indexing (already indexed)');
          } else {
            // File not yet indexed - queue will dedupe with existing delayed job
            await contentQueue.add(indexParams, jobId, RAG_INDEX_DELAY_MS);
            console.log('[DocumentUpdate] Document re-queued with updated metadata (delay reset)');
          }

          // Update metadata to track last update
          await supabase
            .from('files')
            .update({
              metadata: {
                ...updatedDocument.metadata,
                last_metadata_update: new Date().toISOString(),
              },
            })
            .eq('id', data.id);
        }
      } catch (queueError) {
        console.error('[DocumentUpdate] Failed to queue document for re-indexing:', queueError);
        // Don't fail the update - document is still updated
      }
    }

    return success<Document>(data as Document);
  });

// =============================================
// DELETE - Delete Document by UUID (Admin-only)
// =============================================

export const DELETE = route()
  .auth()
  .requireAdmin()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    // Fetch document to get file_url for storage cleanup
    const { data: document, error: fetchError } = await supabase
      .from('files')
      .select('file_url')
      .eq('bucket_id', 'documents')
      .eq('id', params.id)
      .eq('company_id', user!.companyId)
      .maybeSingle();

    if (fetchError || !document) {
      return notFound('Document not found');
    }

    // Extract storage path from file_url
    // Example URL: https://{project}.supabase.co/storage/v1/object/public/documents/{path}
    const storagePath = document.file_url.split('/documents/')[1];

    // Delete document record from database
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('bucket_id', 'documents')
      .eq('id', params.id)
      .eq('company_id', user!.companyId);

    if (deleteError) {
      console.error('Error deleting document:', deleteError);
      return badRequest(deleteError.message);
    }

    // Delete file from storage (best effort - don't fail if it's already gone)
    if (storagePath) {
      await supabase.storage
        .from('documents')
        .remove([storagePath])
        .catch(err => {
          console.warn('Failed to delete file from storage:', err);
          // Don't fail the request - document record is already deleted
        });
    }

    // Delete document vectors from Pinecone (best effort)
    try {
      const { deleteDocumentVectors } = await import('@/lib/pinecone/cleanup');
      await deleteDocumentVectors(params.id);
      console.log(`[Delete] Removed vectors for document ${params.id} from Pinecone`);
    } catch (err) {
      console.warn('Failed to delete vectors from Pinecone:', err);
      // Don't fail the request - document record is already deleted
    }

    return success({ 
      success: true, 
      message: 'Document deleted successfully' 
    });
  });
