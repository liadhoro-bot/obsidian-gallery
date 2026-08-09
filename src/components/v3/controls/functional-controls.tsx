import type { InputHTMLAttributes, ReactNode } from 'react'

import type { OgSize } from '../types'
import { cx } from '../utils'
import styles from '../primitives.module.css'

export type OgFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  helpText?: ReactNode
  label: ReactNode
}

export function OgField({ className, helpText, id, label, ...props }: OgFieldProps) {
  const helpId = helpText && id ? `${id}-help` : undefined

  return (
    <label className={styles.fieldGroup}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        {...props}
        aria-describedby={helpId}
        className={cx(styles.fieldControl, className)}
        id={id}
      />
      {helpText ? (
        <span className={styles.fieldHelp} id={helpId}>
          {helpText}
        </span>
      ) : null}
    </label>
  )
}

export type OgSegmentedOption = {
  disabled?: boolean
  icon?: ReactNode
  label: ReactNode
  value: string
}

export type OgSegmentedControlProps = {
  ariaLabel: string
  className?: string
  onValueChange: (value: string) => void
  options: OgSegmentedOption[]
  size?: OgSize
  value: string
}

export function OgSegmentedControl({
  ariaLabel,
  className,
  onValueChange,
  options,
  size = 'default',
  value,
}: OgSegmentedControlProps) {
  return (
    <div aria-label={ariaLabel} className={cx(styles.segmentedControl, className)} role="group">
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            aria-pressed={selected}
            className={styles.segmentedButton}
            data-selected={selected}
            data-size={size}
            disabled={option.disabled}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            type="button"
          >
            {option.icon ? <span aria-hidden="true">{option.icon}</span> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

