import { writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

type TextItem = {
  str: string
  x: number
  y: number
}

type CsvRow = {
  source_brand_raw: string
  source_line_raw: string
  source_paint_name_raw: string
  source_code_raw: string
  target_brand_raw: string
  target_line_raw: string
  target_paint_name_raw: string
  target_code_raw: string
  notes_raw: string
}

type TableSpec = {
  x: number
  columns: Array<{ key: string; dx: number }>
  yMin: number
  yMax: number
}

const pdfPath =
  process.argv[2] || 'C:/Users/Liad/Downloads/CC266-Game_Color (1).pdf'
const outputDir = path.join(process.cwd(), 'downloads', 'reference')

function csvEscape(value: string) {
  if (!/[",\n\r]/.test(value)) return value

  return `"${value.replace(/"/g, '""')}"`
}

function toCsv(rows: CsvRow[]) {
  const headers = [
    'source_brand_raw',
    'source_line_raw',
    'source_paint_name_raw',
    'source_code_raw',
    'target_brand_raw',
    'target_line_raw',
    'target_paint_name_raw',
    'target_code_raw',
    'notes_raw',
  ]

  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header as keyof CsvRow])).join(',')
    ),
  ].join('\n')
}

function groupRows(items: TextItem[]) {
  const rows: Array<{ y: number; items: TextItem[] }> = []

  for (const item of items) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 3)

    if (row) {
      row.items.push(item)
    } else {
      rows.push({ y: item.y, items: [item] })
    }
  }

  return rows.sort((a, b) => b.y - a.y)
}

function closestCell(items: TextItem[], expectedX: number) {
  const candidates = items
    .map((item) => ({ ...item, distance: Math.abs(item.x - expectedX) }))
    .filter((item) => item.distance <= 6)
    .sort((a, b) => a.distance - b.distance || a.x - b.x)

  return candidates[0]?.str.trim() || ''
}

function extractTable(items: TextItem[], spec: TableSpec) {
  const scopedItems = items.filter(
    (item) =>
      item.y >= spec.yMin &&
      item.y <= spec.yMax &&
      item.x >= spec.x - 8 &&
      item.x <= spec.x + 180
  )

  return groupRows(scopedItems)
    .map((row) => {
      const record: Record<string, string> = {}

      for (const column of spec.columns) {
        record[column.key] = closestCell(row.items, spec.x + column.dx)
      }

      return record
    })
    .filter((row) => /^\d{2}\.\d{3}$/.test(row.source_code || ''))
}

function buildGameColorRows(records: Array<Record<string, string>>) {
  const rows: CsvRow[] = []

  for (const record of records) {
    const sourceCode = record.source_code
    const sourceName = record.source_name

    if (record.game_air_code && record.game_air_name) {
      rows.push({
        source_brand_raw: 'Vallejo',
        source_line_raw: 'Game Color',
        source_paint_name_raw: sourceName,
        source_code_raw: sourceCode,
        target_brand_raw: 'Vallejo',
        target_line_raw: 'Game Air',
        target_paint_name_raw: record.game_air_name,
        target_code_raw: record.game_air_code,
        notes_raw: 'Extracted from Vallejo CC266 Game Color equivalences chart',
      })
    }

    if (record.hobby_code && record.hobby_name) {
      rows.push({
        source_brand_raw: 'Vallejo',
        source_line_raw: 'Game Color',
        source_paint_name_raw: sourceName,
        source_code_raw: sourceCode,
        target_brand_raw: 'Vallejo',
        target_line_raw: 'Hobby Paint',
        target_paint_name_raw: record.hobby_name,
        target_code_raw: record.hobby_code,
        notes_raw: 'Extracted from Vallejo CC266 Game Color equivalences chart',
      })
    }

    if (record.citadel_name) {
      rows.push({
        source_brand_raw: 'Vallejo',
        source_line_raw: 'Game Color',
        source_paint_name_raw: sourceName,
        source_code_raw: sourceCode,
        target_brand_raw: 'Warhammer Color',
        target_line_raw: '',
        target_paint_name_raw: record.citadel_name,
        target_code_raw: '',
        notes_raw: 'Citadel name as printed in Vallejo CC266 Game Color equivalences chart',
      })
    }
  }

  return rows
}

function buildXpressRows(records: Array<Record<string, string>>) {
  return records
    .filter((record) => record.citadel_name)
    .map((record) => ({
      source_brand_raw: 'Vallejo',
      source_line_raw: 'Xpress Color',
      source_paint_name_raw: record.source_name,
      source_code_raw: record.source_code,
      target_brand_raw: 'Warhammer Color',
      target_line_raw: 'Contrast',
      target_paint_name_raw: record.citadel_name,
      target_code_raw: '',
      notes_raw:
        'Citadel Contrast name as printed in Vallejo CC266 Xpress Color chart',
    }))
}

async function main() {
  const data = new Uint8Array(await readFile(pdfPath))
  const document = await pdfjs.getDocument({
    data,
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise
  const page = await document.getPage(1)
  const content = await page.getTextContent()
  const items = content.items
    .map((item) => {
      const textItem = item as { str: string; transform: number[] }

      return {
        str: textItem.str,
        x: Math.round(textItem.transform[4]),
        y: Math.round(textItem.transform[5]),
      }
    })
    .filter((item) => item.str.trim())

  const gameColorColumns = [
    { key: 'source_code', dx: 0 },
    { key: 'source_name', dx: 14 },
    { key: 'game_air_code', dx: 48 },
    { key: 'game_air_name', dx: 62 },
    { key: 'hobby_code', dx: 96 },
    { key: 'hobby_name', dx: 111 },
    { key: 'citadel_name', dx: 145 },
  ]

  const xpressColumns = [
    { key: 'source_code', dx: 0 },
    { key: 'source_name', dx: 14 },
    { key: 'citadel_name', dx: 45 },
  ]

  const gameColorRecords = [
    ...extractTable(items, {
      x: 2090,
      columns: gameColorColumns,
      yMin: 74,
      yMax: 520,
    }),
    ...extractTable(items, {
      x: 2283,
      columns: gameColorColumns,
      yMin: 368,
      yMax: 520,
    }),
  ]

  const xpressRecords = [
    ...extractTable(items, {
      x: 2283,
      columns: xpressColumns,
      yMin: 100,
      yMax: 286,
    }),
    ...extractTable(items, {
      x: 2379,
      columns: xpressColumns,
      yMin: 100,
      yMax: 286,
    }),
  ]

  const gameColorRows = buildGameColorRows(gameColorRecords)
  const xpressRows = buildXpressRows(xpressRecords)

  await writeFile(
    path.join(outputDir, 'vallejo-cc266-game-color-equivalences.csv'),
    `${toCsv(gameColorRows)}\n`
  )
  await writeFile(
    path.join(outputDir, 'vallejo-cc266-xpress-color-equivalences.csv'),
    `${toCsv(xpressRows)}\n`
  )

  console.log(
    JSON.stringify(
      {
        gameColorRecords: gameColorRecords.length,
        gameColorRows: gameColorRows.length,
        xpressRecords: xpressRecords.length,
        xpressRows: xpressRows.length,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
