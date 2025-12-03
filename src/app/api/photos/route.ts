/**
 * POST /api/photos - Upload a new photo
 * GET /api/photos - List photos with filtering
 * 
 * Authorization: 
 * - Upload: Authenticated users (admin, editor can upload)
 * - List: All authenticated users can view their company's photos
 * 
 * Note: Photo upload includes file handling to Supabase Storage and background OCR/Vision analysis
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, forbidden } from '@/lib/auth/middleware';
import * as helpers from '@/lib/auth/helpers';
import { parseImage } from '@/lib/parsers/image-parser';
import { contentQueue } from '@/lib/queue/simple-queue';
import type { IndexContentParams } from '@/mastra/services/rag';

// Photo-specific types (matching design doc)
export type PhotoLinkType = 'before' | 'after' | 'evidence' | 'reference' | 'profile' | 'other';

export interface Photo {
  id: string;
  company_id: string;
  equipment_id?: string;
  work_order_id?: string;
  display_id: string;
  description?: string;
  file_url: string;
  file_size: number;
  link_type?: PhotoLinkType;
  status: 'uploaded' | 'analyzing' | 'indexing' | 'ready' | 'failed';
  created_at: string;
  updated_at: string;
  // Optional relations
  equipment?: {
    id: string;
    display_id: string;
    name: string;
  };
  work_order?: {
    id: string;
    display_id: string;
    title: string;
  };
}

export interface PhotoListFilters {
  equipment_id?: string;
  work_order_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PhotoListResponse {
  data: Photo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: PhotoListFilters;
}

// =============================================
// GET - List Photos
// =============================================

export const GET = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const filters: PhotoListFilters = {
      equipment_id: searchParams.get('equipment_id') || undefined,
      work_order_id: searchParams.get('work_order_id') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: Math.min(parseInt(searchParams.get('limit') || '25', 10), 100),
    };

    const supabase = createServiceRoleClient();

    // Build base query
    let query = supabase
      .from('files')
      .select(`
        *,
        equipment_files:equipment_files (
          link_type,
          equipment:equipment (
            id,
            display_id,
            name
          )
        ),
        work_order_files:work_order_files (
          link_type,
          work_order:work_orders (
            id,
            display_id,
            title
          )
        )
      `, { count: 'exact' })
      .eq('company_id', user!.companyId)
      .eq('bucket_id', 'photos');

    // Apply filters
    if (filters.equipment_id) {
      query = query.eq('equipment_files.equipment_id', filters.equipment_id);
    }

    if (filters.work_order_id) {
      query = query.eq('work_order_files.work_order_id', filters.work_order_id);
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
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
      console.error('Error listing photos:', error);
      return badRequest(error.message);
    }

    // Map files to Photo type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photos: Photo[] = (data || []).map((file: any) => {
      const equipmentLink = file.equipment_files?.[0];
      const workOrderLink = file.work_order_files?.[0];
      const equipment = equipmentLink?.equipment;
      const workOrder = workOrderLink?.work_order;
      const metadata = file.metadata || {};

      return {
        id: file.id,
        company_id: file.company_id,
        equipment_id: equipment?.id,
        work_order_id: workOrder?.id,
        display_id: metadata.display_id || file.id,
        description: file.description,
        file_url: file.file_url,
        file_size: file.file_size,
        link_type: equipmentLink?.link_type || workOrderLink?.link_type,
        status: file.processing_status,
        created_at: file.created_at,
        updated_at: file.updated_at,
        equipment: equipment ? {
          id: equipment.id,
          display_id: equipment.display_id,
          name: equipment.name
        } : undefined,
        work_order: workOrder ? {
          id: workOrder.id,
          display_id: workOrder.display_id,
          title: workOrder.title
        } : undefined
      };
    });

    const response: PhotoListResponse = {
      data: photos,
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
// POST - Upload Photo
// =============================================

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

    // Extract fields
    const description = formData.get('description') as string | null;
    const link_type = formData.get('link_type') as PhotoLinkType | null;
    const equipment_id = formData.get('equipment_id') as string | null;
    const work_order_id = formData.get('work_order_id') as string | null;
    const uploadedFile = formData.get('file') as File | null;

    // Validate file
    if (!uploadedFile) {
      return badRequest('File is required');
    }

    // Validate file type (images only)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic'
    ];
    if (!allowedMimeTypes.includes(uploadedFile.type)) {
      return badRequest('Only image files (JPEG, PNG, GIF, WebP, HEIC) are supported');
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (uploadedFile.size > maxSize) {
      return badRequest('File size must be less than 20MB');
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

    // Upload file to Supabase Storage
    // Storage path: photos/{company_id}/{photo_id}/{filename}
    const tempPhotoId = crypto.randomUUID();
    const fileExtension = uploadedFile.name.split('.').pop();
    const storagePath = `${user!.companyId}/${tempPhotoId}/${tempPhotoId}.${fileExtension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
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
      .from('photos')
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) {
      // Cleanup uploaded file
      await supabase.storage.from('photos').remove([storagePath]);
      return badRequest('Failed to get file URL');
    }

    // Note: No AI analysis here by default - agent will analyze via tool
    // If analyzeImmediately is set, we analyze after upload
    const metadata = {
      // display_id will be generated by trigger
    };

    // Use user-provided description if any
    const initialDescription = description || null;

    // Insert file record
    const { data: fileRecord, error: insertError } = await supabase
      .from('files')
      .insert({
        company_id: user!.companyId,
        uploaded_by: user!.id,
        bucket_id: 'photos',
        storage_path: storagePath,
        file_url: urlData.publicUrl,
        file_name: uploadedFile.name,
        file_type: uploadedFile.type,
        file_size: uploadedFile.size,
        description: initialDescription,
        metadata: metadata,
        processing_status: 'uploaded', // Will be updated if analyzeImmediately is set
      })
      .select()
      .single();

    if (insertError || !fileRecord) {
      console.error('Error creating file record:', insertError);
      // Cleanup uploaded file
      await supabase.storage.from('photos').remove([storagePath]);
      return badRequest(insertError?.message || 'Failed to create photo record');
    }

    // Link to equipment if needed
    if (validatedEquipmentId) {
      const { error: linkError } = await supabase
        .from('equipment_files')
        .insert({
          equipment_id: validatedEquipmentId,
          file_id: fileRecord.id,
          link_type: link_type || 'reference',
        });

      if (linkError) {
        console.error('Error linking photo to equipment:', linkError);
        // Don't fail the whole request, but log it
      }
    }

    // Link to work order if needed
    if (validatedWorkOrderId) {
      const { error: linkError } = await supabase
        .from('work_order_files')
        .insert({
          work_order_id: validatedWorkOrderId,
          file_id: fileRecord.id,
          link_type: link_type || 'evidence',
        });

      if (linkError) {
        console.error('Error linking photo to work order:', linkError);
        // Don't fail the whole request, but log it
      }
    }

    // Always analyze photos immediately (unified flow for agent and data hub)
    // Backend handles RAG queuing - agent tool only fetches/updates analysis
    let finalStatus: 'uploaded' | 'analyzing' | 'indexing' | 'ready' | 'failed' = 'uploaded';
    let finalDescription = fileRecord.description;

    console.log(`[Upload] Analyzing photo immediately: ${fileRecord.id}`);
    
    try {
      // Update status to analyzing (scene analysis phase)
      await supabase.from('files').update({ 
        processing_status: 'analyzing',
        metadata: {
          ...fileRecord.metadata,
          processing_phase: 'vision_analysis',
        },
      }).eq('id', fileRecord.id);
      finalStatus = 'analyzing';

      // Call parseImage to analyze the photo
      const analysisDescription = await parseImage(urlData.publicUrl);
      
      if (analysisDescription) {
        const ragQueuedAt = new Date();
        
        // Update file record with AI description and transition to indexing status
        finalDescription = analysisDescription;
        finalStatus = 'indexing';
        await supabase.from('files').update({
          description: analysisDescription,
          processing_status: 'indexing', // Scene analysis complete, now queued for RAG
          metadata: {
            ...fileRecord.metadata,
            processing_phase: 'rag_queued',
            scene_analysis: analysisDescription,
            vision_analyzed_at: new Date().toISOString(),
            rag_queued_at: ragQueuedAt.toISOString(),
          },
        }).eq('id', fileRecord.id);

        // Queue for RAG indexing with delay
        // Delay allows time for metadata updates (equipment/work order links) before indexing
        const indexParams: IndexContentParams = {
          type: 'photo',
          resourceId: fileRecord.id,
          companyId: user!.companyId,
          content: analysisDescription, // Use pre-extracted description
          metadata: {
            equipment_id: validatedEquipmentId || undefined,
            equipment_name: equipmentName || undefined,
            work_order_id: validatedWorkOrderId || undefined,
            work_order_title: workOrderTitle || undefined,
            link_type: link_type || 'reference',
          },
        };

        await contentQueue.add(indexParams, `photo-${fileRecord.id}`);
        console.log(`[Upload] Photo queued for immediate RAG indexing: ${fileRecord.id}`);
        
        // RAG will update status to 'ready' when complete
      } else {
        // Analysis returned empty description
        console.warn(`[Upload] Photo analysis returned empty for: ${fileRecord.id}`);
        await supabase.from('files').update({ processing_status: 'failed' }).eq('id', fileRecord.id);
        finalStatus = 'failed';
      }
    } catch (analysisError) {
      console.error(`[Upload] Photo analysis failed for ${fileRecord.id}:`, analysisError);
      await supabase.from('files').update({ processing_status: 'failed' }).eq('id', fileRecord.id);
      finalStatus = 'failed';
      // Don't throw - photo is still uploaded, just not analyzed
    }
    
    console.log(`[Upload] Photo uploaded successfully: ${fileRecord.id}, status: ${finalStatus}`);

    // Construct response
    const responsePhoto: Photo = {
      id: fileRecord.id,
      company_id: fileRecord.company_id,
      equipment_id: validatedEquipmentId || undefined,
      work_order_id: validatedWorkOrderId || undefined,
      display_id: fileRecord.metadata?.display_id || fileRecord.id,
      description: finalDescription || undefined,
      file_url: fileRecord.file_url,
      file_size: fileRecord.file_size,
      link_type: link_type || undefined,
      status: finalStatus,
      created_at: fileRecord.created_at,
      updated_at: fileRecord.updated_at,
      equipment: validatedEquipmentId ? {
        id: validatedEquipmentId,
        display_id: '',
        name: equipmentName || ''
      } : undefined,
      work_order: validatedWorkOrderId ? {
        id: validatedWorkOrderId,
        display_id: '',
        title: workOrderTitle || ''
      } : undefined
    };

    return success<Photo>(responsePhoto, 201);
  });
