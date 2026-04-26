'use client'

export default function AvatarUploadInput() {
  return (
    <input
      name="avatar"
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(event) => {
        event.currentTarget.form?.requestSubmit()
      }}
    />
  )
}