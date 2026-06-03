'use client'

import type { MouseEvent, ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

type SubmitButtonProps = {
  idleText: string
  pendingText?: string
  className?: string
  disabled?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  leadingIcon?: ReactNode
}

export default function SubmitButton({
  idleText,
  pendingText = 'Saving...',
  className = '',
  disabled = false,
  onClick,
  leadingIcon,
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center gap-2 transition active:scale-[0.98] active:opacity-70 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70 disabled:shadow-none',
        className,
      ].join(' ')}
    >
      {pending && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}

      {!pending && leadingIcon ? leadingIcon : null}

      <span>{pending ? pendingText : idleText}</span>
    </button>
  )
}
