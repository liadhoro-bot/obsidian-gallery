'use client'

import dynamic from 'next/dynamic'

type Props = {
  tab: 'find' | 'collection'
  q: string
  brand: string
  line: string
  ownership: string
  matchHex?: string
}

function ToolbarButtonSkeleton({
  label,
  tone = 'default',
}: {
  label: string
  tone?: 'default' | 'accent'
}) {
  return (
    <button
      type="button"
      disabled
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] opacity-80 sm:px-4',
        tone === 'accent'
          ? 'border border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
          : 'border border-white/10 bg-white/5 text-white/75',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

const VaultBatchActions = dynamic(() => import('./vault-batch-actions'), {
  ssr: false,
  loading: () => <ToolbarButtonSkeleton label="Batch Actions" />,
})

const VaultExportButton = dynamic(() => import('./vault-export-button'), {
  ssr: false,
  loading: () => <ToolbarButtonSkeleton label="Export List" tone="accent" />,
})

export default function VaultGridToolbar(props: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <VaultBatchActions {...props} />
      <VaultExportButton {...props} />
    </div>
  )
}
