'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import WelcomeScreen from './screens/welcome-screen'
import ProblemScreen, { type PainId } from './screens/problem-screen'
import WorkflowScreen from './screens/workflow-screen'
import FirstProjectScreen from './screens/first-project-screen'
import LegalScreen from './screens/legal-screen'

type WorkflowScreenId =
  | 'themes'
  | 'recipes'
  | 'vault'
  | 'projects'
  | 'dashboard'

const painToWorkflowScreen: Record<PainId, WorkflowScreenId> = {
  pile: 'projects',
  schemes: 'recipes',
  paints: 'vault',
  fragmentation: 'dashboard',
  choices: 'themes',
}

export default function OnboardingShell() {
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(0)
  const [createdUnitId, setCreatedUnitId] = useState<string | null>(null)
  const [selectedPains, setSelectedPains] = useState<PainId[]>([])
  const [initialWorkflowScreen, setInitialWorkflowScreen] =
    useState<WorkflowScreenId>('projects')

  const steps = [
    {
      id: 'welcome',
      label: 'Welcome',
      component: <WelcomeScreen onNext={() => setCurrentStep(1)} />,
    },
    {
      id: 'problem',
      label: 'Problem',
      component: (
        <ProblemScreen
          selectedPains={selectedPains}
          onSelectedPainsChange={setSelectedPains}
          onBack={() => setCurrentStep((step) => Math.max(0, step - 1))}
          onSkip={() => setCurrentStep((step) => step + 1)}
          onContinue={() => {
            const firstSelectedPain = selectedPains[0]

            setInitialWorkflowScreen(
              firstSelectedPain
                ? painToWorkflowScreen[firstSelectedPain]
                : 'projects'
            )

            setCurrentStep((step) => step + 1)
          }}
        />
      ),
    },
    {
      id: 'workflow',
      label: 'Workflow',
      component: (
        <WorkflowScreen
          key={initialWorkflowScreen}
          initialScreen={initialWorkflowScreen}
        />
      ),
    },
    {
      id: 'project',
      label: 'Project',
      component: (
        <FirstProjectScreen
          onCreated={(unitId) => {
            setCreatedUnitId(unitId)
            setCurrentStep((step) => step + 1)
          }}
          onBack={() => setCurrentStep((step) => Math.max(0, step - 1))}
          onSkip={() => setCurrentStep((step) => step + 1)}
        />
      ),
    },
    {
      id: 'legal',
      label: 'Legal',
      component: (
        <LegalScreen
          onEnter={() => {
            if (createdUnitId) {
              router.push(`/units/${createdUnitId}`)
              return
            }

            router.push('/dashboard')
          }}
        />
      ),
    },
  ] as const

  const activeStep = steps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  const nextLabel = useMemo(() => {
    if (isLastStep) return 'Finish'
    if (currentStep === 0) return 'Start Your Workshop'
    if (currentStep === 1) return 'Show Me How'
    return 'Next'
  }, [currentStep, isLastStep])

  function goNext() {
    if (isLastStep) return
    setCurrentStep((step) => Math.min(steps.length - 1, step + 1))
  }

  function goBack() {
    if (isFirstStep) return
    setCurrentStep((step) => Math.max(0, step - 1))
  }

  const shouldShowFooter =
    !isFirstStep && !['problem', 'project', 'legal'].includes(activeStep.id)

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <div className="flex-1">{activeStep.component}</div>

        {shouldShowFooter ? (
          <footer className="mt-5 grid grid-cols-[1fr_1.4fr] gap-3 px-5 pb-6">
            <button
              type="button"
              onClick={goBack}
              disabled={isFirstStep}
              className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 text-sm font-black text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Back
            </button>

            <button
              type="button"
              onClick={goNext}
              className="h-12 rounded-2xl border border-cyan-400/30 bg-cyan-400/15 text-sm font-black text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.18)] transition hover:bg-cyan-400/20"
            >
              {nextLabel}
            </button>
          </footer>
        ) : null}
      </div>
    </main>
  )
}