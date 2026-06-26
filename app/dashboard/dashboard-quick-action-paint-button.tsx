'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { ReactNode } from 'react'

const PaintPickerDialog = dynamic(
  () => import('../../components/paints/paint-picker-dialog'),
  { ssr: false }
)

export default function DashboardQuickActionPaintButton({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  const [showPaintPicker, setShowPaintPicker] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPaintPicker(true)}
        className={className}
        aria-label="Build Your Collection. Track owned paints, wishlist colors, and missing supplies."
      >
        {children}
      </button>

      {showPaintPicker ? (
        <PaintPickerDialog
          open={showPaintPicker}
          onOpenChange={setShowPaintPicker}
          title="Build Your Collection"
          source="dashboard_quick_action"
          mode="collection"
        />
      ) : null}
    </>
  )
}
