// Copies storage buckets + files from the old Supabase project to the new one.
// Re-runnable: files already present in NEW (same name and size) are skipped.
// Reads OLD_DB_URL, NEW_DB_URL, NEW_SERVICE_ROLE_KEY from .env.migration.
//
//   node scripts/region-migration/copy-storage.mjs           copy
//   node scripts/region-migration/copy-storage.mjs --verify  compare only
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { Client } = require('pg')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OLD_URL = 'https://ckzrvjisesooqcmmtvwl.supabase.co'
const NEW_URL = 'https://vwshzvxsitiwyayawcvr.supabase.co'
const CONCURRENCY = 8
const verifyOnly = process.argv.includes('--verify')

const env = Object.fromEntries(
  readFileSync(path.join(ROOT, '.env.migration'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()])
)
const key = env.NEW_SERVICE_ROLE_KEY
if (!verifyOnly && !key) throw new Error('NEW_SERVICE_ROLE_KEY missing from .env.migration')

async function listObjects(connectionString) {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()
  const buckets = (await client.query('select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id')).rows
  const objects = (await client.query(
    "select bucket_id, name, metadata->>'mimetype' mimetype, metadata->>'cacheControl' cache, (metadata->>'size')::bigint size from storage.objects order by bucket_id, name"
  )).rows
  await client.end()
  return { buckets, objects }
}

const encodePath = (name) => name.split('/').map(encodeURIComponent).join('/')
const authHeaders = () => ({ Authorization: `Bearer ${key}`, apikey: key })

async function ensureBucket(bucket) {
  const res = await fetch(`${NEW_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: bucket.id,
      name: bucket.id,
      public: bucket.public,
      file_size_limit: bucket.file_size_limit,
      allowed_mime_types: bucket.allowed_mime_types,
    }),
  })
  if (res.ok) return console.log(`bucket ${bucket.id}: created`)
  const body = await res.text()
  if (/already exists|Duplicate/i.test(body)) return console.log(`bucket ${bucket.id}: exists`)
  throw new Error(`bucket ${bucket.id}: ${res.status} ${body}`)
}

async function copyObject(obj) {
  // Old buckets are public, so files can be read without the old project's key.
  const src = await fetch(`${OLD_URL}/storage/v1/object/public/${obj.bucket_id}/${encodePath(obj.name)}`)
  if (!src.ok) throw new Error(`download ${src.status}`)
  const body = Buffer.from(await src.arrayBuffer())
  const dst = await fetch(`${NEW_URL}/storage/v1/object/${obj.bucket_id}/${encodePath(obj.name)}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': obj.mimetype || src.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': obj.cache || 'max-age=3600',
      'x-upsert': 'true',
    },
    body,
  })
  if (!dst.ok) throw new Error(`upload ${dst.status} ${await dst.text()}`)
}

const old = await listObjects(env.OLD_DB_URL)
let current = await listObjects(env.NEW_DB_URL)
const have = (objects) => new Set(objects.map((o) => `${o.bucket_id}/${o.name}/${o.size}`))

if (!verifyOnly) {
  for (const bucket of old.buckets) await ensureBucket(bucket)

  const existing = have(current.objects)
  const todo = old.objects.filter((o) => !existing.has(`${o.bucket_id}/${o.name}/${o.size}`))
  console.log(`${old.objects.length} files in old, ${todo.length} to copy`)

  let done = 0
  const failures = []
  const queue = [...todo]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let obj = queue.shift(); obj; obj = queue.shift()) {
        for (let attempt = 1; ; attempt++) {
          try {
            await copyObject(obj)
            break
          } catch (error) {
            if (attempt === 3) {
              failures.push(`${obj.bucket_id}/${obj.name}: ${error.message}`)
              break
            }
          }
        }
        if (++done % 100 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`)
      }
    })
  )
  if (failures.length) console.log(`FAILED (${failures.length}):\n` + failures.join('\n'))
  current = await listObjects(env.NEW_DB_URL)
}

const present = have(current.objects)
for (const bucket of old.buckets) {
  const inOld = old.objects.filter((o) => o.bucket_id === bucket.id)
  const missing = inOld.filter((o) => !present.has(`${o.bucket_id}/${o.name}/${o.size}`))
  console.log(`${bucket.id}: old ${inOld.length}, missing in new ${missing.length}`)
  missing.slice(0, 10).forEach((o) => console.log(`   missing: ${o.name}`))
}
