/**
 * POST /api/documents - Upload a new document
 * GET /api/documents - List documents with filtering
 * 
 * Authorization: 
 * - Upload: Authenticated users (admin, editor can upload)
 * - List: All authenticated users can view their company's documents
 * 
 * Note: Document upload includes file handling to Supabase Storage
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, forbidden } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import type {
  Document,
  DocumentListFilters,
  DocumentListResponse,
  DocumentType,
  DocumentScope,
  DocumentStatus,
} from '@/types';

// =============================================
// GET - List Documents
// =============================================

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const filters: DocumentListFilters = {
      equipment_id: searchParams.get('equipment_id') || undefined,
      type: (searchParams.get('type') as DocumentType) || undefined,
      scope: (searchParams.get('scope') as DocumentScope) || undefined,
      status: (searchParams.get('status') as DocumentStatus) || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: Math.min(parseInt(searchParams.get('limit') || '25', 10), 100),
    };

    // Use service role client
    const supabase = createServiceRoleClient();

    // Build base query - exclude archived documents by default
    let query = supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('company_id', user!.companyId)
      .is('archived_at', null); // Only show non-archived documents

    // Apply filters
    if (filters.equipment_id) {
      query = query.eq('equipment_id', filters.equipment_id);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.scope) {
      query = query.eq('scope', filters.scope);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query = query.or(
        `title.ilike.${searchTerm},display_id.ilike.${searchTerm}`
      );
    }

    // Apply sorting (newest first by default)
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    const from = (filters.page! - 1) * filters.limit!;
    const to = from + filters.limit! - 1;
    query = query.range(from, to);

    // Execute query
    const { data, count, error } = await query;

    if (error) {
      console.error('Error listing documents:', error);
      return badRequest(error.message);
    }

    const response: DocumentListResponse = {
      data: (data || []) as Document[],
      pagination: {
        page: filters.page!,
        limit: filters.limit!,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / filters.limit!),
      },
      filters,
    };

    return success(response);
  });

// =============================================
// POST - Upload Document
// =============================================

export const POST = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;

    // Check if user can upload documents
    if (!helpers.canPerformAction(user!, 'create', 'documents')) {
      return forbidden('You do not have permission to upload documents');
    }

    const supabase = createServiceRoleClient();

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      return badRequest('Invalid form data');
    }

    // Extract fields
    const title = formData.get('title') as string;
    const type = formData.get('type') as DocumentType;
    const scope = formData.get('scope') as DocumentScope;
    const equipment_id = formData.get('equipment_id') as string | null;
    const file = formData.get('file') as File | null;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return badRequest('Title is required');
    }

    if (title.length > 255) {
      return badRequest('Title must be 255 characters or less');
    }

    if (!type) {
      return badRequest('Type is required');
    }

    const validTypes: DocumentType[] = ['manual', 'safety', 'sop', 'troubleshooting', 'other'];
    if (!validTypes.includes(type)) {
      return badRequest(`Type must be one of: ${validTypes.join(', ')}`);
    }

    if (!scope) {
      return badRequest('Scope is required');
    }

    const validScopes: DocumentScope[] = ['company', 'equipment'];
    if (!validScopes.includes(scope)) {
      return badRequest(`Scope must be one of: ${validScopes.join(', ')}`);
    }

    // If scope is equipment, equipment_id is required
    if (scope === 'equipment' && !equipment_id) {
      return badRequest('Equipment ID is required when scope is "equipment"');
    }

    // Validate equipment exists and belongs to company
    if (equipment_id) {
      const { data: equipment, error: equipmentError } = await supabase
        .from('equipment')
        .select('id')
        .eq('company_id', user!.companyId)
        .or(`id.eq.${equipment_id},display_id.eq.${equipment_id}`)
        .maybeSingle();

      if (equipmentError || !equipment) {
        return badRequest('Equipment not found or does not belong to your company');
      }

      // Use the UUID for the equipment_id
      formData.set('equipment_id', equipment.id);
    }

    if (!file) {
      return badRequest('File is required');
    }

    // Validate file type (PDFs only for now, can expand later)
    const allowedMimeTypes = ['application/pdf'];
    if (!allowedMimeTypes.includes(file.type)) {
      return badRequest('Only PDF files are supported');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return badRequest('File size must be less than 5MB');
    }

    // Upload file to Supabase Storage
    // Storage bucket: documents/{company_id}/{document_id}/{filename}
    const tempDocId = crypto.randomUUID();
    const fileExtension = file.name.split('.').pop();
    const storagePath = `${user!.companyId}/${tempDocId}/${tempDocId}.${fileExtension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError || !uploadData) {
      console.error('Error uploading file to storage:', uploadError);
      return badRequest(uploadError?.message || 'Failed to upload file');
    }

    // Get public URL for the file
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) {
      // Cleanup uploaded file
      await supabase.storage.from('documents').remove([storagePath]);
      return badRequest('Failed to get file URL');
    }

    // Insert document record
    // display_id will be auto-generated by trigger
    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert({
        company_id: user!.companyId,
        equipment_id: equipment_id ? formData.get('equipment_id') : null,
        title: title,
        type: type,
        scope: scope,
        file_url: urlData.publicUrl,
        file_size: file.size,
        status: 'uploaded', // Processing will happen in background
      })
      .select()
      .single();

    if (insertError || !document) {
      console.error('Error creating document record:', insertError);
      // Cleanup uploaded file
      await supabase.storage.from('documents').remove([storagePath]);
      return badRequest(insertError?.message || 'Failed to create document record');
    }

    // TODO: Trigger background processing job for PDF parsing and RAG ingestion
    // This would update status to 'processing' -> 'ready' or 'failed'

    return success<Document>(document as Document, 201);
  });
