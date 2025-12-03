/**
 * POST /api/photos/bulk - Bulk upload multiple photos
 * 
 * Authorization: 
 * - Upload: Authenticated users (admin, editor can upload)
 * 
 * Limits:
 * - Max 10 files per request
 * - Max 20MB per file
 * 
 * Processing Flow:
 * Each file goes through: uploaded → analyzing → indexing → ready
 * Files are processed in the background via queue after upload completes.
 * 
 * Response includes all photo IDs with their initial status.
 * Client can poll individual photos or use the list endpoint with status filter.
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, forbidden } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import { contentQueue } from '@/lib/queue/simple-queue';
import type { IndexContentParams } from '@/mastra/services/rag';
import type { PhotoStatus } from '@/types/photo';

// Photo link types
type PhotoLinkType = 'before' | 'after' | 'evidence' | 'reference' | 'profile' | 'other';

// Limits
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
];

interface BulkUploadResult {
  photoId: string;
  displayId?: string;
  fileName: string;
  status: PhotoStatus;
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

    // Check if user can upload photos
    if (!helpers.canPerformAction(user!, 'create', 'documents')) {
      return forbidden('You do not have permission to upload photos');
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
    const descriptions: string[] = [];

    // Support both 'files' (multiple) and 'files[]' naming conventions
    for (const [key, value] of formData.entries()) {
      if ((key === 'files' || key === 'files[]') && value instanceof File) {
        files.push(value);
      }
      if ((key === 'descriptions' || key === 'descriptions[]') && typeof value === 'string') {
        descriptions.push(value);
      }
    }

    // Get common settings
    const link_type = (formData.get('link_type') as PhotoLinkType) || 'reference';
    const equipment_id = formData.get('equipment_id') as string | null;
    const work_order_id = formData.get('work_order_id') as string | null;

    // Validate file count
    if (files.length === 0) {
      return badRequest('No files provided');
    }

    if (files.length > MAX_FILES) {
      return badRequest(`Maximum ${MAX_FILES} files allowed per upload`);
    }

    // Validate link_type
    const validLinkTypes: PhotoLinkType[] = ['before', 'after', 'evidence', 'reference', 'profile', 'other'];
    if (!validLinkTypes.includes(link_type)) {
      return badRequest(`link_type must be one of: ${validLinkTypes.join(', ')}`);
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

    // Validate work order if provided
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

    // Pre-validate all files before uploading any
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return badRequest(`File ${i + 1} (${file.name}): Only image files (JPEG, PNG, GIF, WebP, HEIC) are supported`);
      }

      if (file.size > MAX_FILE_SIZE) {
        return badRequest(`File ${i + 1} (${file.name}): File size must be less than 20MB`);
      }
    }

    // Process each file
    const results: BulkUploadResult[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const description = descriptions[i] || undefined;

      try {
        // Generate unique ID for this photo
        const photoId = crypto.randomUUID();
        const fileExtension = file.name.split('.').pop();
        const storagePath = `${user!.companyId}/${photoId}/${photoId}.${fileExtension}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('photos')
          .getPublicUrl(storagePath);

        if (!urlData?.publicUrl) {
          await supabase.storage.from('photos').remove([storagePath]);
          throw new Error('Failed to get file URL');
        }

        // Insert file record
        const { data: fileRecord, error: insertError } = await supabase
          .from('files')
          .insert({
            company_id: user!.companyId,
            uploaded_by: user!.id,
            bucket_id: 'photos',
            storage_path: storagePath,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            description: description,
            metadata: {
              link_type: link_type,
              bulk_upload: true,
              bulk_upload_index: i,
            },
            processing_status: 'uploaded',
          })
          .select()
          .single();

        if (insertError || !fileRecord) {
          await supabase.storage.from('photos').remove([storagePath]);
          throw new Error(`Database insert failed: ${insertError?.message}`);
        }

        // Link to equipment if needed
        if (validatedEquipmentId) {
          await supabase
            .from('equipment_files')
            .insert({
              equipment_id: validatedEquipmentId,
              file_id: fileRecord.id,
              link_type: link_type,
            });
        }

        // Link to work order if needed
        if (validatedWorkOrderId) {
          await supabase
            .from('work_order_files')
            .insert({
              work_order_id: validatedWorkOrderId,
              file_id: fileRecord.id,
              link_type: link_type,
            });
        }

        // Queue for background processing (scene analysis + indexing)
        await queuePhotoProcessing(
          supabase,
          fileRecord,
          urlData.publicUrl,
          user!.companyId,
          validatedEquipmentId,
          equipmentName,
          validatedWorkOrderId,
          workOrderTitle
        );

        results.push({
          photoId: fileRecord.id,
          displayId: fileRecord.metadata?.display_id,
          fileName: file.name,
          status: 'uploaded', // Will transition to analyzing shortly
        });
        successful++;

      } catch (error) {
        console.error(`[BulkPhotoUpload] Error processing file ${i + 1} (${file.name}):`, error);
        results.push({
          photoId: '',
          fileName: file.name,
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
 * Queue photo for background processing (scene analysis + indexing)
 * For bulk uploads, we queue immediately and let the worker handle everything
 */
async function queuePhotoProcessing(
  supabase: ReturnType<typeof createServiceRoleClient>,
  fileRecord: { id: string; metadata?: Record<string, unknown> },
  fileUrl: string,
  companyId: string,
  equipmentId: string | null,
  equipmentName: string | undefined,
  workOrderId: string | null,
  workOrderTitle: string | undefined
): Promise<void> {
  // Update status to analyzing (will start shortly)
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

  // Create a combined job that does scene analysis + indexing
  const processingParams: IndexContentParams = {
    type: 'photo',
    resourceId: fileRecord.id,
    companyId: companyId,
    fileUrl: fileUrl,
    metadata: {
      equipment_id: equipmentId || undefined,
      equipment_name: equipmentName,
      work_order_id: workOrderId || undefined,
      work_order_title: workOrderTitle,
      needs_analysis: true, // Flag for the worker to run scene analysis first
    },
  };

  // Queue immediately (no delay for bulk uploads)
  await contentQueue.add(processingParams, `photo-${fileRecord.id}`);
  console.log(`[BulkPhotoUpload] Photo queued for processing: ${fileRecord.id}`);
}
