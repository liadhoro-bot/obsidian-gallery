import { MAX_GALLERY_IMAGE_BYTES } from './gallery-upload'
import { downscaleImageFile } from './downscale-image'

const MAX_GALLERY_IMAGE_MB = MAX_GALLERY_IMAGE_BYTES / (1024 * 1024)

export type ResolvedGallerySelection = {
  files: File[]
  error: string | null
}

// Camera photos routinely exceed MAX_GALLERY_IMAGE_BYTES, which is itself
// capped by the platform's request-body limit - so instead of just
// rejecting them, offer to downscale client-side and retry.
export async function resolveOversizedGalleryImages(
  files: File[]
): Promise<ResolvedGallerySelection> {
  const oversized = files.filter((file) => file.size > MAX_GALLERY_IMAGE_BYTES)

  if (oversized.length === 0) {
    return { files, error: null }
  }

  const confirmMessage =
    oversized.length === 1
      ? `This photo exceeds the ${MAX_GALLERY_IMAGE_MB}MB upload limit and should be downscaled to continue. Downscale and upload?`
      : `${oversized.length} photos exceed the ${MAX_GALLERY_IMAGE_MB}MB upload limit and should be downscaled to continue. Downscale and upload?`

  if (!window.confirm(confirmMessage)) {
    return { files: [], error: null }
  }

  const resolved: File[] = []

  for (const file of files) {
    if (file.size <= MAX_GALLERY_IMAGE_BYTES) {
      resolved.push(file)
      continue
    }

    try {
      const downscaled = await downscaleImageFile(file)

      if (downscaled.size > MAX_GALLERY_IMAGE_BYTES) {
        return {
          files: [],
          error: `Could not shrink "${file.name}" enough to upload. Try a smaller photo.`,
        }
      }

      resolved.push(downscaled)
    } catch {
      return {
        files: [],
        error: `Could not process "${file.name}". Try a different photo.`,
      }
    }
  }

  return { files: resolved, error: null }
}

// For forms whose submit reads image(s) straight off the <input>'s FileList
// (native `<form action>` server actions), rewrite the input's files in
// place so the resolved (possibly downscaled) file is what gets submitted.
export async function resolveImageInputSelection(
  input: HTMLInputElement
): Promise<{ file: File | null; error: string | null }> {
  const file = input.files?.[0] ?? null

  if (!file) {
    return { file: null, error: null }
  }

  const { files, error } = await resolveOversizedGalleryImages([file])

  if (error) {
    input.value = ''
    return { file: null, error }
  }

  const resolvedFile = files[0] ?? null

  if (!resolvedFile) {
    input.value = ''
    return { file: null, error: null }
  }

  if (resolvedFile !== file) {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(resolvedFile)
    input.files = dataTransfer.files
  }

  return { file: resolvedFile, error: null }
}
