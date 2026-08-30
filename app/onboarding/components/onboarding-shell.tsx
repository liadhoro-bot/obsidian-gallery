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
import {
  dismissOnboardingSetupAction,
  type OnboardingGoal,
} from '../actions'

type OnboardingShellProps = {
  initialStep?: OnboardingStep
  initialGoal?: OnboardingGoal
  hasAuthenticatedUser?: boolean
  previewMode?: boolean
  requireUnitSetup?: boolean
}

type OnboardingStep = 'terms' | 'persona' | 'creation' | 'curator'

export default function OnboardingShell({
  initialStep = 'terms',
  initialGoal = 'paint_miniature',
  hasAuthenticatedUser = false,
  previewMode = false,
  requireUnitSetup = false,
}: OnboardingShellProps) {
  const router = useRouter()
  const canBypassPersistence = previewMode && !hasAuthenticatedUser
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep)
  const [selectedGoal, setSelectedGoal] =
    useState<OnboardingGoal>(initialGoal)

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
    // /dashboard is the launch dashboard. Keep onboarding exits on the
    // canonical route so preview-only dashboard experiments cannot leak in.
    router.push('/dashboard')
  }

  async function skipCreationSetup() {
    if (!canBypassPersistence) {
      const result = await dismissOnboardingSetupAction()

      if (!result.ok) {
        console.error('Failed to dismiss onboarding setup:', result.error)
      }
    }

    setCurrentStep('curator')
  }

  return (
    <main className={styles.onboardingRoot}>
      <V3PerfIndicator surface="onboarding" detail={currentStep} />
      <div className={styles.onboardingViewport}>
        {currentStep === 'terms' ? (
          <LegalScreen
            shouldPersistAcceptance={hasAuthenticatedUser}
            previewMode={canBypassPersistence}
            onAccepted={() => setCurrentStep('persona')}
          />
        ) : null}

        {currentStep === 'persona' ? (
          <GoalScreen
            previewMode={canBypassPersistence}
            requireUnitSetup={requireUnitSetup}
            onContinue={continueFromPersona}
          />
        ) : null}

        {currentStep === 'creation' && selectedGoal !== 'create_content' ? (
          <FirstProjectScreen
            previewMode={canBypassPersistence}
            onCreated={() => setCurrentStep('curator')}
            onSkip={() => {
              void skipCreationSetup()
            }}
          />
        ) : null}

        {currentStep === 'creation' && selectedGoal === 'create_content' ? (
          <GuideCreationScreen
            previewMode={canBypassPersistence}
            onCreated={() => setCurrentStep('curator')}
            onSkip={() => {
              void skipCreationSetup()
            }}
          />
        ) : null}

        {currentStep === 'curator' ? (
          <CuratorBridgeScreen onEnter={enterDashboard} />
        ) : null}
      </div>
    </main>
  )
}
