'use client'

import { useActionState, useState } from 'react'
import SubmitButton from '../components/SubmitButton'
import {
  updateUsernameAction,
  type UpdateUsernameState,
} from './settings-actions'

const initialState: UpdateUsernameState = {
  error: null,
}

export default function SettingsProfileEditor({
  username,
}: {
  username: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const [state, formAction] = useActionState(updateUsernameAction, initialState)
  const errorMessage = clientError || state.error

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="mt-5 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-slate-100"
      >
        Edit Profile
      </button>
    )
  }

  return (
    <form
      action={formAction}
      className="mt-5 w-full space-y-3"
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget)
        const nextUsername = String(formData.get('username') || '')
          .trim()
          .replace(/^@/, '')

        if (!nextUsername) {
          event.preventDefault()
          setClientError('Username cannot be empty.')
        }
      }}
    >
      <input
        name="username"
        defaultValue={username === 'No username yet' ? '' : username}
        placeholder="Choose a username"
        required
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={errorMessage ? 'username-error' : undefined}
        onChange={() => setClientError(null)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60"
      />

      {errorMessage ? (
        <p id="username-error" className="text-sm font-medium text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-slate-300"
        >
          Cancel
        </button>

        <SubmitButton
          idleText="Save"
          pendingText="Saving..."
          className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950"
        />
      </div>
    </form>
  )
}
