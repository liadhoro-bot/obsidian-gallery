import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  backfillPaintCatalogLab,
  backfillPaintCatalogNormalization,
  generateSimilarityRankings,
  generateHexSimilarityEdges,
  importConversionCsv,
  rematchConversionRawRows,
  type PaintConversionDbClient,
  type ParsedConversionCsvRow,
} from '../utils/paint-conversions'

type ImportJob = {
  filePath: string
  sourceName: string
  manufacturer: string
  notes: string
}

const DEFAULT_JOBS: ImportJob[] = [
  {
    filePath: path.join(
      process.cwd(),
      'downloads',
      'reference',
      'vallejo-cc266-game-color-equivalences.csv'
    ),
    sourceName: 'Vallejo CC266 Game Color equivalences',
    manufacturer: 'Vallejo',
    notes: 'Extracted from the Game Color equivalences chart in CC266.',
  },
  {
    filePath: path.join(
      process.cwd(),
      'downloads',
      'reference',
      'vallejo-cc266-xpress-color-equivalences.csv'
    ),
    sourceName: 'Vallejo CC266 Xpress Color equivalences',
    manufacturer: 'Vallejo',
    notes: 'Extracted from the Xpress Color equivalences chart in CC266.',
  },
]

function parseArgs() {
  const args = process.argv.slice(2)

  return {
    all: args.includes('--all'),
    backfillLab: args.includes('--backfill-lab'),
    backfillNormalization: args.includes('--backfill-normalization'),
    force: args.includes('--force'),
    includeMatched: args.includes('--include-matched'),
    import: args.includes('--import'),
    rematchRaw: args.includes('--rematch-raw'),
    rankings: args.includes('--rankings'),
    hexSimilarity: args.includes('--hex-similarity'),
    sourceId: args.find((arg) => arg.startsWith('--source-id='))?.slice('--source-id='.length),
    file: args.find((arg) => arg.startsWith('--file='))?.slice('--file='.length),
    name: args.find((arg) => arg.startsWith('--name='))?.slice('--name='.length),
    manufacturer: args
      .find((arg) => arg.startsWith('--manufacturer='))
      ?.slice('--manufacturer='.length),
  }
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"'
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (character === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }

    current += character
  }

  cells.push(current)
  return cells
}

function parseConversionCsv(csv: string): ParsedConversionCsvRow[] {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())

  const headers = parseCsvLine(lines[0])

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row = Object.fromEntries(
      headers.map((header, index) => [header, cells[index] || null])
    )

    return {
      source_brand_raw: row.source_brand_raw,
      source_line_raw: row.source_line_raw,
      source_paint_name_raw: row.source_paint_name_raw,
      source_code_raw: row.source_code_raw,
      target_brand_raw: row.target_brand_raw,
      target_line_raw: row.target_line_raw,
      target_paint_name_raw: row.target_paint_name_raw,
      target_code_raw: row.target_code_raw,
      notes_raw: row.notes_raw,
    }
  })
}

async function importJob(job: ImportJob) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running imports.'
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
  const csv = await readFile(job.filePath, 'utf8')
  const rows = parseConversionCsv(csv)
  const result = await importConversionCsv(supabase, rows, {
    name: job.sourceName,
    manufacturer: job.manufacturer,
    source_type: 'official_chart',
    file_path: job.filePath,
    notes: job.notes,
    reliability_score: 1,
  })

  console.log(JSON.stringify({ file: job.filePath, ...result }, null, 2))

  return supabase
}

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running imports.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

async function main() {
  const args = parseArgs()
  const shouldImport = args.import || args.all || Boolean(args.file)
  const jobs =
    args.all || !args.file
      ? DEFAULT_JOBS
      : [
          {
            filePath: path.resolve(args.file),
            sourceName: args.name || path.basename(args.file),
            manufacturer: args.manufacturer || '',
            notes: 'Imported from conversion CSV.',
          },
        ]

  let supabase: PaintConversionDbClient | null = null

  if (args.backfillNormalization) {
    supabase = createServiceClient()
    const result = await backfillPaintCatalogNormalization(supabase, 500, {
      force: args.force,
    })
    console.log(JSON.stringify({ backfillNormalization: result }, null, 2))
  }

  if (args.backfillLab) {
    supabase = supabase ?? createServiceClient()
    const result = await backfillPaintCatalogLab(supabase)
    console.log(JSON.stringify({ backfillLab: result }, null, 2))
  }

  if (shouldImport) {
    for (const job of jobs) {
      supabase = await importJob(job)
    }
  }

  if (args.rematchRaw) {
    supabase = supabase ?? createServiceClient()
    const result = await rematchConversionRawRows(supabase, {
      sourceId: args.sourceId,
      onlyIncomplete: !args.includeMatched,
    })
    console.log(JSON.stringify({ rematchRawRows: result }, null, 2))
  }

  if (args.hexSimilarity || args.all) {
    supabase = supabase ?? createServiceClient()
    const result = await generateHexSimilarityEdges(supabase)
    console.log(JSON.stringify({ hexSimilarityEdges: result }, null, 2))
  }

  if (args.rankings || args.all) {
    supabase = supabase ?? createServiceClient()
    const result = await generateSimilarityRankings(supabase)
    console.log(JSON.stringify(result, null, 2))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
