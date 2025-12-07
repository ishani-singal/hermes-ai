/**
 * POST /api/documents/bulk - Bulk upload multiple documents
 * 
 * Authorization: 
 * - Upload: Authenticated users (admin, editor can upload)
 * 
 * Limits:
 * - Max 10 files per request
 * - Max 10MB per file
 * 
 * Processing Flow:
 * Each file goes through: uploaded → analyzing → indexing → ready
 * Files are processed in the background via queue after upload completes.
 * 
 * Response includes all document IDs with their initial status.
 * Client can poll individual documents or use the list endpoint with status filter.
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, forbidden } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import type { DocumentType, DocumentScope, DocumentStatus } from '@/types';
import { contentQueue } from '@/lib/queue/simple-queue';
import type { IndexContentParams } from '@/mastra/services/rag';
// Note: parsePDF and analyzeDocumentWithExtraction may be used in future for inline processing
// import { parsePDF } from '@/lib/parsers/pdf-parser';
// import { analyzeDocumentWithExtraction } from '@/lib/parsers/pdf-summarizer';

// Limits
const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const ALLOWED_MIME_TYPES = ['application/pdf'];

interface BulkUploadResult {
  documentId: string;
  displayId?: string;
  title: string;
  status: DocumentStatus;
  error?: string;
}

interface BulkUploadResponse {
  total: number;
  successful: number;
  failed: number;
  results: BulkUploadResult[];
}

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

    // Get all files from form data
    const files: File[] = [];
    const titles: string[] = [];
    
    // Support both 'files' (multiple) and 'files[]' naming conventions
    for (const [key, value] of formData.entries()) {
      if ((key === 'files' || key === 'files[]') && value instanceof File) {
        files.push(value);
      }
      if ((key === 'titles' || key === 'titles[]') && typeof value === 'string') {
        titles.push(value);
      }
    }

    // Get common settings
    const type = (formData.get('type') as DocumentType) || 'other';
    const scope = (formData.get('scope') as DocumentScope) || 'company';
    const equipment_id = formData.get('equipment_id') as string | null;

    // Validate file count
    if (files.length === 0) {
      return badRequest('No files provided');
    }

    if (files.length > MAX_FILES) {
      return badRequest(`Maximum ${MAX_FILES} files allowed per upload`);
    }

    // Validate type
    const validTypes: DocumentType[] = ['manual', 'safety', 'sop', 'troubleshooting', 'other'];
    if (!validTypes.includes(type)) {
      return badRequest(`Type must be one of: ${validTypes.join(', ')}`);
    }

    // Validate scope
    const validScopes: DocumentScope[] = ['company', 'equipment'];
    if (!validScopes.includes(scope)) {
      return badRequest(`Scope must be one of: ${validScopes.join(', ')}`);
    }

    // Validate equipment if provided
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

    // If scope is equipment, equipment_id is required
    if (scope === 'equipment' && !validatedEquipmentId) {
      return badRequest('Equipment ID is required when scope is "equipment"');
    }

    // Pre-validate all files before uploading any
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return badRequest(`File ${i + 1} (${file.name}): Only PDF files are supported`);
      }
      
      if (file.size > MAX_FILE_SIZE) {
        return badRequest(`File ${i + 1} (${file.name}): File size must be less than 10MB`);
      }
    }

    // Process each file
    const results: BulkUploadResult[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const title = titles[i] || file.name.replace(/\.[^/.]+$/, ''); // Use provided title or derive from filename

      try {
        // Generate unique ID for this document
        const docId = crypto.randomUUID();
        const fileExtension = file.name.split('.').pop();
        const storagePath = `${user!.companyId}/${docId}/${docId}.${fileExtension}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storagePath);

        if (!urlData?.publicUrl) {
          await supabase.storage.from('documents').remove([storagePath]);
          throw new Error('Failed to get file URL');
        }

        // Insert file record
        const { data: fileRecord, error: insertError } = await supabase
          .from('files')
          .insert({
            company_id: user!.companyId,
            uploaded_by: user!.id,
            bucket_id: 'documents',
            storage_path: storagePath,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            description: title,
            metadata: {
              document_type: type,
              scope: scope,
              bulk_upload: true,
              bulk_upload_index: i,
            },
            processing_status: 'uploaded',
          })
          .select()
          .single();

        if (insertError || !fileRecord) {
          await supabase.storage.from('documents').remove([storagePath]);
          throw new Error(`Database insert failed: ${insertError?.message}`);
        }

        // Link to equipment if needed
        if (validatedEquipmentId) {
          await supabase
            .from('equipment_files')
            .insert({
              equipment_id: validatedEquipmentId,
              file_id: fileRecord.id,
              link_type: 'manual',
            });
        }

        // Queue for background processing (analysis + indexing)
        // We use a dedicated background processor for bulk uploads
        await queueDocumentProcessing(
          supabase,
          fileRecord,
          urlData.publicUrl,
          file.name,
          type,
          scope,
          user!.companyId,
          validatedEquipmentId,
          equipmentName
        );

        results.push({
          documentId: fileRecord.id,
          displayId: fileRecord.metadata?.display_id,
          title: title,
          status: 'uploaded', // Will transition to analyzing shortly
        });
        successful++;

      } catch (error) {
        console.error(`[BulkUpload] Error processing file ${i + 1} (${file.name}):`, error);
        results.push({
          documentId: '',
          title: title,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    const response: BulkUploadResponse = {
      total: files.length,
      successful,
      failed,
      results,
    };

    return success(response, successful > 0 ? 201 : 400);
  });

/**
 * Queue document for background processing (analysis + indexing)
 * For bulk uploads, we queue immediately and let the worker handle everything
 */
async function queueDocumentProcessing(
  supabase: ReturnType<typeof createServiceRoleClient>,
  fileRecord: { id: string; metadata?: Record<string, unknown> },
  fileUrl: string,
  fileName: string,
  documentType: DocumentType,
  scope: DocumentScope,
  companyId: string,
  equipmentId: string | null,
  equipmentName: string | undefined
): Promise<void> {
  // Update status to analyzing
  await supabase
    .from('files')
    .update({
      processing_status: 'analyzing',
      metadata: {
        ...fileRecord.metadata,
        processing_phase: 'queued_for_analysis',
        queued_at: new Date().toISOString(),
      },
    })
    .eq('id', fileRecord.id);

  // For bulk uploads, we process analysis in the background too
  // Create a combined job that does analysis + indexing
  const processingParams: IndexContentParams & { needsAnalysis?: boolean } = {
    type: 'document',
    resourceId: fileRecord.id,
    companyId: companyId,
    fileUrl: fileUrl,
    documentTitle: fileName,
    documentType: documentType,
    scope: scope,
    metadata: {
      equipment_id: equipmentId || undefined,
      equipment_name: equipmentName,
      needs_analysis: true, // Flag for the worker to run analysis first
    },
  };

  // Queue immediately (no delay for bulk uploads)
  await contentQueue.add(processingParams, `doc-${fileRecord.id}`);
  console.log(`[BulkUpload] Document queued for processing: ${fileRecord.id}`);
}
