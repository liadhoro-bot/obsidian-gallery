'use client'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

export default function RecipeSearchBar({ value, onChange, placeholder }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <span className="text-xl text-white/60">⌕</span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
      />

      <span className="border-l border-white/10 pl-3 text-white/60">≡</span>
    </div>
  )
}