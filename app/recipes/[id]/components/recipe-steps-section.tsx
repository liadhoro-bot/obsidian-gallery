'use client'

import RecipeStepCard from './recipe-step-card'
import { useMemo } from 'react'

export default function RecipeStepsSection({
  steps,
  stepPaintLinks,
}: {
  steps: any[]
  stepPaintLinks: any[]
}) {
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {}

    stepPaintLinks.forEach((link) => {
      if (!map[link.recipe_step_id]) {
        map[link.recipe_step_id] = []
      }
      map[link.recipe_step_id].push(link)
    })

    return map
  }, [stepPaintLinks])

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <RecipeStepCard
          key={step.id}
          step={step}
          index={index}
          paints={grouped[step.id] || []}
        />
      ))}
    </div>
  )
}