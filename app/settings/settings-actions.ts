'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '../../utils/supabase/server'

export async function logout() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect('/login')
}

export async function updateAvatar(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const file = formData.get('avatar') as File | null

  if (!file || file.size === 0) {
    return
  }

  const fileExt = file.name.split('.').pop()
  const storagePath = `profiles/${user.id}/avatar-${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('obsidian-images')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('obsidian-images').getPublicUrl(storagePath)

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) {
    throw new Error(profileError.message)
  }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
}
export async function updateUsername(formData: FormData) {
  return updateProfileAction(null, formData)
}

export type UpdateProfileState = {
  error: string | null
  message: string | null
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function updateProfileAction(
  _prevState: UpdateProfileState | null,
  formData: FormData
): Promise<UpdateProfileState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'Please sign in again before updating your profile.',
      message: null,
    }
  }

  const username = String(formData.get('username') || '')
    .trim()
    .replace(/^@/, '')
  const email = String(formData.get('email') || '').trim()

  if (!username) {
    return { error: 'Username cannot be empty.', message: null }
  }

  if (!email) {
    return { error: 'Email cannot be empty.', message: null }
  }

  if (!emailPattern.test(email)) {
    return { error: 'Enter a valid email address.', message: null }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', user.id)

  if (error) {
    return { error: error.message, message: null }
  }

  const emailChanged = email.toLowerCase() !== user.email?.toLowerCase()

  if (emailChanged) {
    const requestHeaders = await headers()
    const origin = requestHeaders.get('origin')

    const { error: emailError } = await supabase.auth.updateUser(
      { email },
      origin
        ? {
            emailRedirectTo: `${origin}/auth/callback?next=/settings`,
          }
        : undefined
    )

    if (emailError) {
      return { error: emailError.message, message: null }
    }
  }

  revalidatePath('/settings')
  revalidatePath('/dashboard')

  return {
    error: null,
    message: emailChanged
      ? 'Profile saved. Check your inbox to confirm the new email address.'
      : 'Profile saved.',
  }
}
