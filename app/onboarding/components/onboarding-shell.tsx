'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import styles from '../../auth-flow-silver.module.css'
import { capturePostHog } from '../../../utils/analytics/client'
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

  const displayedScreen =
    currentStep === 'creation'
      ? selectedGoal === 'create_content'
        ? 'create_guide'
        : 'create_unit'
      : currentStep === 'terms'
        ? 'terms_and_conditions'
        : currentStep === 'persona'
          ? 'goal_screen'
          : 'curator_bridge'

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [currentStep])

  useEffect(() => {
    void capturePostHog('onboarding_step_viewed', {
      step: displayedScreen,
      goal: selectedGoal,
      preview_mode: canBypassPersistence,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedScreen])

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
    window.setTimeout(() => {
      if (window.location.pathname === '/onboarding') {
        window.location.assign('/dashboard')
      }
    }, 500)
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
