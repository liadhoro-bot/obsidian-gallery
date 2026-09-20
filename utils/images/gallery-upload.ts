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

// Vercel's serverless functions reject request bodies over ~4.5MB at the
// platform level, before our Server Action code (or its try/catch) ever
// runs - the client sees a generic "unexpected response" parse failure
// instead of a friendly message. Stay safely under that so oversized photos
// (especially camera captures) are rejected client-side with a clear reason.
export const MAX_GALLERY_IMAGE_BYTES = 4 * 1024 * 1024

export function getOversizedImageMessage() {
  return `Photo is too large. Please choose one under ${
    MAX_GALLERY_IMAGE_BYTES / (1024 * 1024)
  }MB.`
}

export function validateGalleryImageFile(file: File) {
  if (file.size <= 0) {
    return 'File is empty.'
  }

  if (!file.type.startsWith('image/')) {
    return 'File must be an image.'
  }

  if (file.size > MAX_GALLERY_IMAGE_BYTES) {
    return getOversizedImageMessage()
  }

  return null
}

export function getSafeImageExtension(fileName: string) {
  const rawExtension = fileName.split('.').pop() || 'jpg'
  return rawExtension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
}
