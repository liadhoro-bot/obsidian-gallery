'use client'

import { useActionState, useState } from 'react'
import SubmitButton from '../components/SubmitButton'
import {
  updateProfileAction,
  type UpdateProfileState,
} from './settings-actions'

const initialState: UpdateProfileState = {
  error: null,
  message: null,
}

export default function SettingsProfileEditor({
  email,
  username,
}: {
  email: string
  username: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const [state, formAction] = useActionState(updateProfileAction, initialState)
  const errorMessage = clientError || state.error
  const messageId = errorMessage ? 'profile-error' : 'profile-message'
  const currentUsername = username === 'No username yet' ? '' : username
  const currentEmail = email.trim()

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
        const nextEmail = String(formData.get('email') || '').trim()

        if (!nextUsername) {
          event.preventDefault()
          setClientError('Username cannot be empty.')
          return
        }

        if (!nextEmail) {
          event.preventDefault()
          setClientError('Email cannot be empty.')
          return
        }

        if (!event.currentTarget.reportValidity()) {
          event.preventDefault()
          return
        }

        const usernameChanged = nextUsername !== currentUsername
        const emailChanged =
          nextEmail.toLowerCase() !== currentEmail.toLowerCase()

        if (
          (usernameChanged || emailChanged) &&
          !window.confirm(
            'Are you sure you want to change your profile details?'
          )
        ) {
          event.preventDefault()
        }
      }}
    >
      <input
        name="username"
        defaultValue={username === 'No username yet' ? '' : username}
        placeholder="Choose a username"
        required
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={errorMessage || state.message ? messageId : undefined}
        onChange={() => setClientError(null)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60"
      />

      <input
        name="email"
        type="email"
        defaultValue={email}
        placeholder="Email address"
        required
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={errorMessage || state.message ? messageId : undefined}
        onChange={() => setClientError(null)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60"
      />

      {errorMessage ? (
        <p id="profile-error" className="text-sm font-medium text-red-300">
          {errorMessage}
        </p>
      ) : null}

      {!errorMessage && state.message ? (
        <p id="profile-message" className="text-sm font-medium text-cyan-200">
          {state.message}
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
