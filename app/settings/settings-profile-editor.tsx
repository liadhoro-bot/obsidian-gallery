'use client'

import { useState } from 'react'
import { updateUsername } from './settings-actions'

export default function SettingsProfileEditor({
  username,
}: {
  username: string
}) {
  const [isEditing, setIsEditing] = useState(false)

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
    <form action={updateUsername} className="mt-5 w-full space-y-3">
      <input
        name="username"
        defaultValue={username === 'No username yet' ? '' : username}
        placeholder="Choose a username"
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-slate-300"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950"
        >
          Save
        </button>
      </div>
    </form>
  )
}