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

    // Insert into files table
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
        processing_status: 'uploaded'
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

    return NextResponse.json({ data: photoFile })
  } catch (error) {
    console.error('Error processing photo upload:', error)
    return NextResponse.json(
      { error: 'Failed to process photo' },
      { status: 500 }
    )
  }
}
