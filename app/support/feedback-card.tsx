'use client'

import { useState, useTransition } from 'react'
import { submitFeedback } from './support-actions'

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
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-400 text-xs font-black text-slate-950">
          FB
        </div>

        <div>
          <h2 className="font-semibold">Give feedback</h2>
          <p className="text-xs text-slate-400">
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
        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-violet-400 px-4 py-4 text-sm font-bold text-slate-950 shadow-lg shadow-black/20 transition hover:bg-violet-300"
      >
        Give us feedback
      </button>

      {success && (
        <p className="mt-3 text-center text-xs text-violet-200">
          Thank you — your feedback was sent ❤️
        </p>
      )}

      {isOpen && (
        <form action={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-300">
            Tell us what works well or what we can improve in the app:
          </label>

          <textarea
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            rows={5}
            className="w-full rounded-2xl border border-white/10 bg-[#061018] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-300/60"
            placeholder="Write your feedback here..."
          />

          <button
            type="submit"
            disabled={isPending || !message.trim()}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-violet-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Sending...' : 'Send feedback'}
          </button>
        </form>
      )}
    </section>
  )
}