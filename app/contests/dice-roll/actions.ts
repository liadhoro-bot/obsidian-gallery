'use server'

import { headers } from 'next/headers'
import { randomInt } from 'crypto'
import { Resend } from 'resend'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'

export type DiceRollResult = {
  id: string
  playerName: string
  rollReason: string
  dieOne: number
  dieTwo: number
  total: number
  createdAt: string
  duplicate: boolean
}

export type DiceRollState = {
  error: string | null
  result: DiceRollResult | null
}

type DiceRollRow = {
  id: string
  player_name: string
  roll_reason: string
  die_one: number
  die_two: number
  total: number
  created_at: string
}

function normalizePlayerName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeRollReason(reason: string) {
  return reason.trim().replace(/\s+/g, ' ')
}

function getPlayerKey(name: string) {
  return normalizePlayerName(name).toLowerCase()
}

function getReasonKey(reason: string) {
  return normalizeRollReason(reason).toLowerCase()
}

function toResult(row: DiceRollRow, duplicate: boolean): DiceRollResult {
  return {
    id: row.id,
    playerName: row.player_name,
    rollReason: row.roll_reason,
    dieOne: row.die_one,
    dieTwo: row.die_two,
    total: row.total,
    createdAt: row.created_at,
    duplicate,
  }
}

function rollD6() {
  return randomInt(1, 7)
}

function getDatabaseErrorMessage(error: { code?: string; message?: string }) {
  if (
    error.code === 'PGRST205' ||
    error.code === 'PGRST204' ||
    error.code === '42P01' ||
    error.code === '42703' ||
    error.message?.toLowerCase().includes('campaign_dice_rolls')
  ) {
    return 'The dice-roll log table needs the latest database migration. Ask the organizer to run it, then try again.'
  }

  return null
}

async function sendDiceRollEmail(result: DiceRollResult) {
  const adminEmail =
    process.env.ADMIN_DICE_ROLL_EMAIL ||
    process.env.ADMIN_REPORT_EMAIL ||
    process.env.FEEDBACK_TO_EMAIL
  const resendKey = process.env.RESEND_API_KEY

  const body = [
    'A campaign 2d6 roll was recorded in Obsidian Gallery.',
    '',
    `Player: ${result.playerName}`,
    `Reason: ${result.rollReason}`,
    `Roll: ${result.dieOne} + ${result.dieTwo} = ${result.total}`,
    `Recorded at: ${new Date(result.createdAt).toISOString()}`,
    `Roll ID: ${result.id}`,
  ].join('\n')

  if (!adminEmail || !resendKey) {
    console.info('Campaign dice roll notification:', body)
    return false
  }

  try {
    const resend = new Resend(resendKey)

    await resend.emails.send({
      from: 'Obsidian Gallery <onboarding@resend.dev>',
      to: adminEmail,
      subject: `Campaign 2d6 roll: ${result.playerName} rolled ${result.total}`,
      text: body,
    })

    return true
  } catch (error) {
    console.error('Campaign dice roll notification failed:', error)
    return false
  }
}

export async function rollCampaignDice(
  _previousState: DiceRollState,
  formData: FormData
): Promise<DiceRollState> {
  const playerName = normalizePlayerName(String(formData.get('playerName') || ''))
  const rollReason = normalizeRollReason(String(formData.get('rollReason') || ''))

  if (playerName.length < 2) {
    return { error: 'Enter your campaign player name before rolling.', result: null }
  }

  if (playerName.length > 80) {
    return { error: 'Player name must be 80 characters or fewer.', result: null }
  }

  if (rollReason.length < 3) {
    return { error: 'Enter the reason for this roll before rolling.', result: null }
  }

  if (rollReason.length > 160) {
    return { error: 'Roll reason must be 160 characters or fewer.', result: null }
  }

  const playerKey = getPlayerKey(playerName)
  const reasonKey = getReasonKey(rollReason)
  const supabase = createServiceRoleClient()

  const { data: existingRoll, error: existingError } = await supabase
    .from('campaign_dice_rolls')
    .select('id, player_name, roll_reason, die_one, die_two, total, created_at')
    .eq('player_key', playerKey)
    .eq('reason_key', reasonKey)
    .maybeSingle<DiceRollRow>()

  if (existingError) {
    console.error('Could not check campaign dice roll:', existingError)
    return {
      error: getDatabaseErrorMessage(existingError) || 'Could not check your roll. Please try again.',
      result: null,
    }
  }

  if (existingRoll) {
    return { error: null, result: toResult(existingRoll, true) }
  }

  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const realIp = headerStore.get('x-real-ip')
  const dieOne = rollD6()
  const dieTwo = rollD6()

  const { data: insertedRoll, error: insertError } = await supabase
    .from('campaign_dice_rolls')
    .insert({
      player_name: playerName,
      player_key: playerKey,
      roll_reason: rollReason,
      reason_key: reasonKey,
      die_one: dieOne,
      die_two: dieTwo,
      total: dieOne + dieTwo,
      ip_address: forwardedFor || realIp,
      user_agent: headerStore.get('user-agent'),
    })
    .select('id, player_name, roll_reason, die_one, die_two, total, created_at')
    .single<DiceRollRow>()

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: rollAfterRace } = await supabase
        .from('campaign_dice_rolls')
        .select('id, player_name, roll_reason, die_one, die_two, total, created_at')
        .eq('player_key', playerKey)
        .eq('reason_key', reasonKey)
        .maybeSingle<DiceRollRow>()

      if (rollAfterRace) {
        return { error: null, result: toResult(rollAfterRace, true) }
      }

      return {
        error: 'The dice-roll log table still allows only one roll per player. Ask the organizer to run the latest database migration, then try again.',
        result: null,
      }
    }

    console.error('Could not record campaign dice roll:', insertError)
    return {
      error:
        getDatabaseErrorMessage(insertError) || 'Could not record your roll. Please try again.',
      result: null,
    }
  }

  const result = toResult(insertedRoll, false)
  const emailSent = await sendDiceRollEmail(result)

  await supabase
    .from('campaign_dice_rolls')
    .update({ email_sent: emailSent, email_attempted_at: new Date().toISOString() })
    .eq('id', result.id)

  return { error: null, result }
}
