'use client'

import { useRef, useState, useTransition } from 'react'

type ReportResult = {
  status: 'reported' | 'duplicate'
  message: string
}

type Props = {
  contentId: string
  contentType: 'recipe' | 'theme'
  viewerHasReported: boolean
  reportAction: (contentId: string, reason?: string) => Promise<ReportResult>
  onReported: (reported: boolean) => void
}

export default function ReportDialog({
  contentId,
  contentType,
  viewerHasReported,
  reportAction,
  onReported,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState(
    viewerHasReported ? 'Reported' : ''
  )
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()
  const reportInFlight = useRef(false)

  function submitReport() {
    if (reportInFlight.current) return

    setError('')
    setMessage('Thank you, report received.')
    setIsOpen(false)
    onReported(true)
    reportInFlight.current = true

    startTransition(async () => {
      try {
        const result = await reportAction(contentId, reason)
        setMessage(result.message)
      } catch (submitError) {
        setMessage('')
        setIsOpen(true)
        onReported(false)
        setError(
          submitError instanceof Error
            ? submitError.message
            : 'Could not submit report.'
        )
      } finally {
        reportInFlight.current = false
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!viewerHasReported) setIsOpen(true)
        }}
        className={[
          'inline-flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] transition active:scale-[0.98]',
          viewerHasReported
            ? 'text-amber-200'
            : 'text-white/40 hover:text-white/70',
        ].join(' ')}
        aria-label={`Report ${contentType}`}
      >
        <FlagIcon />
        <span>{viewerHasReported ? 'Reported' : 'Report'}</span>
      </button>

      {message ? (
        <span className="self-center text-xs font-medium text-white/45">
          {message}
        </span>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#101820] p-4 text-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="report-dialog-title" className="text-base font-bold">
                  Report {contentType}
                </h2>
                <p className="mt-1 text-sm leading-5 text-white/55">
                  Send this to the admin team for review.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-white/70"
              >
                Close
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium text-white/75">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Optional"
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/50"
            />

            {error ? (
              <p className="mt-3 text-sm text-red-300">{error}</p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={submitReport}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-neutral-950 transition disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60"
              >
                Submit report
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function FlagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M4 21V5" />
      <path d="M4 5c4-3 8 2 12 0v10c-4 2-8-3-12 0" />
    </svg>
  )
}
