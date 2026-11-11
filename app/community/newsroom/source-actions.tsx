'use client'

import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { useState, useTransition } from 'react'
import styles from '../news/news.module.css'
import { runSourceNow, setSourceEnabled } from './inbox-actions'

type Message = { tone: 'error' | 'success'; text: string }

export default function SourceActions({ sourceId, enabled }: { sourceId: string; enabled: boolean }) {
  const router = useRouter()
  const [message, setMessage] = useState<Message | null>(null)
  const [isPending, startTransition] = useTransition()

  function runNow() {
    setMessage({ tone: 'success', text: 'Collecting… this can take up to a minute.' })
    startTransition(async () => {
      const result = await runSourceNow(sourceId)
      setMessage(
        result.ok
          ? { tone: 'success', text: result.message ?? 'Done.' }
          : { tone: 'error', text: result.error }
      )
      router.refresh()
    })
  }

  function toggle() {
    setMessage(null)
    startTransition(async () => {
      const result = await setSourceEnabled(sourceId, !enabled)
      if (!result.ok) setMessage({ tone: 'error', text: result.error })
      router.refresh()
    })
  }

  return (
    <>
      {message ? (
        <p className={styles.editorMessage} data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}
      <div className={styles.inboxActions}>
        {enabled ? (
          <button type="button" className={styles.primaryAction} disabled={isPending} onClick={runNow}>
            Collect now
          </button>
        ) : null}
        <button
          type="button"
          className={enabled ? styles.dangerAction : styles.secondaryAction}
          disabled={isPending}
          onClick={toggle}
        >
          {enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>
    </>
  )
}
