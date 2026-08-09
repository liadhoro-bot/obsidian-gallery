'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import V3PerfIndicator from '../../components/v3-perf-indicator'
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
    router.push('/dashboard?preview=1')
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <V3PerfIndicator surface="onboarding" detail={currentStep} />
      <div className="mx-auto min-h-screen w-full max-w-md">
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
