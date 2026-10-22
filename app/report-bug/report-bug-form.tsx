'use client'

import { useState, useTransition } from 'react'
import { submitBugReport, type ReportBugResult } from './actions'
import styles from './report-bug.module.css'
import { captureScrollDiagnostics, readScrollDiagnostics } from '@/utils/scroll-diagnostics'

export default function ReportBugForm({
  initialPage,
}: {
  initialPage: string
}) {
  const [buggedPage, setBuggedPage] = useState(initialPage)
  const [description, setDescription] = useState('')
  const [result, setResult] = useState<ReportBugResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)

  function handleSubmit(formData: FormData) {
    if (includeDiagnostics) {
      try { formData.set('scrollDiagnostics', readScrollDiagnostics() || captureScrollDiagnostics()) } catch { /* Send the report even if diagnostics fail. */ }
    }
    startTransition(async () => {
      const nextResult = await submitBugReport(formData)
      setResult(nextResult)

      if (nextResult.ok) {
        setDescription('')
      }
    })
  }

  return (
    <form action={handleSubmit} className={styles.form}>
      <label className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Bugged page</span>
        <input
          name="buggedPage"
          value={buggedPage}
          onChange={(event) => setBuggedPage(event.target.value)}
          required
          className={styles.input}
          placeholder="/projects, /dashboard?tab=profile..."
        />
      </label>

      <label className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Description</span>
        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          rows={7}
          className={styles.textarea}
          placeholder="What happened? What did you expect instead?"
        />
      </label>

      <label className={styles.fieldGroup}>
        <span><input type="checkbox" checked={includeDiagnostics} onChange={event => setIncludeDiagnostics(event.target.checked)} /> Include device and scrolling details</span>
        <span className={styles.fieldLabel}>Includes the app address, software version and page layout. Excludes page text and form entries.</span>
      </label>

      {result ? (
        <p
          className={[
            styles.message,
            result.ok ? styles.messageSuccess : styles.messageError,
          ].join(' ')}
        >
          {result.ok
            ? 'Bug report sent. Thank you.'
            : result.error ?? 'Could not send the bug report.'}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !buggedPage.trim() || !description.trim()}
        className={`tap-press tap-target ${styles.submitButton}`}
      >
        {isPending ? <span className={styles.spinner} /> : null}
        <span>{isPending ? 'Sending...' : 'Send bug report'}</span>
      </button>
    </form>
  )
}
