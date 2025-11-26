import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/auth/helpers'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const workOrderId = formData.get('workOrderId') as string | null
    const equipmentId = formData.get('equipmentId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log('Photo upload started:', file.name, file.size, file.type)

    const supabase = await createServerClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    const filePath = `${user.companyId}/${fileName}`

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath)

    // Insert into files table with initial status
    const { data: photoFile, error: dbError } = await supabase
      .from('files')
      .insert({
        company_id: user.companyId,
        uploaded_by: user.id,
        bucket_id: 'photos',
        storage_path: filePath,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        processing_status: 'uploaded',
        metadata: {}
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB error:', dbError)
      // Try to clean up the uploaded file if DB insert fails
      await supabase.storage.from('photos').remove([filePath])
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 })
    }

    // Link to work order or equipment if provided
    if (workOrderId) {
      await supabase
        .from('work_order_files')
        .insert({
          work_order_id: workOrderId,
          file_id: photoFile.id,
          link_type: 'evidence' // Default, can be updated later
        })
    }

    if (equipmentId) {
      await supabase
        .from('equipment_files')
        .insert({
          equipment_id: equipmentId,
          file_id: photoFile.id,
          link_type: 'reference' // Default, can be updated later
        })
    }

    // Always analyze photos immediately (unified flow)
    // Backend handles RAG queuing - agent tool only fetches existing analysis
    try {
      const { parseImage } = await import('@/lib/parsers/image-parser');
      const { contentQueue } = await import('@/lib/queue/simple-queue');
      const { RAG_INDEX_DELAY_MS } = await import('@/lib/config/rag-config');
      
      // Update status to processing
      await supabase.from('files').update({ 
        processing_status: 'processing',
        metadata: {
          ...photoFile.metadata,
          processing_phase: 'vision_analysis',
        },
      }).eq('id', photoFile.id);

      // Analyze photo
      const analysisDescription = await parseImage(publicUrl);
      
      if (analysisDescription) {
        const ragQueuedAt = new Date();
        
        // Update with analysis and queue metadata
        await supabase.from('files').update({
          description: analysisDescription,
          processing_status: 'processing',
          metadata: {
            ...photoFile.metadata,
            processing_phase: 'rag_queued',
            scene_analysis: analysisDescription,
            vision_analyzed_at: new Date().toISOString(),
            rag_queued_at: ragQueuedAt.toISOString(),
          },
        }).eq('id', photoFile.id);

        // Queue for RAG indexing with delay
        const indexParams = {
          type: 'photo' as const,
          resourceId: photoFile.id,
          companyId: user.companyId,
          content: analysisDescription,
          metadata: {
            equipment_id: equipmentId || undefined,
            work_order_id: workOrderId || undefined,
          },
        };

        await contentQueue.add(indexParams, `photo-${photoFile.id}`, RAG_INDEX_DELAY_MS);
        console.log(`[Upload] Photo analyzed and queued for RAG (delay: ${RAG_INDEX_DELAY_MS}ms)`);
      } else {
        await supabase.from('files').update({ processing_status: 'failed' }).eq('id', photoFile.id);
      }
    } catch (error) {
      console.error('[Upload] Photo analysis failed:', error);
      await supabase.from('files').update({ processing_status: 'failed' }).eq('id', photoFile.id);
    }

    return NextResponse.json({ data: photoFile })
  } catch (error) {
    console.error('Error processing photo upload:', error)
    return NextResponse.json(
      { error: 'Failed to process photo' },
      { status: 500 }
    )
  }
}
