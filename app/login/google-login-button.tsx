'use client'

import { useState } from 'react'

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
    >
      <path
        fill="#4285F4"
        d="M21.805 10.023h-9.58v3.955h5.518c-.238 1.27-.963 2.348-2.052 3.064v2.546h3.324c1.945-1.792 3.065-4.43 3.065-7.557 0-.716-.064-1.405-.275-2.008z"
      />
      <path
        fill="#34A853"
        d="M12.225 22c2.775 0 5.104-.918 6.805-2.482l-3.324-2.546c-.918.616-2.094.98-3.481.98-2.67 0-4.933-1.802-5.742-4.226H3.047v2.625C4.738 19.713 8.214 22 12.225 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.483 13.726a5.864 5.864 0 0 1 0-3.74V7.36H3.047a10.002 10.002 0 0 0 0 8.99l3.436-2.625z"
      />
      <path
        fill="#EA4335"
        d="M12.225 5.904c1.51 0 2.867.52 3.934 1.54l2.948-2.948C17.326 2.836 14.997 2 12.225 2 8.214 2 4.738 4.287 3.047 7.36l3.436 2.626c.809-2.424 3.072-4.082 5.742-4.082z"
      />
    </svg>
  )
}

export default function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleGoogleLogin() {
    setIsLoading(true)
    setErrorMessage(null)

    const { createClient } = await import('../../utils/supabase/client')
    const supabase = createClient()
    const origin = window.location.origin

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    })

    if (error) {
      setErrorMessage(error.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="
          tap-press tap-target group relative flex w-full items-center justify-center gap-3 overflow-hidden
          rounded-2xl border border-cyan-300/20
          bg-white/[0.08] px-5 py-4
          text-sm font-black text-white
          shadow-[0_18px_55px_rgba(0,0,0,0.35)]
          backdrop-blur-xl
          hover:border-cyan-300/45 hover:bg-cyan-300/[0.10]
          disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70
        "
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-cyan-300/10 to-purple-400/0 opacity-0 transition group-hover:opacity-100" />

        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg shadow-black/20">
          <GoogleIcon />
        </span>

        <span className="relative">
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Opening Google...
            </span>
          ) : (
            'Continue with Google'
          )}
        </span>
      </button>

      {errorMessage && (
        <p className="text-center text-xs font-semibold text-red-300">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
