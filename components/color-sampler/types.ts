'use client'

export type ColorSamplerSource =
  | 'vault_upload'
  | 'vault_camera'
  | 'project_gallery'
  | 'unit_gallery'
  | 'recipe_gallery'
  | 'theme_gallery'
  | 'unit_stage'

export type SampledImageColor = {
  hex: string
  rgb: {
    r: number
    g: number
    b: number
  }
  imagePosition: {
    x: number
    y: number
  }
  normalizedPosition: {
    x: number
    y: number
  }
  sampleRadius: number
}

export type ColorSamplerImageSource = {
  src: string
  alt?: string
}

export type ColorSamplerStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'

export type CanvasImageMetrics = {
  canvasWidth: number
  canvasHeight: number
  imageWidth: number
  imageHeight: number
  renderedLeft: number
  renderedTop: number
  renderedWidth: number
  renderedHeight: number
}
