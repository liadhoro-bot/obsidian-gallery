import { chromium } from 'playwright'
import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'

const BENCHMARK_EMAIL =
  process.env.PERF_BENCHMARK_EMAIL ?? 'perf-benchmark@obsidian.gallery'
const TERMS_VERSION = '2026-05-13'

export function loadLocalEnv() {
  const envPath = resolve('.env.local')
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for perf auth setup.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function findUserByEmail(supabase, email) {
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) throw error

    const user = data.users.find(
      (entry) => entry.email?.toLowerCase() === email.toLowerCase()
    )

    if (user) return user
    if (!data.nextPage) return null

    page = data.nextPage
  }
}

async function ensureBenchmarkUser(supabase) {
  const existingUser = await findUserByEmail(supabase, BENCHMARK_EMAIL)
  if (existingUser) return existingUser

  const { data, error } = await supabase.auth.admin.createUser({
    email: BENCHMARK_EMAIL,
    email_confirm: true,
    user_metadata: {
      name: 'Perf Benchmark',
    },
  })

  if (error || !data.user) {
    throw error ?? new Error('Could not create perf benchmark user.')
  }

  return data.user
}

async function ensureProfile(supabase, userId) {
  const now = new Date().toISOString()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, level')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  if (profile) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        terms_accepted_at: now,
        terms_version: TERMS_VERSION,
        username: profile.username ?? 'Perf Bench',
        level: profile.level ?? 1,
      })
      .eq('id', userId)

    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await supabase.from('profiles').insert({
    id: userId,
    username: 'Perf Bench',
    level: 1,
    terms_accepted_at: now,
    terms_version: TERMS_VERSION,
  })

  if (insertError) throw insertError
}

async function ensureProject(supabase, userId) {
  const { data: existing, error } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Perf Benchmark Project')
    .maybeSingle()

  if (error) throw error
  if (existing) return existing.id

  const { data, error: insertError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: 'Perf Benchmark Project',
      description: 'Seeded automatically for protected performance benchmarks.',
    })
    .select('id')
    .single()

  if (insertError || !data) {
    throw insertError ?? new Error('Could not seed benchmark project.')
  }

  return data.id
}

async function ensureUnit(supabase, userId, projectId) {
  const { data: existing, error } = await supabase
    .from('units')
    .select('id, project_id')
    .eq('user_id', userId)
    .eq('name', 'Perf Benchmark Unit')
    .maybeSingle()

  if (error) throw error

  let unitId = existing?.id ?? null

  if (!unitId) {
    const { data, error: insertError } = await supabase
      .from('units')
      .insert({
        user_id: userId,
        project_id: projectId,
        name: 'Perf Benchmark Unit',
        model_count: 5,
        notes: 'Seeded automatically for protected performance benchmarks.',
        is_active: true,
        is_featured: true,
      })
      .select('id')
      .single()

    if (insertError || !data) {
      throw insertError ?? new Error('Could not seed benchmark unit.')
    }

    unitId = data.id
  }

  const { data: link, error: linkError } = await supabase
    .from('unit_projects')
    .select('unit_id')
    .eq('unit_id', unitId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (linkError) throw linkError

  if (!link) {
    const { error: insertLinkError } = await supabase.from('unit_projects').insert({
      unit_id: unitId,
      project_id: projectId,
      user_id: userId,
    })

    if (insertLinkError) throw insertLinkError
  }

  return unitId
}

async function ensureRecipe(supabase, userId) {
  const { data: existing, error } = await supabase
    .from('recipes')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Perf Benchmark Recipe')
    .maybeSingle()

  if (error) throw error
  if (existing) return existing.id

  const { data, error: insertError } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      name: 'Perf Benchmark Recipe',
      description: 'Seeded automatically for protected performance benchmarks.',
      is_public: false,
    })
    .select('id')
    .single()

  if (insertError || !data) {
    throw insertError ?? new Error('Could not seed benchmark recipe.')
  }

  return data.id
}

async function ensureTheme(supabase, userId) {
  const { data: existing, error } = await supabase
    .from('themes')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Perf Benchmark Theme')
    .maybeSingle()

  if (error) throw error
  if (existing) return existing.id

  const { data, error: insertError } = await supabase
    .from('themes')
    .insert({
      user_id: userId,
      name: 'Perf Benchmark Theme',
      description: 'Seeded automatically for protected performance benchmarks.',
      tags: ['perf', 'benchmark'],
      is_public: false,
    })
    .select('id')
    .single()

  if (insertError || !data) {
    throw insertError ?? new Error('Could not seed benchmark theme.')
  }

  return data.id
}

async function ensureCustomPaint(supabase, userId) {
  const { data: existing, error } = await supabase
    .from('paints')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Perf Benchmark Paint')
    .maybeSingle()

  if (error) throw error
  if (existing) return existing.id

  const { data, error: insertError } = await supabase
    .from('paints')
    .insert({
      user_id: userId,
      name: 'Perf Benchmark Paint',
      manufacturer: 'Custom',
      series: 'Benchmark',
      color_hex: '#4A4F57',
      paint_type: 'custom',
    })
    .select('id')
    .single()

  if (insertError || !data) {
    throw insertError ?? new Error('Could not seed benchmark custom paint.')
  }

  return data.id
}

async function ensureBenchmarkData(supabase, userId) {
  await ensureProfile(supabase, userId)
  const projectId = await ensureProject(supabase, userId)
  await Promise.all([
    ensureUnit(supabase, userId, projectId),
    ensureRecipe(supabase, userId),
    ensureTheme(supabase, userId),
    ensureCustomPaint(supabase, userId),
  ])
}

async function createBenchmarkSession() {
  const supabase = createServiceRoleClient()

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: BENCHMARK_EMAIL,
  })

  if (linkError || !linkData.properties?.email_otp) {
    throw linkError ?? new Error('Could not generate perf auth OTP.')
  }

  const browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  const { data, error } = await browserClient.auth.verifyOtp({
    email: BENCHMARK_EMAIL,
    token: linkData.properties.email_otp,
    type: 'email',
  })

  if (error || !data.session) {
    throw error ?? new Error('Could not verify perf auth OTP.')
  }

  return data.session
}

async function createStorageStateForSession({ session, baseUrl, storageStatePath }) {
  const cookieStore = new Map()
  const browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Array.from(cookieStore.entries()).map(([name, value]) => ({
            name,
            value,
          }))
        },
        setAll(items) {
          for (const item of items) {
            cookieStore.set(item.name, item.value)
          }
        },
      },
    }
  )

  const { error } = await browserClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  if (error) throw error

  const origin = new URL(baseUrl).origin
  const cookies = Array.from(cookieStore.entries()).map(([name, value]) => ({
    name,
    value,
    domain: new URL(baseUrl).hostname,
    path: '/',
    httpOnly: false,
    secure: origin.startsWith('https://'),
    sameSite: 'Lax',
    expires: Math.floor(Date.now() / 1000) + 34_560_000,
  }))

  const storageState = {
    cookies,
    origins: [],
  }

  writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2))
}

export async function ensurePerfStorageState({
  baseUrl,
  storageStatePath,
  userDataDir = resolve('.perf', 'auth-browser-profile'),
}) {
  loadLocalEnv()

  const supabase = createServiceRoleClient()
  const user = await ensureBenchmarkUser(supabase)
  await ensureBenchmarkData(supabase, user.id)
  const session = await createBenchmarkSession()

  mkdirSync(dirname(storageStatePath), { recursive: true })
  rmSync(storageStatePath, { force: true })
  rmSync(userDataDir, { recursive: true, force: true })
  await createStorageStateForSession({
    session,
    baseUrl,
    storageStatePath,
  })

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
  })

  try {
    await applyStorageStateToContext({
      context,
      storageStatePath,
      baseUrl,
    })

    const page = await context.newPage()

    await page.goto(`${baseUrl}/dashboard`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })

    await page.waitForURL(
      (url) =>
        url.origin === new URL(baseUrl).origin &&
        !url.pathname.startsWith('/login') &&
        !url.pathname.startsWith('/auth') &&
        !url.pathname.startsWith('/onboarding'),
      { timeout: 60_000 }
    )

    await context.storageState({ path: storageStatePath })
  } finally {
    await context.close()
  }

  return {
    email: BENCHMARK_EMAIL,
    userId: user.id,
    storageStatePath,
  }
}

export async function applyStorageStateToContext({
  context,
  storageStatePath,
  baseUrl,
}) {
  if (!existsSync(storageStatePath)) return false

  const storageState = JSON.parse(readFileSync(storageStatePath, 'utf8'))

  if (Array.isArray(storageState.cookies) && storageState.cookies.length > 0) {
    await context.addCookies(storageState.cookies)
  }

  if (Array.isArray(storageState.origins) && storageState.origins.length > 0) {
    const page = await context.newPage()

    try {
      for (const originState of storageState.origins) {
        await page.goto(`${baseUrl}/login`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        })

        await page.evaluate((items) => {
          for (const item of items) {
            window.localStorage.setItem(item.name, item.value)
          }
        }, originState.localStorage ?? [])
      }
    } finally {
      await page.close()
    }
  }

  return true
}
