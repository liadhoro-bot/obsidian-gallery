export default function BallotBar({
  selectedCount,
  minimum,
  maximum,
  exact,
  disabled,
}: {
  selectedCount: number
  minimum: number
  maximum: number
  exact: boolean
  disabled?: boolean
}) {
  const label = exact
    ? `${selectedCount} of ${maximum} selected`
    : `${selectedCount} selected, ${minimum}-${maximum} allowed`

  return (
    <div className="sticky bottom-20 z-20 rounded-2xl border border-cyan-300/30 bg-[#061018]/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-white">{label}</span>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/35"
        >
          Submit Ballot
        </button>
      </div>
    </div>
  )
}
