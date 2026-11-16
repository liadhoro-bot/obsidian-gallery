import { MAX_GALLERY_IMAGE_BYTES } from './gallery-upload'
import { downscaleImageFile } from './downscale-image'

// Phone photos are routinely 3-6MB each. Vercel rejects request bodies over
// ~4.5MB before the Server Action runs, which the client only sees as "An
// unexpected response was received from the server." So shrink anything
// large before it leaves the device (no prompt - a 2200px JPEG is plenty for
// a gallery), and callers send one file per request.
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024

export async function prepareGalleryUploads(
  files: File[]
): Promise<{ files: File[]; failed: string[] }> {
  const prepared: File[] = []
  const failed: string[] = []

  for (const file of files) {
    if (file.size <= SHRINK_ABOVE_BYTES) {
      prepared.push(file)
      continue
    }

    try {
      const downscaled = await downscaleImageFile(file)
      const best = downscaled.size < file.size ? downscaled : file
      if (best.size > MAX_GALLERY_IMAGE_BYTES) {
        failed.push(`${file.name}: too large to upload`)
        continue
      }
      prepared.push(best)
    } catch {
      // The browser could not decode it (e.g. some HEIC files) - send the
      // original if it fits, otherwise report it.
      if (file.size <= MAX_GALLERY_IMAGE_BYTES) {
        prepared.push(file)
      } else {
        failed.push(`${file.name}: could not be processed`)
      }
    }
  }

  return { files: prepared, failed }
}
