'use client'

import { useState, useTransition } from 'react'
import { submitFeedback } from './support-actions'
import styles from '../settings-support-silver.module.css'

export default function FeedbackCard() {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await submitFeedback(formData)
      setMessage('')
      setSuccess(true)
      setIsOpen(false)
    })
  }

  return (
    <section className={styles.card}>
      <div className={styles.feedbackHeader}>
        <div className={styles.paymentIcon}>
          FB
        </div>

        <div>
          <h2 className={styles.paymentTitle}>Give feedback</h2>
          <p className={styles.paymentCopy}>
            You can also support the app tremendously by sharing feedback.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setIsOpen((value) => !value)
          setSuccess(false)
        }}
        className={styles.feedbackButton}
      >
        Give us feedback
      </button>

      {success && (
        <p className={styles.feedbackMessage}>
          Thank you — your feedback was sent ❤️
        </p>
      )}

      {isOpen && (
        <form action={handleSubmit} className={styles.feedbackForm}>
          <label className={styles.fieldLabel}>
            Tell us what works well or what we can improve in the app:
          </label>

          <textarea
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            rows={5}
            className={styles.textarea}
            placeholder="Write your feedback here..."
          />

          <button
            type="submit"
            disabled={isPending || !message.trim()}
            className={styles.primaryButton}
          >
            {isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            <span>{isPending ? 'Sending...' : 'Send feedback'}</span>
          </button>
        </form>
      )}
    </section>
  )
}
