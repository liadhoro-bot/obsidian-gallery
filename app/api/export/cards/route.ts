import { after, NextResponse, type NextRequest } from 'next/server'
import type { Browser, HTTPRequest } from 'puppeteer-core'
import { createServiceRoleClient } from '../../../../utils/supabase/service-role'

// Renders guide/deck cards to a PDF or a zip of PNGs with headless Chromium.
// Doing this in the browser (html-to-image) took minutes on phones; here a
// 24-card guide takes seconds on any device.
//
// The caller posts the exact card markup it already has on screen plus the
// page's stylesheets, so this route reads no data and needs no session: it
// works the same for private guides, decks and public share pages. Because
// the markup is caller-supplied, Chromium runs with JavaScript disabled and
// may only load from this app's origin and Supabase storage.

export const runtime = 'nodejs'
export const maxDuration = 60

const CARD_WIDTH = 540
const CARD_HEIGHT = 960
const PIXEL_RATIO = 2
const MAX_CARDS = 80
const MAX_BODY_BYTES = 8 * 1024 * 1024
const RENDER_TIMEOUT_MS = 25_000

type ExportRequest = {
  format: 'pdf' | 'zip'
  fileBaseName: string
  cards: string[]
  stylesheets: string[]
  inlineStyles: string[]
  htmlClass?: string
  htmlStyle?: string
  bodyClass?: string
  bodyStyle?: string
}

function sanitizeFilePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'guide'
  )
}

function escapeAttribute(value: string | undefined) {
  return (value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function stripScripts(html: string) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, '')
}

function parseRequest(body: unknown): ExportRequest | null {
  if (!body || typeof body !== 'object') return null
  const value = body as Record<string, unknown>
  const isStrings = (list: unknown): list is string[] =>
    Array.isArray(list) && list.every((item) => typeof item === 'string')
  if (value.format !== 'pdf' && value.format !== 'zip') return null
  if (!isStrings(value.cards) || value.cards.length === 0 || value.cards.length > MAX_CARDS) return null
  if (!isStrings(value.stylesheets) || !isStrings(value.inlineStyles)) return null
  const optionalString = (field: unknown) => (typeof field === 'string' ? field : undefined)
  return {
    format: value.format,
    fileBaseName: typeof value.fileBaseName === 'string' ? value.fileBaseName : 'guide',
    cards: value.cards,
    stylesheets: value.stylesheets,
    inlineStyles: value.inlineStyles,
    htmlClass: optionalString(value.htmlClass),
    htmlStyle: optionalString(value.htmlStyle),
    bodyClass: optionalString(value.bodyClass),
    bodyStyle: optionalString(value.bodyStyle),
  }
}

function buildDocument(input: ExportRequest, origin: string) {
  const links = input.stylesheets
    .filter((href) => {
      try {
        return new URL(href, origin).origin === origin
      } catch {
        return false
      }
    })
    .map((href) => `<link rel="stylesheet" href="${escapeAttribute(href)}">`)
    .join('')
  const inline = input.inlineStyles
    .map((css) => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`)
    .join('')
  const cards = input.cards
    .map((card) => `<div data-export-card style="width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;overflow:hidden;position:relative">${stripScripts(card)}</div>`)
    .join('')

  return `<!doctype html><html class="${escapeAttribute(input.htmlClass)}" style="${escapeAttribute(input.htmlStyle)}"><head><meta charset="utf-8"><base href="${escapeAttribute(origin)}/">${links}${inline}<style>html,body{margin:0;padding:0;background:#e6d7b8}</style></head><body class="${escapeAttribute(input.bodyClass)}" style="${escapeAttribute(input.bodyStyle)}">${cards}</body></html>`
}

const EXPORT_BUCKET = 'card-exports'
const SIGNED_URL_SECONDS = 10 * 60
let bucketReady = false

async function uploadExport(file: { body: ArrayBuffer; name: string; type: string }) {
  const storage = createServiceRoleClient().storage
  if (!bucketReady) {
    const { error } = await storage.createBucket(EXPORT_BUCKET, { public: false })
    if (error && !/already exists/i.test(error.message)) throw error
    bucketReady = true
  }
  const day = new Date().toISOString().slice(0, 10)
  const path = `${day}/${crypto.randomUUID()}-${file.name}`
  const { error: uploadError } = await storage
    .from(EXPORT_BUCKET)
    .upload(path, file.body, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { data, error: signError } = await storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: file.name })
  if (signError || !data) throw signError ?? new Error('Could not sign export URL')
  return data.signedUrl
}

// Exports are one-shot downloads; drop anything from before yesterday.
async function cleanUpOldExports() {
  try {
    const bucket = createServiceRoleClient().storage.from(EXPORT_BUCKET)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: days } = await bucket.list('', { limit: 100 })
    for (const day of days ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.name) || day.name >= cutoff) continue
      const { data: files } = await bucket.list(day.name, { limit: 1000 })
      const paths = (files ?? []).map((entry) => `${day.name}/${entry.name}`)
      if (paths.length) await bucket.remove(paths)
    }
  } catch (error) {
    console.error('[export/cards] cleanup failed', error)
  }
}

// One Chromium per warm function instance; relaunched if it died.
let browserPromise: Promise<Browser> | null = null

async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default
    chromium.setGraphicsMode = false
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    })
  }
  // Local development: any installed Chromium-based browser.
  const executablePath =
    process.env.EXPORT_CHROME_PATH ||
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  return puppeteer.launch({ executablePath, headless: true })
}

async function getBrowser() {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null)
    if (browser?.connected) return browser
  }
  browserPromise = launchBrowser()
  return browserPromise
}

// Blank same-origin document for Chromium to start from. Rendering into
// about:blank makes every stylesheet/font request cross-origin, which the
// dev server rejects (403) and which web fonts need CORS for.
export function GET() {
  return new NextResponse('<!doctype html><meta charset="utf-8"><title>export</title>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Export request is too large.' }, { status: 413 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Export request is too large.' }, { status: 413 })
  }
  let input: ExportRequest | null = null
  try {
    input = parseRequest(JSON.parse(raw))
  } catch {
    input = null
  }
  if (!input) {
    return NextResponse.json({ error: 'Invalid export request.' }, { status: 400 })
  }

  const origin = request.nextUrl.origin
  const allowedOrigins = new Set([origin])
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    allowedOrigins.add(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin)
  }

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setJavaScriptEnabled(false)
    await page.setViewport({ width: CARD_WIDTH, height: CARD_HEIGHT, deviceScaleFactor: PIXEL_RATIO })
    await page.setRequestInterception(true)
    page.on('request', (outgoing: HTTPRequest) => {
      const url = outgoing.url()
      if (url.startsWith('data:') || url.startsWith('blob:')) return void outgoing.continue()
      try {
        if (allowedOrigins.has(new URL(url).origin)) return void outgoing.continue()
      } catch {}
      void outgoing.abort('blockedbyclient')
    })

    await page.goto(`${origin}/api/export/cards`, { waitUntil: 'load', timeout: RENDER_TIMEOUT_MS })
    await page.setContent(buildDocument(input, origin), {
      waitUntil: 'load',
      timeout: RENDER_TIMEOUT_MS,
    })
    // Stylesheets' fonts and background textures load after `load`.
    await page.waitForNetworkIdle({ idleTime: 300, timeout: RENDER_TIMEOUT_MS }).catch(() => undefined)

    const cards = await page.$$('[data-export-card]')
    const baseName = sanitizeFilePart(input.fileBaseName)
    // JPEG for both outputs: PNGs of these textured cards are ~3 MB each,
    // far too much to download on a phone, and q90 is visually identical.
    const shots: Uint8Array[] = []
    for (const card of cards) {
      shots.push(await card.screenshot({ type: 'jpeg', quality: 90 }))
    }

    let file: { body: ArrayBuffer; name: string; type: string }
    if (input.format === 'pdf') {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'px', format: [CARD_WIDTH, CARD_HEIGHT] })
      shots.forEach((jpeg, index) => {
        if (index > 0) doc.addPage([CARD_WIDTH, CARD_HEIGHT], 'portrait')
        // Explicit per-card alias: jsPDF otherwise dedupes images by a
        // partial hash, which collides across cards sharing a frame.
        doc.addImage(Buffer.from(jpeg).toString('base64'), 'JPEG', 0, 0, CARD_WIDTH, CARD_HEIGHT, `card-${index}`)
      })
      file = { body: doc.output('arraybuffer'), name: `${baseName}-cards.pdf`, type: 'application/pdf' }
    } else {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      shots.forEach((jpeg, index) => {
        zip.file(`${baseName}-${String(index + 1).padStart(2, '0')}.jpg`, jpeg)
      })
      file = {
        body: await zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' }),
        name: `${baseName}-cards.zip`,
        type: 'application/zip',
      }
    }

    // Vercel caps function responses at 4.5 MB, below a typical export, so
    // hand the file over through storage and a short-lived signed link.
    const url = await uploadExport(file)
    after(cleanUpOldExports)
    return NextResponse.json({ url, fileName: file.name }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[export/cards] render failed', error)
    return NextResponse.json({ error: 'Could not render the cards.' }, { status: 500 })
  } finally {
    await page.close().catch(() => undefined)
  }
}
