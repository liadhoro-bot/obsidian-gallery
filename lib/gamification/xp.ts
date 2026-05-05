export function calculateUnitXP({
  complexity,
  unitSize,
}: {
  complexity: number
  unitSize: number
}) {
  const base = 50
  const complexityScore = complexity * 30
  const sizeScore = unitSize * 8
  const synergy = (complexity - 1) * unitSize * 2

  return base + complexityScore + sizeScore + synergy
}

export function calculateStepXP(totalUnitXP: number) {
  return Math.round(totalUnitXP / 5)
}

export function calculateCompletionBonus(totalUnitXP: number) {
  return Math.round(totalUnitXP * 0.25)
}

import { createClient } from '@/utils/supabase/server'

export async function getLevelFromXP(xp: number) {
  const supabase = await createClient()

  const { data: levels } = await supabase
    .from('levels')
    .select('*')
    .order('level', { ascending: true })

  if (!levels) return 0

  let currentLevel = 0

  for (const lvl of levels) {
    if (xp >= lvl.xp_required) {
      currentLevel = lvl.level
    } else {
      break
    }
  }

  return currentLevel
}