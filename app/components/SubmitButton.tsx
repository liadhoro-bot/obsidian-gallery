'use client'

import { useFormStatus } from 'react-dom'

type SubmitButtonProps = {
  idleText: string
  pendingText?: string
  className?: string
  disabled?: boolean
}

export default function SubmitButton({
  idleText,
  pendingText = 'Saving...',
  className = '',
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={[
        'inline-flex items-center justify-center gap-2 transition active:scale-[0.98] active:opacity-70 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ].join(' ')}
    >
      {pending && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}

      <span>{pending ? pendingText : idleText}</span>
    </button>
  )
}