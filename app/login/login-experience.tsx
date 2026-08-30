'use client'

import Image from 'next/image'
import { useState } from 'react'
import V3PerfIndicator from '../components/v3-perf-indicator'
import styles from '../auth-flow-silver.module.css'
import LoginForm from './login-form'

type LoginAudience = 'new' | 'returning'

type LoginExperienceProps = {
  authError?: string | null
  currentUserEmail?: string | null
  defaultOpen?: boolean
  nextPath: string
  previewMode?: boolean
  useLocalPreviewAuth?: boolean
}

export default function LoginExperience({
  authError,
  currentUserEmail,
  defaultOpen = false,
  nextPath,
  previewMode = false,
  useLocalPreviewAuth = false,
}: LoginExperienceProps) {
  const [showSignIn, setShowSignIn] = useState(
    Boolean(authError) || previewMode || defaultOpen || Boolean(currentUserEmail)
  )
  const [audience, setAudience] = useState<LoginAudience>('new')

  function openSignIn(nextAudience: LoginAudience) {
    setAudience(nextAudience)
    setShowSignIn(true)
  }

  return (
    <main className={styles.authRoot}>
      <V3PerfIndicator surface="login" detail={previewMode ? 'preview' : 'default'} />
      <div className={styles.authFrame}>
        <Image
          src="/onboarding/welcome-hero.jpeg"
          alt="Miniature painting hobby workspace"
          fill
          priority
          className={styles.heroImage}
        />

        <div className={styles.loginShade} />

        <div
          className={[
            styles.loginContent,
            showSignIn ? styles.loginContentWithOverlay : '',
          ].join(' ')}
        >
          <header className={styles.loginHeader}>
            <span className={styles.wordmark}>
              Obsidian Gallery
            </span>

            <button
              type="button"
              onClick={() => openSignIn('returning')}
              className={`tap-target ${styles.headerButton}`}
            >
              Sign in
            </button>
          </header>

          <section className={styles.loginHero}>
            <div>
              <h1 className={styles.heroTitle}>
                Your miniature workspace. Organized to perfection.
              </h1>

              <p className={styles.heroCopy}>
                Track progress, manage paint, build guides, and share your
                finished work, all in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openSignIn('new')}
              className={`tap-press tap-target ${styles.primaryButton}`}
            >
              Start Here -&gt;
            </button>
          </section>
        </div>

        {showSignIn ? (
          <div className={styles.loginOverlay}>
            <LoginForm
              audience={audience}
              authError={authError}
              currentUserEmail={currentUserEmail}
              nextPath={nextPath}
              previewMode={previewMode}
              surface="v3"
              useLocalPreviewAuth={useLocalPreviewAuth}
              onAudienceChange={setAudience}
              onBack={() => setShowSignIn(false)}
            />
          </div>
        ) : null}
      </div>
    </main>
  )
}
