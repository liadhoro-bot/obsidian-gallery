'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { submitBugReport } from '../report-bug/actions'
import { captureScrollDiagnostics } from '@/utils/scroll-diagnostics'
import styles from './scrolling-help.module.css'

function subscribe(callback: () => void) {
  const media = matchMedia('(display-mode: standalone), (display-mode: fullscreen)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
function isInstalled() {
  return matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

// Temporary support control: stays outside inert navigation content and can be
// used without reaching a header or scrolling through the report form.
export default function ScrollingHelp() {
  const installed = useSyncExternalStore(subscribe, isInstalled, () => false)
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)
  if (!installed) return null

  function report() {
    const form = new FormData()
    form.set('buggedPage', location.pathname)
    form.set('description', 'Cannot scroll in the installed Home Screen app. Sent from the fixed scrolling help button.')
    try { form.set('scrollDiagnostics', captureScrollDiagnostics()) } catch { /* Send even if capture fails. */ }
    setError(false)
    startTransition(async () => {
      try {
        const result = await submitBugReport(form)
        setSent(result.ok)
        setError(!result.ok)
      } catch { setError(true) }
    })
  }

  return <div className={styles.help}>
    {sent ? <p role="status" className={styles.message}>Scroll report sent. Thank you.</p> : <>
      <button className={styles.button} type="button" onClick={report} disabled={pending}>
        {pending ? 'Sending scroll report…' : error ? 'Retry scroll report' : 'Report scrolling issue'}
      </button>
      {error ? <p role="alert" className={styles.message}>Could not send. Please retry.</p> : null}
    </>}
  </div>
}
