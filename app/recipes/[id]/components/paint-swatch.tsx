type PaintSwatchPaint = {
  hex_approx: string | null
  swatch_image_url: string | null
  name?: string | null
}

export default function PaintSwatch({
  paint,
  size = 'md',
}: {
  paint: PaintSwatchPaint
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'sm' ? 'h-5 w-5 rounded-md' : 'h-6 w-6 rounded-md'

  return (
    <div
      className={`${sizeClass} overflow-hidden border border-neutral-700 bg-neutral-800`}
      title={paint.name || 'Paint'}
    >
      {paint.swatch_image_url ? (
        <img
          src={paint.swatch_image_url}
          alt={paint.name || 'Paint'}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="h-full w-full"
          style={{ backgroundColor: paint.hex_approx || '#888888' }}
        />
      )}
    </div>
  )
}