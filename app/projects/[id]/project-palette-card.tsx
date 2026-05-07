export default function ProjectPaletteCard() {
  const paletteSwatches = [
    { name: 'Bone', hex: '#d8c9a3' },
    { name: 'Shadow', hex: '#3f4852' },
    { name: 'Bronze', hex: '#9b6a36' },
    { name: 'Verdigris', hex: '#4fae9b' },
    { name: 'Rim', hex: '#1f2933' },
  ]

  return (
    <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <p className="text-sm uppercase tracking-wider text-cyan-400">
        Project Palette
      </p>
      <h2 className="mt-1 text-xl font-semibold">Main Colors</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Placeholder palette for now. Later this can pull paints from units and recipes.
      </p>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {paletteSwatches.map((paint) => (
          <div key={paint.name} className="min-w-0">
            <div
              className="aspect-square rounded-xl border border-white/10 shadow-inner"
              style={{ backgroundColor: paint.hex }}
            />
            <p className="mt-1 truncate text-center text-[10px] font-semibold text-white/60">
              {paint.name}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}