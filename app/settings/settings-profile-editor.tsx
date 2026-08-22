'use client'

import { useActionState, useState } from 'react'
import SubmitButton from '../components/SubmitButton'
import {
  updateProfileAction,
  type UpdateProfileState,
} from './settings-actions'
import styles from '../settings-support-silver.module.css'

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
        className={styles.editButton}
      >
        Edit Profile
      </button>
    )
  }

  return (
    <form
      action={formAction}
      className={styles.editorForm}
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
        className={styles.input}
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
        className={styles.input}
      />

      {errorMessage ? (
        <p id="profile-error" className={styles.messageError}>
          {errorMessage}
        </p>
      ) : null}

      {!errorMessage && state.message ? (
        <p id="profile-message" className={styles.messageSuccess}>
          {state.message}
        </p>
      ) : null}

      <div className={styles.buttonGrid}>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className={styles.secondaryButton}
        >
          Cancel
        </button>

        <SubmitButton
          idleText="Save"
          pendingText="Saving..."
          className={styles.primaryButton}
        />
      </div>
    </form>
  )
}
