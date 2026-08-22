'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import styles from '../../auth-flow-silver.module.css'
import CuratorBridgeScreen from './screens/curator-bridge-screen'
import FirstProjectScreen from './screens/first-project-screen'
import GoalScreen from './screens/goal-screen'
import GuideCreationScreen from './screens/guide-creation-screen'
import LegalScreen from './screens/legal-screen'
import type { OnboardingGoal } from '../actions'

type OnboardingShellProps = {
  previewMode?: boolean
}

type OnboardingStep = 'terms' | 'persona' | 'creation' | 'curator'

export default function OnboardingShell({
  previewMode = false,
}: OnboardingShellProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('terms')
  const [selectedGoal, setSelectedGoal] =
    useState<OnboardingGoal>('paint_miniature')

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [currentStep])

  function continueFromPersona(goal: OnboardingGoal) {
    setSelectedGoal(goal)

    if (goal === 'look_around') {
      setCurrentStep('curator')
      return
    }

    setCurrentStep('creation')
  }

  function enterDashboard() {
    // /dashboard has its own real (non-preview) implementation now (see
    // app/login/page.tsx's requestedNextIsDashboard carve-out) - sending
    // people here with ?preview=1 lands them on the old, abandoned
    // DashboardV3Preview component instead.
    router.push('/dashboard')
  }

  return (
    <main className={styles.onboardingRoot}>
      <V3PerfIndicator surface="onboarding" detail={currentStep} />
      <div className={styles.onboardingViewport}>
        {currentStep === 'terms' ? (
          <LegalScreen
            previewMode={previewMode}
            onAccepted={() => setCurrentStep('persona')}
          />
        ) : null}

        {currentStep === 'persona' ? (
          <GoalScreen
            previewMode={previewMode}
            onContinue={continueFromPersona}
          />
        ) : null}

        {currentStep === 'creation' && selectedGoal !== 'create_content' ? (
          <FirstProjectScreen
            previewMode={previewMode}
            onCreated={() => setCurrentStep('curator')}
            onSkip={() => setCurrentStep('curator')}
          />
        ) : null}

        {currentStep === 'creation' && selectedGoal === 'create_content' ? (
          <GuideCreationScreen
            previewMode={previewMode}
            onCreated={() => setCurrentStep('curator')}
            onSkip={() => setCurrentStep('curator')}
          />
        ) : null}

        {currentStep === 'curator' ? (
          <CuratorBridgeScreen onEnter={enterDashboard} />
        ) : null}
      </div>
    </main>
  )
}
