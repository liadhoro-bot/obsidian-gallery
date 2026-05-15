type Props = {
  currentStep: number
  totalSteps: number
}

export default function OnboardingProgress({
  currentStep,
  totalSteps,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = index === currentStep

        return (
          <div
            key={index}
            className={[
              'h-2 rounded-full transition-all duration-300',
              isActive
                ? 'w-8 bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.55)]'
                : 'w-2 bg-white/15',
            ].join(' ')}
          />
        )
      })}
    </div>
  )
}