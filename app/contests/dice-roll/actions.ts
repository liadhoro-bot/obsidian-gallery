'use server'

import { headers } from 'next/headers'
import { Resend } from 'resend'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  createClient as createServerSupabaseClient,
  getSessionUser,
} from '../../../utils/supabase/server'

export type DiceRollResult = {
  id: string
  playerName: string
  appUsername: string | null
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
  roll_id: string
  roll_player_name: string
  roll_app_username: string | null
  roll_reason_text: string
  roll_die_one: number
  roll_die_two: number
  roll_total: number
  roll_created_at: string
  duplicate: boolean
}

function normalizePlayerName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeRollReason(reason: string) {
  return reason.trim().replace(/\s+/g, ' ')
}

function toResult(row: DiceRollRow): DiceRollResult {
  return {
    id: row.roll_id,
    playerName: row.roll_player_name,
    appUsername: row.roll_app_username,
    rollReason: row.roll_reason_text,
    dieOne: row.roll_die_one,
    dieTwo: row.roll_die_two,
    total: row.roll_total,
    createdAt: row.roll_created_at,
    duplicate: row.duplicate,
  }
}

function createDiceRollClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }

  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function getDatabaseErrorMessage(error: { code?: string; message?: string }) {
  if (
    error.code === 'PGRST205' ||
    error.code === 'PGRST204' ||
    error.code === '42P01' ||
    error.code === '42703' ||
    error.message?.toLowerCase().includes('campaign_dice_rolls') ||
    error.message?.toLowerCase().includes('record_campaign_dice_roll')
  ) {
    return 'The dice-roll log table needs the latest database migration. Ask the organizer to run it, then try again.'
  }

  return null
}

function getSetupErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (
    message.includes('NEXT_PUBLIC_SUPABASE_URL') ||
    message.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  ) {
    return 'The dice roller is missing production Supabase configuration. Ask the organizer to set the public Supabase environment variables, then try again.'
  }

  return 'The dice roller could not connect to the database. Please try again later.'
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
    `App username: ${result.appUsername ? `@${result.appUsername}` : 'Not signed in'}`,
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

async function getCurrentUsername() {
  const authSupabase = await createServerSupabaseClient()
  const user = await getSessionUser(authSupabase)

  if (!user) {
    return null
  }

  const { data: profile, error } = await authSupabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle<{ username: string | null }>()

  if (error) {
    console.error('Could not load campaign dice roll username:', error)
    return null
  }

  return profile?.username ?? user.email?.split('@')[0] ?? null
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

  let supabase: ReturnType<typeof createDiceRollClient>

  try {
    supabase = createDiceRollClient()
  } catch (error) {
    console.error('Could not initialize campaign dice roll database client:', error)
    return { error: getSetupErrorMessage(error), result: null }
  }

  const headerStore = await headers()
  const appUsername = await getCurrentUsername()
  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const realIp = headerStore.get('x-real-ip')

  const { data: rollRows, error: rollError } = await supabase.rpc(
    'record_campaign_dice_roll',
    {
      p_player_name: playerName,
      p_app_username: appUsername,
      p_roll_reason: rollReason,
      p_ip_address: forwardedFor || realIp,
      p_user_agent: headerStore.get('user-agent'),
    }
  )

  if (rollError) {
    console.error('Could not record campaign dice roll:', rollError)
    return {
      error:
        getDatabaseErrorMessage(rollError) || 'Could not record your roll. Please try again.',
      result: null,
    }
  }

  const rollRow = Array.isArray(rollRows) ? (rollRows[0] as DiceRollRow | undefined) : null

  if (!rollRow) {
    return { error: 'Could not record your roll. Please try again.', result: null }
  }

  const result = toResult(rollRow)

  if (!result.duplicate) {
    const emailSent = await sendDiceRollEmail(result)

    await supabase.rpc('mark_campaign_dice_roll_email_attempted', {
      p_roll_id: result.id,
      p_email_sent: emailSent,
    })
  }

  return { error: null, result }
}
