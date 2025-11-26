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
import { RAG_INDEX_DELAY_MS } from '@/lib/config/rag-config';
import type {
  Document,
  DocumentListFilters,
  DocumentListResponse,
  DocumentType,
  DocumentScope,
  DocumentStatus,
} from '@/types';
import { contentQueue } from '@/lib/queue/simple-queue';
import type { IndexContentParams } from '@/mastra/services/rag-service';

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
      work_order_id: searchParams.get('work_order_id') || undefined,
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
    // Join with equipment_files -> equipment to get equipment details
    // We query the 'files' table where bucket_id is 'documents'
    let query = supabase
      .from('files')
      .select(`
        *,
        equipment_files:equipment_files (
          equipment:equipment (
            id,
            display_id,
            name
          )
        ),
        work_order_files:work_order_files (
          work_order:work_orders (
            id,
            display_id,
            title
          )
        )
      `, { count: 'exact' })
      .eq('company_id', user!.companyId)
      .eq('bucket_id', 'documents');
      
    // Filter out archived documents (stored in metadata)
    query = query.filter('metadata->>archived_at', 'is', null);

    // Apply filters
    if (filters.equipment_id) {
      query = query.eq('equipment_files.equipment_id', filters.equipment_id);
    }

    if (filters.work_order_id) {
      query = query.eq('work_order_files.work_order_id', filters.work_order_id);
    }

    if (filters.type) {
      query = query.eq('metadata->>document_type', filters.type);
    }

    if (filters.scope) {
      query = query.eq('metadata->>scope', filters.scope);
    }

    if (filters.status) {
      query = query.eq('processing_status', filters.status);
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      // Search in description (title) or display_id (in metadata)
      query = query.or(
        `description.ilike.${searchTerm},metadata->>display_id.ilike.${searchTerm}`
      );
    }

    // Apply sorting (newest first by default)
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    const from = (filters.page! - 1) * filters.limit!;
    const to = from + filters.limit! - 1;
    query = query.range(from, to);

    // Execute query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, count, error } = await query as any;

    if (error) {
      console.error('Error listing documents:', error);
      return badRequest(error.message);
    }

    // Map files to Document type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documents: Document[] = (data || []).map((file: any) => {
      const equipmentLink = file.equipment_files?.[0];
      const equipment = equipmentLink?.equipment;
      const metadata = file.metadata || {};

      return {
        id: file.id,
        company_id: file.company_id,
        equipment_id: equipment?.id,
        display_id: metadata.display_id || file.id, // Fallback to ID if display_id missing
        title: file.description || file.file_name,
        type: (metadata.document_type as DocumentType) || 'other',
        scope: (metadata.scope as DocumentScope) || 'company',
        file_url: file.file_url,
        file_size: file.file_size,
        page_count: metadata.page_count,
        status: file.processing_status as DocumentStatus,
        archived_at: metadata.archived_at,
        archive_reason: metadata.archive_reason,
        created_at: file.created_at,
        updated_at: file.updated_at,
        equipment: equipment ? {
          id: equipment.id,
          display_id: equipment.display_id,
          name: equipment.name
        } : undefined
      };
    });

    const response: DocumentListResponse = {
      data: documents,
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
    } catch {
      return badRequest('Invalid form data');
    }

    // Extract fields
    const title = formData.get('title') as string;
    const type = formData.get('type') as DocumentType;
    const scope = formData.get('scope') as DocumentScope;
    const equipment_id = formData.get('equipment_id') as string | null;
    const work_order_id = formData.get('work_order_id') as string | null;
    const uploadedFile = formData.get('file') as File | null;

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
    let validatedEquipmentId: string | null = null;
    let equipmentName: string | undefined;

    if (equipment_id) {
      const { data: equipment, error: equipmentError } = await supabase
        .from('equipment')
        .select('id, name')
        .eq('company_id', user!.companyId)
        .or(`id.eq.${equipment_id},display_id.eq.${equipment_id}`)
        .maybeSingle();

      if (equipmentError || !equipment) {
        return badRequest('Equipment not found or does not belong to your company');
      }

      validatedEquipmentId = equipment.id;
      equipmentName = equipment.name;
    }

    // Validate work order exists and belongs to company
    let validatedWorkOrderId: string | null = null;
    let workOrderTitle: string | undefined;

    if (work_order_id) {
      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .select('id, title')
        .eq('company_id', user!.companyId)
        .or(`id.eq.${work_order_id},display_id.eq.${work_order_id}`)
        .maybeSingle();

      if (workOrderError || !workOrder) {
        return badRequest('Work order not found or does not belong to your company');
      }

      validatedWorkOrderId = workOrder.id;
      workOrderTitle = workOrder.title;
    }

    if (!uploadedFile) {
      return badRequest('File is required');
    }

    // Validate file type (PDFs only for now, can expand later)
    const allowedMimeTypes = ['application/pdf'];
    if (!allowedMimeTypes.includes(uploadedFile.type)) {
      return badRequest('Only PDF files are supported');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (uploadedFile.size > maxSize) {
      return badRequest('File size must be less than 5MB');
    }

    // Upload file to Supabase Storage
    // Storage bucket: documents/{company_id}/{document_id}/{filename}
    const tempDocId = crypto.randomUUID();
    const fileExtension = uploadedFile.name.split('.').pop();
    const storagePath = `${user!.companyId}/${tempDocId}/${tempDocId}.${fileExtension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, uploadedFile, {
        contentType: uploadedFile.type,
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

    // Prepare metadata
    const metadata = {
      document_type: type,
      scope: scope,
      // display_id will be generated by trigger
    };

    // Insert file record
    const { data: fileRecord, error: insertError } = await supabase
      .from('files')
      .insert({
        company_id: user!.companyId,
        uploaded_by: user!.id,
        bucket_id: 'documents',
        storage_path: storagePath,
        file_url: urlData.publicUrl,
        file_name: uploadedFile.name,
        file_type: uploadedFile.type,
        file_size: uploadedFile.size,
        description: title, // Use title as description
        metadata: metadata,
        processing_status: 'uploaded',
      })
      .select()
      .single();

    if (insertError || !fileRecord) {
      console.error('Error creating file record:', insertError);
      // Cleanup uploaded file
      await supabase.storage.from('documents').remove([storagePath]);
      return badRequest(insertError?.message || 'Failed to create document record');
    }

    // Link to equipment if needed
    if (validatedEquipmentId) {
      const { error: linkError } = await supabase
        .from('equipment_files')
        .insert({
          equipment_id: validatedEquipmentId,
          file_id: fileRecord.id,
          link_type: 'manual', // Default link type for documents
        });

      if (linkError) {
        console.error('Error linking document to equipment:', linkError);
        // We don't fail the whole request, but log it. 
        // Ideally we should probably rollback the file insert, but for now we proceed.
      }
    }

    // Link to work order if needed
    if (validatedWorkOrderId) {
      const { error: linkError } = await supabase
        .from('work_order_files')
        .insert({
          work_order_id: validatedWorkOrderId,
          file_id: fileRecord.id,
          link_type: 'reference', // Default link type for documents
        });

      if (linkError) {
        console.error('Error linking document to work order:', linkError);
        // We don't fail the whole request, but log it
      }
    }

    // Queue for background RAG indexing with delay
    // Delay allows time for agent to add metadata (equipment/work order links, AI summary)
    // before indexing, reducing the need for re-indexing
    try {
      const ragQueuedAt = new Date();
      
      // Update metadata to track RAG queue status
      await supabase
        .from('files')
        .update({
          metadata: {
            ...fileRecord.metadata,
            processing_phase: 'rag_queued',
            rag_queued_at: ragQueuedAt.toISOString(),
          },
        })
        .eq('id', fileRecord.id);
      
      const processingParams: IndexContentParams = {
        type: 'document',
        resourceId: fileRecord.id,
        companyId: user!.companyId,
        fileUrl: fileRecord.file_url,
        documentTitle: fileRecord.description || fileRecord.file_name,
        documentType: type,
        scope: scope,
        metadata: {
          equipment_id: validatedEquipmentId || undefined,
          equipment_name: equipmentName,
          work_order_id: validatedWorkOrderId || undefined,
          work_order_title: workOrderTitle,
        },
      };

      // Queue with configurable delay (default 10 minutes)
      await contentQueue.add(processingParams, `doc-${fileRecord.id}`, RAG_INDEX_DELAY_MS);
      console.log(`[Upload] Document queued for RAG indexing (delay: ${RAG_INDEX_DELAY_MS}ms): ${fileRecord.id}`);
    } catch (error) {
      console.error('[Upload] Failed to queue document for RAG indexing:', error);
      // Don't fail the upload - document is uploaded and accessible, indexing can be retried
    }

    // Construct response matching Document interface
    const responseDocument: Document = {
      id: fileRecord.id,
      company_id: fileRecord.company_id,
      equipment_id: validatedEquipmentId || undefined,
      display_id: fileRecord.metadata?.display_id || fileRecord.id, // Trigger might have added it, but we might need to re-fetch to get it. 
      // Since we selected *, if the trigger ran BEFORE return, we might have it. 
      // But triggers usually run on DB side. The returned data from .insert().select() *should* include trigger updates if it's BEFORE INSERT.
      title: fileRecord.description,
      type: type,
      scope: scope,
      file_url: fileRecord.file_url,
      file_size: fileRecord.file_size,
      status: 'uploaded',
      created_at: fileRecord.created_at,
      updated_at: fileRecord.updated_at,
      equipment: validatedEquipmentId ? {
        id: validatedEquipmentId,
        display_id: '', // We don't have this handy without another query, but frontend might not need it immediately
        name: equipmentName || ''
      } : undefined
    };

    return success<Document>(responseDocument, 201);
  });
