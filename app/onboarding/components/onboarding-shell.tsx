'use client'

import { useMemo, useState } from 'react'
import OnboardingProgress from './onboarding-progress'
import WelcomeScreen from './screens/welcome-screen'
import ProblemScreen from './screens/problem-screen'
import WorkflowScreen from './screens/workflow-screen'
import FirstProjectScreen from './screens/first-project-screen'
import LegalScreen from './screens/legal-screen'


export default function OnboardingShell() {
  const [currentStep, setCurrentStep] = useState(0)
  const steps = [
    {
      id: 'welcome',
      label: 'Welcome',
      component: <WelcomeScreen />,
    },
    {
      id: 'problem',
      label: 'Problem',
      component: <ProblemScreen />,
    },
    {
      id: 'workflow',
      label: 'Workflow',
      component: <WorkflowScreen />,
    },
    {
      id: 'project',
      label: 'Project',
      component: (
        <FirstProjectScreen
          onCreated={() => setCurrentStep((step) => step + 1)}
          onSkip={() => setCurrentStep((step) => step + 1)}
          
        />
      ),
    },
    {
      id: 'hobby',
      label: 'Hobby',
      component: (
        <PlaceholderScreen
          eyebrow="Personalize"
          title="Tell us what you paint."
          body="Soon this screen will let users choose Warhammer, D&D minis, Gunpla, historical models, scale models, and more."
        />
      ),
    },
    {
  id: 'legal',
  label: 'Legal',
  component: (
    <LegalScreen
      onEnter={() => {
        console.log('Accepted terms and entered app')
      }}
    />
  ),
},  
  ]
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
    if (isLastStep) {
      console.log('Onboarding finished')
      return
    }

    setCurrentStep((step) => step + 1)
  }

  function goBack() {
    if (isFirstStep) return
    setCurrentStep((step) => step - 1)
  }

  return (
    <main className="min-h-screen bg-[#03070b] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-8 pt-5">
        <header className="mb-5 flex items-center justify-between">
          <OnboardingProgress
            currentStep={currentStep}
            totalSteps={steps.length}
          />

          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {currentStep + 1}/{steps.length}
          </div>
        </header>

        <div className="flex-1">{activeStep.component}</div>

        {!['project', 'legal'].includes(activeStep.id) ? (
  <footer className="mt-5 grid grid-cols-[1fr_1.4fr] gap-3">
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

function PlaceholderScreen({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <section className="flex min-h-[520px] flex-col justify-center rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(34,211,238,0.06)]">
      <div className="space-y-4">
        <div className="inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          {eyebrow}
        </div>

        <h2 className="text-3xl font-black leading-tight text-white">
          {title}
        </h2>

        <p className="text-base leading-7 text-white/60">{body}</p>
      </div>
    </section>
  )
}