/**
 * GET /api/documents/display-id/[display-id] - Get single document by display_id
 * PATCH /api/documents/display-id/[display-id] - Update document metadata by display_id
 * DELETE /api/documents/display-id/[display-id] - Delete document by display_id
 * 
 * Public-facing endpoints that use display_id (e.g., DOC-ACME-0001)
 * Query directly by display_id with company_id verification
 * 
 * Primary use: AI agents that reference documents by display_id
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, notFound, forbidden } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import type { Document } from '@/types';

// =============================================
// GET - Get Single Document by display_id
// =============================================

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    // Fetch document using display_id
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('display_id', params['display-id'])
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
// PATCH - Update Document Metadata by display_id
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

    // Update document using display_id
    const { error: updateError } = await supabase
      .from('documents')
      .update(updateData)
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId);

    if (updateError) {
      console.error('Error updating document:', updateError);
      return badRequest(updateError.message);
    }

    // Fetch updated document
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('display_id', params['display-id'])
      .eq('company_id', user!.companyId)
      .maybeSingle();

    if (error || !data) {
      return notFound('Document not found after update');
    }

    return success<Document>(data as Document);
  });

// =============================================
// DELETE - Delete Document by display_id (Admin-only)
// =============================================

export const DELETE = route()
  .auth()
  .requireAdmin()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const supabase = createServiceRoleClient();

    // Fetch document to get file_url for storage cleanup
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, file_url')
      .eq('display_id', params['display-id'])
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
      .from('documents')
      .delete()
      .eq('display_id', params['display-id'])
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
      await deleteDocumentVectors(document.id);
      console.log(`[Delete] Removed vectors for document ${document.id} from Pinecone`);
    } catch (err) {
      console.warn('Failed to delete vectors from Pinecone:', err);
      // Don't fail the request - document record is already deleted
    }

    return success({ 
      success: true, 
      message: 'Document deleted successfully' 
    });
  });
