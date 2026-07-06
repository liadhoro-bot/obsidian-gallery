'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: ReactNode
}

export default function PendingSubmitButton({
  children,
  className = '',
  disabled,
  pendingLabel = 'Loading...',
  name,
  value,
  type = 'submit',
  ...props
}: PendingSubmitButtonProps) {
  const { pending, data } = useFormStatus()
  const submittedValue = name ? data?.get(String(name)) : null
  const isActiveSubmit =
    pending && (!name || submittedValue === String(value ?? ''))

  return (
    <button
      {...props}
      type={type}
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={isActiveSubmit || undefined}
      className={`${className} disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/45 disabled:shadow-none`}
    >
      {isActiveSubmit ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{pendingLabel}</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}
