'use client'

import Image from 'next/image'
import type {
  ButtonHTMLAttributes,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import { cx } from '../utils'
import styles from './og-dialog.module.css'

/*
 * OgDialog - a centered modal on parchment, the same materials as Paint Mode's
 * sheets. The rest of the app is dimmed behind it. Title and close are
 * required; subtitle, image, fields, checkbox and actions are all optional.
 *
 *   <OgDialog open={open} onClose={close} title="Schedule Painting Session"
 *     subtitle="Plan your next painting time." image={{ src, alt: '' }}
 *     onSubmit={save}
 *     actions={<OgDialogAction type="submit" icon={<CalendarPlus />}>Schedule Session</OgDialogAction>}>
 *     <OgDialogRow>
 *       <OgDialogField label="Date & Time" type="datetime-local" ... />
 *       <OgDialogSelect label="Duration" ...>...</OgDialogSelect>
 *     </OgDialogRow>
 *     <OgDialogCheckbox label="Add to my painting schedule" description="..." />
 *   </OgDialog>
 */

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function CloseGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

function ChevronDownGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export type OgDialogImage = {
  src: string
  alt: string
  /** CSS object-position, e.g. "50% 30%". Defaults to center. */
  position?: string
}

export type OgDialogProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  image?: OgDialogImage
  /** Fields, checkbox, or any body content. */
  children?: ReactNode
  /** Usually one or two OgDialogAction buttons, stacked full width. */
  actions?: ReactNode
  /** When set, the body is a <form> so Enter submits and type="submit" actions work. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  /** Accessible name of the X button. */
  closeLabel?: string
  /** Backdrop click and Escape close by default; turn off while saving. */
  dismissible?: boolean
  size?: 'default' | 'wide'
  className?: string
}

export function OgDialog({
  open,
  onClose,
  title,
  subtitle,
  image,
  children,
  actions,
  onSubmit,
  closeLabel = 'Close',
  dismissible = true,
  size = 'default',
  className,
}: OgDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const subtitleId = useId()
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)

  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  })

  useEffect(() => {
    if (!open) return
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    // First field if there is one, otherwise the X - never the CTA, so Enter can't fire it by accident.
    const firstField = panel?.querySelector<HTMLElement>('input:not([type="checkbox"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
    ;(firstField ?? closeRef.current)?.focus({ preventScroll: true })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      returnFocus?.focus({ preventScroll: true })
    }
  }, [open])

  // Dialogs open from a user action, so this only renders in the browser. Don't pass open={true} on first render.
  if (!open || typeof document === 'undefined') return null

  const body = (
    <>
      <header className={styles.head}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        {subtitle ? <p id={subtitleId} className={styles.subtitle}>{subtitle}</p> : null}
      </header>
      {image ? (
        <div className={styles.imageMount}>
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 520px) 92vw, 460px"
            className={styles.image}
            style={image.position ? { objectPosition: image.position } : undefined}
          />
        </div>
      ) : null}
      {children ? <div className={styles.content}>{children}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </>
  )

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={cx(styles.panel, className)}
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
      >
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          onClick={onClose}
          disabled={!dismissible}
          aria-label={closeLabel}
        >
          <CloseGlyph />
        </button>
        {onSubmit ? (
          <form className={styles.scroll} onSubmit={onSubmit}>
            {body}
          </form>
        ) : (
          <div className={styles.scroll}>{body}</div>
        )}
      </div>
    </div>,
    document.body
  )
}

/** Two fields side by side; stacks on narrow phones. */
export function OgDialogRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>
}

type FieldChrome = {
  label: ReactNode
  icon?: ReactNode
  /** Quiet "(Optional)" style suffix after the label. */
  labelNote?: ReactNode
  hint?: ReactNode
}

function FieldLabel({ htmlFor, label, icon, labelNote }: FieldChrome & { htmlFor: string }) {
  return (
    <label className={styles.fieldLabel} htmlFor={htmlFor}>
      {icon ? <span className={styles.fieldIcon} aria-hidden="true">{icon}</span> : null}
      <span>
        {label}
        {labelNote ? <span className={styles.fieldLabelNote}> {labelNote}</span> : null}
      </span>
    </label>
  )
}

export type OgDialogFieldProps = InputHTMLAttributes<HTMLInputElement> & FieldChrome

export function OgDialogField({ label, icon, labelNote, hint, id, className, ...props }: OgDialogFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const hintId = hint ? `${fieldId}-hint` : undefined
  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={fieldId} label={label} icon={icon} labelNote={labelNote} />
      <input {...props} id={fieldId} aria-describedby={hintId} className={cx(styles.control, className)} />
      {hint ? <p id={hintId} className={styles.fieldHint}>{hint}</p> : null}
    </div>
  )
}

export type OgDialogTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldChrome

export function OgDialogTextArea({ label, icon, labelNote, hint, id, className, ...props }: OgDialogTextAreaProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const hintId = hint ? `${fieldId}-hint` : undefined
  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={fieldId} label={label} icon={icon} labelNote={labelNote} />
      <textarea {...props} id={fieldId} aria-describedby={hintId} className={cx(styles.control, styles.textArea, className)} />
      {hint ? <p id={hintId} className={styles.fieldHint}>{hint}</p> : null}
    </div>
  )
}

export type OgDialogSelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldChrome

export function OgDialogSelect({ label, icon, labelNote, hint, id, className, children, ...props }: OgDialogSelectProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const hintId = hint ? `${fieldId}-hint` : undefined
  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={fieldId} label={label} icon={icon} labelNote={labelNote} />
      <span className={styles.selectWrap}>
        <select {...props} id={fieldId} aria-describedby={hintId} className={cx(styles.control, styles.select, className)}>
          {children}
        </select>
        <span className={styles.selectChevron} aria-hidden="true"><ChevronDownGlyph /></span>
      </span>
      {hint ? <p id={hintId} className={styles.fieldHint}>{hint}</p> : null}
    </div>
  )
}

export type OgDialogCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode
  description?: ReactNode
}

export function OgDialogCheckbox({ label, description, id, className, ...props }: OgDialogCheckboxProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <label className={cx(styles.checkRow, className)} htmlFor={fieldId}>
      <input {...props} id={fieldId} type="checkbox" className={styles.checkInput} />
      <span className={styles.checkBox} aria-hidden="true"><CheckGlyph /></span>
      <span className={styles.checkText}>
        <span className={styles.checkLabel}>{label}</span>
        {description ? <span className={styles.checkDescription}>{description}</span> : null}
      </span>
    </label>
  )
}

export type OgDialogActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  icon?: ReactNode
  loading?: boolean
}

export function OgDialogAction({
  variant = 'primary',
  icon,
  loading = false,
  type = 'button',
  disabled,
  className,
  children,
  ...props
}: OgDialogActionProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx(styles.action, className)}
      data-variant={variant}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {icon ? <span className={styles.actionIcon} aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  )
}
