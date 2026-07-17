import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import JSZip from 'jszip'

const outDir = path.join(process.cwd(), 'docs', 'import-templates')
const target = process.argv[2] || 'all'

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><i/><sz val="11"/><color rgb="FF6B7280"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF102033"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const workbookRelsXml = (sheetCount) => {
  const sheetRels = Array.from({ length: sheetCount }, (_, index) =>
    `  <Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetRels}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

const contentTypesXml = (sheetCount) => {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) =>
    `  <Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheetOverrides}
</Types>`
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function columnName(index) {
  let name = ''
  let current = index
  while (current >= 0) {
    name = String.fromCharCode((current % 26) + 65) + name
    current = Math.floor(current / 26) - 1
  }
  return name
}

function cellXml(value, rowIndex, columnIndex, styleIndex) {
  const ref = `${columnName(columnIndex)}${rowIndex + 1}`
  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}" s="${styleIndex}"/>`
  }
  if (typeof value === 'number') {
    return `<c r="${ref}" s="${styleIndex}"><v>${value}</v></c>`
  }
  return `<c r="${ref}" s="${styleIndex}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
}

function sheetXml(sheet) {
  const rows = sheet.rows.map((row, rowIndex) => {
    const styleIndex = rowIndex === 0 ? 1 : rowIndex % 2 === 0 ? 3 : 2
    const cells = row
      .map((value, columnIndex) => cellXml(value, rowIndex, columnIndex, styleIndex))
      .join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('\n')

  const maxColumns = Math.max(...sheet.rows.map((row) => row.length))
  const cols = Array.from({ length: maxColumns }, (_, index) => {
    const maxLength = Math.max(
      ...sheet.rows.map((row) => String(row[index] ?? '').length),
      10
    )
    const width = Math.min(Math.max(maxLength + 2, 12), 42)
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData>
${rows}
  </sheetData>
  <autoFilter ref="A1:${columnName(maxColumns - 1)}${Math.max(sheet.rows.length, 1)}"/>
</worksheet>`
}

function workbookXml(sheets) {
  const sheetEntries = sheets.map((sheet, index) =>
    `    <sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
${sheetEntries}
  </sheets>
</workbook>`
}

async function writeWorkbook(filename, sheets) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypesXml(sheets.length))
  zip.folder('_rels').file('.rels', relsXml)
  const xl = zip.folder('xl')
  xl.file('workbook.xml', workbookXml(sheets))
  xl.file('styles.xml', stylesXml)
  xl.folder('_rels').file('workbook.xml.rels', workbookRelsXml(sheets.length))
  const worksheets = xl.folder('worksheets')
  sheets.forEach((sheet, index) => {
    worksheets.file(`sheet${index + 1}.xml`, sheetXml(sheet))
  })

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  await fs.writeFile(path.join(outDir, filename), buffer)
}

const instructions = {
  name: 'Instructions',
  rows: [
    ['Topic', 'Guidance'],
    ['Keys', 'Use project_key, unit_key, recipe_key, and custom_paint_key to connect rows across sheets. Keys only need to be unique inside this workbook.'],
    ['Paint matching', 'Catalog paints can be matched by catalog_paint_id, barcode, sku, or brand + line + paint_name.'],
    ['Custom paints', 'Use Custom Paints for paints missing from the catalog, then reference custom_paint_key from recipe and unit sheets.'],
    ['Dates', 'Use YYYY-MM-DD for deadlines.'],
    ['Booleans', 'Use TRUE or FALSE.'],
    ['Import action', 'Use upsert for create-or-update, create_only to avoid changing existing rows, or skip to leave a row untouched.'],
    ['Preview', 'The app should preview validation errors before committing any changes.'],
  ],
}

const reference = {
  name: 'Reference',
  rows: [
    ['Field', 'Allowed values'],
    ['ownership_status', 'owned, wishlist, unowned'],
    ['import_action', 'upsert, create_only, update_only, skip'],
    ['paint_source', 'catalog, custom'],
    ['unit_status', 'active, bench, pile, complete, other'],
    ['stage_key', 'assembled, primed, initial_paints, fine_details, base_rim, done'],
    ['step_status', 'pending, in_progress, done'],
    ['recipe_visibility', 'private, public'],
  ],
}

const paintCollection = {
  name: 'Paint Collection',
  rows: [
    ['import_action', 'ownership_status', 'quantity', 'brand', 'line', 'paint_name', 'sku', 'barcode', 'catalog_paint_id', 'notes'],
    ['upsert', 'owned', 1, 'Vallejo', 'Model Color', 'Black', '70.950', '', '', 'Matched by brand + line + name or sku'],
    ['upsert', 'wishlist', 0, 'The Army Painter', 'Warpaints Fanatic', 'Matt White', '', '', '', 'Wishlist item'],
    ['skip', 'owned', 2, 'Citadel', 'Base', 'Abaddon Black', '', '', '', 'Example skipped row'],
  ],
}

const customPaints = {
  name: 'Custom Paints',
  rows: [
    ['import_action', 'custom_paint_key', 'name', 'manufacturer', 'series', 'paint_type', 'color_hex', 'notes'],
    ['upsert', 'custom-verdigris-mix', 'Verdigris Mix', 'Bench Mix', 'Weathering', 'acrylic', '#49A997', 'Private custom color'],
    ['upsert', 'custom-ash-grey', 'Ash Grey Mix', 'Bench Mix', 'Neutrals', 'acrylic', '#878A8D', 'Used in guides below'],
  ],
}

const projects = {
  name: 'Projects',
  rows: [
    ['import_action', 'project_key', 'name', 'description', 'theme_name', 'notes'],
    ['upsert', 'project-cursed-city', 'Cursed City Warband', 'Main skirmish force for the season.', '', ''],
    ['upsert', 'project-display-bust', 'Display Bust', 'Single model display project.', '', ''],
  ],
}

const units = {
  name: 'Units',
  rows: [
    ['import_action', 'unit_key', 'name', 'project_keys', 'model_count', 'unit_status', 'complexity', 'unit_size', 'deadline', 'notes', 'assembled_status', 'primed_status', 'initial_paints_status', 'fine_details_status', 'base_rim_status'],
    ['upsert', 'unit-skeletons', 'Skeleton Warriors', 'project-cursed-city', 10, 'active', 2, 10, '2026-08-15', 'Batch painted infantry.', 'done', 'done', 'in_progress', 'pending', 'pending'],
    ['upsert', 'unit-vampire', 'Vampire Captain', 'project-cursed-city, project-display-bust', 1, 'bench', 4, 1, '', 'Character model.', 'done', 'pending', 'pending', 'pending', 'pending'],
  ],
}

const recipes = {
  name: 'Guides',
  rows: [
    ['import_action', 'recipe_key', 'name', 'description', 'inventory_required', 'expert_tips', 'visibility', 'youtube_url', 'notes'],
    ['upsert', 'recipe-aged-bone', 'Aged Bone', 'Warm bone guide for infantry.', 'Ivory primer, brown wash, off-white highlight', 'Keep the final highlight on upper edges.', 'private', '', ''],
    ['upsert', 'recipe-cold-black-armor', 'Cold Black Armor', 'Blue-black armor guide.', 'Black, dark blue, blue grey', 'Glaze transitions thinly.', 'private', '', ''],
  ],
}

const recipeSteps = {
  name: 'Guide Steps',
  rows: [
    ['import_action', 'recipe_key', 'step_number', 'title', 'instructions', 'image_url', 'notes'],
    ['upsert', 'recipe-aged-bone', 1, 'Basecoat', 'Apply an even ivory or bone basecoat.', '', ''],
    ['upsert', 'recipe-aged-bone', 2, 'Shade', 'Wash recesses with thinned brown shade.', '', ''],
    ['upsert', 'recipe-aged-bone', 3, 'Highlight', 'Edge highlight with off-white.', '', ''],
    ['upsert', 'recipe-cold-black-armor', 1, 'Basecoat', 'Basecoat the armor black.', '', ''],
    ['upsert', 'recipe-cold-black-armor', 2, 'First highlight', 'Highlight broad edges with a dark blue grey.', '', ''],
  ],
}

const recipeStepPaints = {
  name: 'Guide Step Paints',
  rows: [
    ['import_action', 'recipe_key', 'step_number', 'paint_order', 'paint_source', 'brand', 'line', 'paint_name', 'sku', 'catalog_paint_id', 'custom_paint_key', 'ratio_text', 'notes'],
    ['upsert', 'recipe-aged-bone', 1, 1, 'catalog', 'Vallejo', 'Model Color', 'Ivory', '70.918', '', '', '1 part', ''],
    ['upsert', 'recipe-aged-bone', 2, 1, 'catalog', 'Citadel', 'Shade', 'Agrax Earthshade', '', '', '', 'thin glaze', ''],
    ['upsert', 'recipe-aged-bone', 3, 1, 'custom', '', '', '', '', '', 'custom-ash-grey', 'edge highlight', 'Example custom paint reference'],
    ['upsert', 'recipe-cold-black-armor', 1, 1, 'catalog', 'Citadel', 'Base', 'Abaddon Black', '', '', '', '1 part', ''],
    ['upsert', 'recipe-cold-black-armor', 2, 1, 'catalog', 'Vallejo', 'Model Color', 'Dark Blue Grey', '70.904', '', '', '1 part', ''],
  ],
}

const recipeImportGuide = {
  name: 'Guide',
  rows: [
    ['Topic', 'How to use the guide importer'],
    ['File type', 'This is an Excel workbook. CSV files cannot contain multiple tabs.'],
    ['Tabs', 'Use Guide for instructions, Example Guide as a working reference, and Fill In for your actual import rows.'],
    ['Row shape', 'Each Fill In row creates or updates one guide step. Repeat recipe_key and recipe_name for every step in the same guide.'],
    ['Guide key', 'recipe_key is your temporary spreadsheet ID, such as recipe-aged-bone. It connects rows into one guide.'],
    ['Step order', 'Use step_number 1, 2, 3, and so on. The importer should rebuild steps in that order for each guide.'],
    ['Paint slots', 'Each step supports paint_1, paint_2, and paint_3. Leave unused paint slots blank.'],
    ['Catalog paints', 'For catalog paints, use paint_source catalog and provide catalog_paint_id, or sku, or brand + line + paint_name.'],
    ['Custom paints', 'For custom paints, use paint_source custom and provide paint_name plus optional brand, line, and color_hex.'],
    ['Ratios', 'ratio_text is freeform: examples include 1 part, 2:1, thin glaze, edge highlight, or optional.'],
    ['Visibility', 'visibility accepts private or public. Blank means private.'],
    ['Import action', 'import_action accepts upsert, create_only, update_only, or skip. Blank means upsert.'],
    ['Required columns', 'recipe_key, recipe_name, step_number, and step_title are required. Paint columns are optional.'],
  ],
}

const flattenedRecipeHeaders = [
  'import_action',
  'recipe_key',
  'recipe_name',
  'recipe_description',
  'inventory_required',
  'expert_tips',
  'visibility',
  'youtube_url',
  'step_number',
  'step_title',
  'step_instructions',
  'step_image_url',
  'paint_1_source',
  'paint_1_brand',
  'paint_1_line',
  'paint_1_name',
  'paint_1_sku',
  'paint_1_catalog_paint_id',
  'paint_1_color_hex',
  'paint_1_ratio_text',
  'paint_2_source',
  'paint_2_brand',
  'paint_2_line',
  'paint_2_name',
  'paint_2_sku',
  'paint_2_catalog_paint_id',
  'paint_2_color_hex',
  'paint_2_ratio_text',
  'paint_3_source',
  'paint_3_brand',
  'paint_3_line',
  'paint_3_name',
  'paint_3_sku',
  'paint_3_catalog_paint_id',
  'paint_3_color_hex',
  'paint_3_ratio_text',
  'notes',
]

const flattenedRecipeExample = {
  name: 'Example Guide',
  rows: [
    flattenedRecipeHeaders,
    [
      'upsert',
      'recipe-aged-bone',
      'Aged Bone',
      'Warm bone guide for infantry.',
      'Ivory primer, brown wash, off-white highlight',
      'Keep final highlights on upper edges.',
      'private',
      '',
      1,
      'Basecoat',
      'Apply an even ivory or bone basecoat.',
      '',
      'catalog',
      'Vallejo',
      'Model Color',
      'Ivory',
      '70.918',
      '',
      '',
      '1 part',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    [
      'upsert',
      'recipe-aged-bone',
      'Aged Bone',
      'Warm bone guide for infantry.',
      'Ivory primer, brown wash, off-white highlight',
      'Keep final highlights on upper edges.',
      'private',
      '',
      2,
      'Shade',
      'Wash recesses with thinned brown shade.',
      '',
      'catalog',
      'Citadel',
      'Shade',
      'Agrax Earthshade',
      '',
      '',
      '',
      'thin glaze',
      'custom',
      'Bench Mix',
      'Weathering',
      'Verdigris Mix',
      '',
      '',
      '#49A997',
      'optional tint',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    [
      'upsert',
      'recipe-aged-bone',
      'Aged Bone',
      'Warm bone guide for infantry.',
      'Ivory primer, brown wash, off-white highlight',
      'Keep final highlights on upper edges.',
      'private',
      '',
      3,
      'Highlight',
      'Edge highlight with off-white.',
      '',
      'catalog',
      'Vallejo',
      'Model Color',
      'Off White',
      '70.820',
      '',
      '',
      'edge highlight',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
  ],
}

const flattenedRecipeFillIn = {
  name: 'Fill In',
  rows: [flattenedRecipeHeaders],
}

const unitStageLinks = {
  name: 'Unit Stage Links',
  rows: [
    ['import_action', 'unit_key', 'stage_key', 'link_type', 'recipe_key', 'paint_source', 'brand', 'line', 'paint_name', 'sku', 'catalog_paint_id', 'custom_paint_key', 'sort_order', 'notes'],
    ['upsert', 'unit-skeletons', 'initial_paints', 'recipe', 'recipe-aged-bone', '', '', '', '', '', '', '', 1, 'Attach guide to stage'],
    ['upsert', 'unit-vampire', 'fine_details', 'recipe', 'recipe-cold-black-armor', '', '', '', '', '', '', '', 1, 'Attach guide to stage'],
    ['upsert', 'unit-vampire', 'fine_details', 'paint', '', 'custom', '', '', '', '', '', 'custom-verdigris-mix', 2, 'Loose stage paint'],
  ],
}

const allSheets = [
  instructions,
  paintCollection,
  customPaints,
  projects,
  units,
  recipes,
  recipeSteps,
  recipeStepPaints,
  unitStageLinks,
  reference,
]

await fs.mkdir(outDir, { recursive: true })
if (target === 'all' || target === 'full') {
  await writeWorkbook('obsidian-gallery-import-template.xlsx', allSheets)
}
if (target === 'all' || target === 'paints') {
  await writeWorkbook('paint-collection-import-template.xlsx', [
    instructions,
    paintCollection,
    customPaints,
    reference,
  ])
}
if (target === 'all' || target === 'projects-units') {
  await writeWorkbook('projects-units-import-template.xlsx', [
    instructions,
    projects,
    units,
    unitStageLinks,
    reference,
  ])
}
if (target === 'all' || target === 'recipes') {
  await writeWorkbook('recipes-import-template.xlsx', [
    recipeImportGuide,
    flattenedRecipeExample,
    flattenedRecipeFillIn,
  ])
}

console.log(`Wrote import templates to ${outDir}`)
