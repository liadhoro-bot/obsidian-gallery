export type GalleryUploadFailure = {
  fileName: string
  reason: string
}

export type GalleryUploadResult = {
  uploadedCount: number
  failed: GalleryUploadFailure[]
  uploadedImages?: {
    id: string
    image_url: string
    is_featured: boolean
    created_at: string
    sort_order: number | null
    alt_text: string | null
    storage_bucket: string | null
    storage_path: string | null
  }[]
}

export function validateGalleryImageFile(file: File) {
  if (file.size <= 0) {
    return 'File is empty.'
  }

  if (!file.type.startsWith('image/')) {
    return 'File must be an image.'
  }

  return null
}

export function getSafeImageExtension(fileName: string) {
  const rawExtension = fileName.split('.').pop() || 'jpg'
  return rawExtension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
}
