import type { SampledImageColor } from './types'

export function buildVaultColorMatchHref(
  sampleOrHex: SampledImageColor | string,
  params?: {
    brand?: string
    line?: string
    ownership?: string
  }
) {
  const hex = typeof sampleOrHex === 'string' ? sampleOrHex : sampleOrHex.hex
  const searchParams = new URLSearchParams()
  searchParams.set('tab', 'find')
  searchParams.set('matchHex', hex.toUpperCase())

  if (params?.brand) searchParams.set('brand', params.brand)
  if (params?.line) searchParams.set('line', params.line)
  if (params?.ownership && params.ownership !== 'all') {
    searchParams.set('ownership', params.ownership)
  }

  return `/vault?${searchParams.toString()}`
}
