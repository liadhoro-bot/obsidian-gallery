import fs from 'node:fs'
import path from 'node:path'

type CrawledItem = {
  item_product_code: string
  item_name: string
  item_role?: string
}

type CrawledProduct = {
  categoryName: string
  productCode: string
  setName: string
  setPageUrl: string
  pageCode?: string
  pageName?: string
  description?: string
  items: CrawledItem[]
}

type CsvRow = {
  set_product_code: string
  set_name: string
  brand: string
  line: string
  manufacturer: string
  set_description: string
  set_source_url: string
  item_product_code: string
  item_name: string
  item_role: string
  quantity: number
}

const referenceDir = path.join(process.cwd(), 'downloads', 'reference')
const outputJsonPath = path.join(referenceDir, 'vallejo-hobby-set-products.json')
const outputCsvPath = path.join(referenceDir, 'vallejo-paint-sets.csv')
const reviewPath = path.join(referenceDir, 'vallejo-paint-sets-review.json')

const columns: Array<keyof CsvRow> = [
  'set_product_code',
  'set_name',
  'brand',
  'line',
  'manufacturer',
  'set_description',
  'set_source_url',
  'item_product_code',
  'item_name',
  'item_role',
  'quantity',
]

function csvValue(value: unknown) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function normalizeText(value: string) {
  return value
    .replaceAll('â€œ', '"')
    .replaceAll('â€', '"')
    .replaceAll('â€™', "'")
    .replaceAll('â€“', '-')
    .replaceAll('â€”', '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function mergeProducts() {
  const batchFiles = fs
    .readdirSync(referenceDir)
    .filter((file) => /^vallejo-hobby-set-products-(?:\d{3}|fixes)\.json$/.test(file))
    .sort()

  const byCode = new Map<string, CrawledProduct>()

  for (const file of batchFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(referenceDir, file), 'utf8')) as {
      products?: CrawledProduct[]
    }

    for (const product of data.products ?? []) {
      const existing = byCode.get(product.productCode)
      if (!existing || product.items.length >= existing.items.length) {
        byCode.set(product.productCode, product)
      }
    }
  }

  return Array.from(byCode.values()).sort((a, b) => a.productCode.localeCompare(b.productCode))
}

function lineForSet(product: CrawledProduct) {
  const category = product.categoryName.toLowerCase()
  const title = product.setName.toLowerCase()
  const codePrefix = product.productCode.slice(0, 2)

  if (category.includes('true metallic')) return 'True Metallic Metal'
  if (category.includes('shifter')) return 'Liquid Metal'
  if (category.includes('metal color')) return 'Liquid Metal'
  if (category.includes('pigment')) return 'Pigment FX'
  if (category.includes('diorama')) return 'Pigment FX'
  if (category.includes('premium')) return 'Premium Color'
  if (category.includes('wizkids')) return 'WizKids'

  if (title.includes('xpress')) return 'Xpress Color'
  if (title.includes('game air')) return 'Game Air'
  if (title.includes('model air')) return 'Model Air'
  if (title.includes('mecha color')) return 'Mecha Color'
  if (title.includes('true metallic')) return 'True Metallic Metal'

  if (codePrefix === '70') return 'Model Color'
  if (codePrefix === '71') return 'Model Air'
  if (codePrefix === '72') return 'Game Color'
  if (codePrefix === '73') return 'Pigment FX'
  if (codePrefix === '69') return 'Mecha Color'
  if (codePrefix === '77') return 'True Metallic Metal'
  if (codePrefix === '80') return 'WizKids'
  if (codePrefix === '62') return 'Premium Color'

  return 'Unmapped Vallejo Set'
}

function roleForItem(product: CrawledProduct, item: CrawledItem) {
  if (item.item_role) return item.item_role
  if (lineForSet(product) !== 'True Metallic Metal') return ''

  const code = Number(item.item_product_code.slice(3))
  if (code >= 101 && code <= 120) return 'Light'
  if (code >= 121 && code <= 140) return 'Base'
  if (code >= 141 && code <= 160) return 'Shade'
  if (code >= 201 && code <= 220) return 'Airbrush'
  return ''
}

function itemNameForProduct(product: CrawledProduct, item: CrawledItem) {
  const name = normalizeText(item.item_name)
  if (lineForSet(product) !== 'True Metallic Metal') return name

  return name.replace(/\s*\((?:Light|Base|Shade|Airbrush)\)\s*$/i, '')
}

function rowsForProduct(product: CrawledProduct) {
  const setProductCode = product.pageCode || product.productCode
  const setName = normalizeText(product.pageName || product.setName)
  const setDescription = normalizeText(product.description || '')
  const line = lineForSet(product)

  return product.items.map((item) => ({
    set_product_code: setProductCode,
    set_name: setName,
    brand: 'Vallejo',
    line,
    manufacturer: 'Vallejo',
    set_description: setDescription,
    set_source_url: product.setPageUrl,
    item_product_code: item.item_product_code,
    item_name: itemNameForProduct(product, item),
    item_role: roleForItem(product, item),
    quantity: 1,
  }))
}

const products = mergeProducts()
const rows = products.flatMap(rowsForProduct)
const productsWithoutItems = products.filter((product) => product.items.length === 0)
const duplicateSetItems = rows
  .map((row) => `${row.set_product_code}\u0000${row.item_product_code}\u0000${row.item_role}`)
  .filter((key, index, keys) => keys.indexOf(key) !== index)

fs.writeFileSync(
  outputJsonPath,
  `${JSON.stringify({ crawledAt: new Date().toISOString(), count: products.length, products }, null, 2)}\n`
)

fs.writeFileSync(
  outputCsvPath,
  [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(',')),
  ].join('\r\n') + '\r\n'
)

fs.writeFileSync(
  reviewPath,
  `${JSON.stringify(
    {
      products: products.length,
      rows: rows.length,
      productsWithoutItems: productsWithoutItems.map((product) => ({
        productCode: product.productCode,
        setName: normalizeText(product.setName),
        setPageUrl: product.setPageUrl,
      })),
      duplicateSetItems,
      itemCodePrefixes: rows.reduce<Record<string, number>>((acc, row) => {
        const prefix = row.item_product_code.slice(0, 2)
        acc[prefix] = (acc[prefix] ?? 0) + 1
        return acc
      }, {}),
    },
    null,
    2
  )}\n`
)

console.log(JSON.stringify({ outputCsvPath, outputJsonPath, reviewPath, products: products.length, rows: rows.length, productsWithoutItems: productsWithoutItems.length }, null, 2))
