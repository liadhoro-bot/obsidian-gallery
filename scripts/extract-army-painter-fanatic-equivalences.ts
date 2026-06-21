import { readFile, writeFile } from 'node:fs/promises'
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

const pdfPath =
  process.argv[2] ||
  'C:/Users/Liad/Downloads/A3_Fanatic_Colour_Conversion_Chart_WEB.pdf'
const outputPath = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'army-painter-warpaints-fanatic-equivalences.csv'
)

const COLUMN_XS = [47, 145, 242, 339, 436, 534, 631, 728, 825]
const SOURCE_YS = [
  754, 721, 680, 640, 599, 559, 511, 470, 429, 389, 348, 308, 260, 219, 179,
  138, 97, 57,
]

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

function uniqueItems(items: TextItem[]) {
  const seen = new Set<string>()

  return items.filter((item) => {
    const key = `${item.x}|${item.y}|${item.str}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function targetForOffset(offset: number, hasLowerGwLine: boolean) {
  if (offset >= 5 && offset <= 10) {
    return {
      brand: 'The Army Painter',
      line: 'Original Warpaints',
      note: 'WP original Warpaints conversion',
    }
  }

  if (offset >= 12 && offset <= 17) {
    if (hasLowerGwLine) {
      return {
        brand: 'The Army Painter',
        line: 'Warpaints Air',
        note: 'AIR Warpaints Air conversion',
      }
    }

    return null
  }

  if (offset >= 19 && offset <= 27) {
    return {
      brand: 'Warhammer Colour',
      line: '',
      note: 'GW Citadel by Games Workshop conversion',
    }
  }

  return null
}

function ambiguousMiddleTargets() {
  return [
    {
      brand: 'The Army Painter',
      line: 'Warpaints Air',
      note: 'Ambiguous middle conversion line from PDF text layer; candidate AIR row',
    },
    {
      brand: 'Warhammer Colour',
      line: '',
      note: 'Ambiguous middle conversion line from PDF text layer; candidate GW row',
    },
  ]
}

function buildRows(items: TextItem[]) {
  const rows: CsvRow[] = []

  for (const y of SOURCE_YS) {
    for (const x of COLUMN_XS) {
      const cellItems = uniqueItems(
        items
          .filter(
            (item) =>
              Math.abs(item.x - x) <= 10 && item.y <= y + 2 && item.y >= y - 30
          )
          .sort((a, b) => b.y - a.y || a.x - b.x)
      )
      const source = cellItems.find((item) => Math.abs(item.y - y) <= 2)

      if (!source) continue

      const conversionItems = cellItems.filter((item) => item !== source)
      const hasLowerGwLine = conversionItems.some((item) => y - item.y >= 19)

      for (const item of conversionItems) {
        const offset = y - item.y
        const target = targetForOffset(offset, hasLowerGwLine)
        const targets = target
          ? [target]
          : offset >= 12 && offset <= 17
            ? ambiguousMiddleTargets()
            : []

        for (const candidate of targets) {
          rows.push({
            source_brand_raw: 'The Army Painter',
            source_line_raw: 'Warpaints Fanatic',
            source_paint_name_raw: source.str,
            source_code_raw: '',
            target_brand_raw: candidate.brand,
            target_line_raw: candidate.line,
            target_paint_name_raw: item.str,
            target_code_raw: '',
            notes_raw: `${candidate.note}; extracted from Army Painter Warpaints Fanatic conversion chart`,
          })
        }
      }
    }
  }

  return rows
}

async function main() {
  const data = new Uint8Array(await readFile(pdfPath))
  const document = await pdfjs.getDocument({ data }).promise
  const page = await document.getPage(1)
  const content = await page.getTextContent()
  const items = content.items
    .map((item) => {
      const textItem = item as { str: string; transform: number[] }

      return {
        str: textItem.str.trim(),
        x: Math.round(textItem.transform[4]),
        y: Math.round(textItem.transform[5]),
      }
    })
    .filter((item) => item.str)

  const rows = buildRows(items)

  await writeFile(outputPath, `${toCsv(rows)}\n`)

  console.log(
    JSON.stringify(
      {
        outputPath,
        rows: rows.length,
        strongSkinRows: rows.filter(
          (row) => row.source_paint_name_raw === 'Strong Skin Shade'
        ),
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
