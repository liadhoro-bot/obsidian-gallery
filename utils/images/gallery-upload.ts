export type GalleryUploadFailure = {
  fileName: string
  reason: string
}

export type GalleryUploadResult = {
  uploadedCount: number
  failed: GalleryUploadFailure[]
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
