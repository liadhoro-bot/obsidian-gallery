const MAX_DOWNSCALE_DIMENSION = 2200
const DOWNSCALE_QUALITY = 0.82

export async function downscaleImageFile(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)

  try {
    const scale = Math.min(
      1,
      MAX_DOWNSCALE_DIMENSION / Math.max(bitmap.width, bitmap.height)
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Canvas is not supported in this browser.')
    }

    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', DOWNSCALE_QUALITY)
    )

    if (!blob) {
      throw new Error('Could not encode the downscaled image.')
    }

    const fileName = `${file.name.replace(/\.[^./\\]+$/, '')}.jpg`

    return new File([blob], fileName, { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}
