import { createClient } from '@/utils/supabase/server'
import { getLevelFromXP } from './xp'

export async function addXP(userId: string, amount: number) {
  const supabase = await createClient()

  // 1. Get current XP
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', userId)
    .single()

  if (!profile) throw new Error('Profile not found')

  const newXP = (profile.xp || 0) + amount

  // 2. Calculate new level
  const newLevel = await getLevelFromXP(newXP)

  // 3. Update
  const { error } = await supabase
    .from('profiles')
    .update({
      xp: newXP,
      level: newLevel,
    })
    .eq('id', userId)

  if (error) throw error

  return {
    xpGained: amount,
    newXP,
    newLevel,
    leveledUp: newLevel > (profile.level || 0),
  }
}