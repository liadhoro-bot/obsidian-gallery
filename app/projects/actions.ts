'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import {
  getSafeImageExtension,
  validateGalleryImageFile,
} from '../../utils/images/gallery-upload'

export async function addProject(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = formData.get('name')?.toString().trim()
  const descriptionRaw = formData.get('description')?.toString().trim()
  const imageFile = formData.get('image')

  if (!name) {
    throw new Error('Project name is required')
  }

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert([
      {
        user_id: user.id,
        name,
        description: descriptionRaw || null,
      },
    ])
    .select('id')
    .single()

  if (error || !newProject) {
    throw new Error(error?.message || 'Failed to create project')
  }

  if (imageFile instanceof File && imageFile.size > 0) {
    const validationError = validateGalleryImageFile(imageFile)

    if (validationError) {
      throw new Error(validationError)
    }

    const fileExt = getSafeImageExtension(imageFile.name)
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const filePath = `projects/${newProject.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, imageFile, {
        contentType: imageFile.type,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data } = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    const publicUrl = data.publicUrl

    const { error: imageError } = await supabase.from('image_assets').insert({
      user_id: user.id,
      entity_type: 'project',
      entity_id: newProject.id,
      image_url: publicUrl,
      alt_text: name,
      is_featured: true,
      is_primary: true,
      storage_bucket: 'obsidian-images',
      storage_path: filePath,
    })

    if (imageError) {
      await supabase.storage.from('obsidian-images').remove([filePath])
      throw new Error(imageError.message)
    }
  }

  revalidatePath('/projects')

  redirect(`/projects/${newProject.id}`)
}
