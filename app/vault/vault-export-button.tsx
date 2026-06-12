'use client'

import { useState } from 'react'
import type { CellHookData, RowInput } from 'jspdf-autotable'

type VaultTab = 'find' | 'collection'
type ExportFormat = 'csv' | 'txt' | 'json' | 'pdf'

type ExportRow = {
  brand: string
  line: string
  name: string
  status: string
  quantity: number
  barcode: string
  hex: string
  sku: string
  product_code: string
}

type ExportResponse = {
  rows: ExportRow[]
  filename: string
  exported_count: number
  error?: string
}

const formatLabels: {
  value: ExportFormat
  label: string
}[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'txt', label: 'TXT' },
  { value: 'json', label: 'JSON' },
  { value: 'pdf', label: 'PDF Checklist' },
]

const csvColumns: (keyof ExportRow)[] = [
  'brand',
  'line',
  'name',
  'status',
  'quantity',
  'barcode',
  'hex',
  'sku',
  'product_code',
]

function escapeCsvValue(value: string | number) {
  const text = String(value ?? '')

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function buildCsv(rows: ExportRow[]) {
  const header = csvColumns.join(',')
  const body = rows.map((row) =>
    csvColumns.map((column) => escapeCsvValue(row[column])).join(',')
  )

  return [header, ...body].join('\r\n')
}

function buildTxt(rows: ExportRow[]) {
  return rows
    .map((row) =>
      [
        row.brand,
        row.line,
        row.name,
        row.status,
        row.quantity,
      ].join(' | ')
    )
    .join('\n')
}

function getMimeType(format: ExportFormat) {
  if (format === 'pdf') return 'application/pdf'
  if (format === 'json') return 'application/json'
  if (format === 'csv') return 'text/csv'
  return 'text/plain'
}

function buildFileContent(format: ExportFormat, rows: ExportRow[]) {
  if (format === 'json') return JSON.stringify(rows, null, 2)
  if (format === 'txt') return buildTxt(rows)
  if (format === 'pdf') return ''
  return buildCsv(rows)
}

function downloadFile({
  content,
  filename,
  format,
}: {
  content: string
  filename: string
  format: ExportFormat
}) {
  const blob = new Blob([content], {
    type: `${getMimeType(format)};charset=utf-8`,
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatFilterLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getExportTitle({
  tab,
  brand,
  line,
  ownership,
}: {
  tab: VaultTab
  brand: string
  line: string
  ownership: string
}) {
  if (tab === 'collection') return 'My Paint Collection'
  if (ownership === 'wishlist') return 'Paint Wishlist'
  if (brand && line) return `${brand} ${line}`
  return 'Vault Paint Export'
}

function getActiveFilters({
  tab,
  q,
  brand,
  line,
  ownership,
}: {
  tab: VaultTab
  q: string
  brand: string
  line: string
  ownership: string
}) {
  const filters = [
    `Tab: ${tab === 'collection' ? 'My Collection' : 'Find Paints'}`,
  ]

  if (q) filters.push(`Search: ${q}`)
  if (brand) filters.push(`Brand: ${brand}`)
  if (line) filters.push(`Line: ${line}`)
  if (tab === 'collection') {
    filters.push('Ownership: Owned')
  } else if (ownership && ownership !== 'all') {
    filters.push(`Ownership: ${formatFilterLabel(ownership)}`)
  }

  return filters
}

function getNormalizedHex(hex: string) {
  const trimmed = hex.trim()
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`

  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : ''
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')

  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ]
}

type PdfTableRow = {
  checkbox: string | { content: string; colSpan: number }
  brand: string
  line: string
  name: string
  swatch: string
  hex?: string
  isGroup?: boolean
}

function buildPdfRows(rows: ExportRow[]) {
  const tableRows: (RowInput & Partial<PdfTableRow>)[] = []
  let activeGroup = ''

  rows.forEach((row) => {
    const group = `${row.brand || 'Unknown brand'} · ${row.line || 'Unknown line'}`

    if (group !== activeGroup) {
      activeGroup = group
      tableRows.push({
        checkbox: { content: group, colSpan: 5 },
        brand: '',
        line: '',
        name: '',
        swatch: '',
        isGroup: true,
      })
    }

    tableRows.push({
      checkbox: '',
      brand: row.brand,
      line: row.line,
      name: row.name,
      swatch: '',
      hex: getNormalizedHex(row.hex),
    })
  })

  return tableRows
}

async function downloadPdf({
  rows,
  filename,
  tab,
  q,
  brand,
  line,
  ownership,
}: {
  rows: ExportRow[]
  filename: string
  tab: VaultTab
  q: string
  brand: string
  line: string
  ownership: string
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42
  const title = getExportTitle({ tab, brand, line, ownership })
  const exportDate = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
  const filters = getActiveFilters({ tab, q, brand, line, ownership })

  doc.setProperties({
    title,
    subject: 'Obsidian Gallery Paint Vault export',
    creator: 'Obsidian Gallery',
  })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(title, margin, 48)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Exported from Obsidian Gallery · The Paint Vault', margin, 68)
  doc.text(`Export date: ${exportDate}`, margin, 84)
  doc.text(`Total paints: ${rows.length}`, margin, 100)

  doc.setFontSize(9)
  const filterText = doc.splitTextToSize(
    `Active filters: ${filters.join(' | ')}`,
    pageWidth - margin * 2
  )
  doc.text(filterText, margin, 120)

  autoTable(doc, {
    startY: 136 + filterText.length * 11,
    margin: { left: margin, right: margin, bottom: 42 },
    columns: [
      { header: '', dataKey: 'checkbox' },
      { header: 'Brand', dataKey: 'brand' },
      { header: 'Line', dataKey: 'line' },
      { header: 'Paint Name', dataKey: 'name' },
      { header: 'Swatch', dataKey: 'swatch' },
    ],
    body: buildPdfRows(rows),
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 7, right: 6, bottom: 7, left: 6 },
      lineColor: [200, 200, 200],
      lineWidth: 0.5,
      minCellHeight: 28,
      textColor: [20, 20, 20],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [20, 20, 20],
      fontStyle: 'bold',
      lineColor: [120, 120, 120],
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252],
    },
    columnStyles: {
      checkbox: { cellWidth: 34, halign: 'center' },
      brand: { cellWidth: 96 },
      line: { cellWidth: 112 },
      name: { cellWidth: 'auto' },
      swatch: { cellWidth: 54, halign: 'center' },
    },
    didParseCell: (data: CellHookData) => {
      const raw = data.row.raw as Partial<PdfTableRow>

      if (raw.isGroup) {
        data.cell.styles.fillColor = [235, 235, 235]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [20, 20, 20]
        data.cell.styles.minCellHeight = 24
      }
    },
    didDrawCell: (data: CellHookData) => {
      const raw = data.row.raw as Partial<PdfTableRow>

      if (
        data.section === 'body' &&
        data.column.dataKey === 'checkbox' &&
        !raw.isGroup
      ) {
        const size = 10
        const x = data.cell.x + (data.cell.width - size) / 2
        const y = data.cell.y + (data.cell.height - size) / 2

        doc.setDrawColor(20, 20, 20)
        doc.setLineWidth(0.9)
        doc.rect(x, y, size, size)
      }

      if (
        data.section === 'body' &&
        data.column.dataKey === 'swatch' &&
        raw.hex
      ) {
        const [red, green, blue] = hexToRgb(raw.hex)
        const swatchWidth = 24
        const swatchHeight = 12
        const x = data.cell.x + (data.cell.width - swatchWidth) / 2
        const y = data.cell.y + (data.cell.height - swatchHeight) / 2

        doc.setFillColor(red, green, blue)
        doc.setDrawColor(80, 80, 80)
        doc.setLineWidth(0.5)
        doc.rect(x, y, swatchWidth, swatchHeight, 'FD')
      }
    },
    didDrawPage: () => {
      const pageNumber = doc.getCurrentPageInfo().pageNumber

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(90, 90, 90)
      doc.text('Obsidian Gallery · The Paint Vault', margin, pageHeight - 22)
      doc.text(
        `Page ${pageNumber}`,
        pageWidth - margin,
        pageHeight - 22,
        { align: 'right' }
      )
      doc.setTextColor(20, 20, 20)
    },
  })

  doc.save(filename)
}

export default function VaultExportButton({
  tab,
  q,
  brand,
  line,
  ownership,
  matchHex = '',
}: {
  tab: VaultTab
  q: string
  brand: string
  line: string
  ownership: string
  matchHex?: string
}) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    setIsExporting(true)
    setError('')

    try {
      const response = await fetch('/api/vault/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          tab,
          q,
          brand,
          line,
          ownership,
          matchHex,
        }),
      })

      const json = (await response.json()) as ExportResponse

      if (!response.ok) {
        throw new Error(json.error || 'Export failed.')
      }

      if (format === 'pdf') {
        await downloadPdf({
          rows: json.rows,
          filename: json.filename,
          tab,
          q,
          brand,
          line,
          ownership,
        })
      } else {
        downloadFile({
          content: buildFileContent(format, json.rows),
          filename: json.filename,
          format,
        })
      }

      setOpen(false)
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'Export failed.'
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('')
          setOpen(true)
        }}
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)] transition hover:border-cyan-200/60 hover:bg-cyan-300/15 active:scale-95 sm:px-4"
      >
        Export List
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-black/70 px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-export-title"
        >
          <div className="max-h-[calc(100dvh-6rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-[0_0_40px_rgba(34,211,238,0.18)] sm:max-h-[calc(100dvh-2rem)]">
            <div className="space-y-2">
              <h2
                id="vault-export-title"
                className="text-lg font-black text-white"
              >
                Export current list
              </h2>

              <p className="text-sm leading-6 text-white/55">
                Export the paints currently shown with your active filters.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {formatLabels.map((option) => {
                const isSelected = format === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormat(option.value)}
                    className={[
                      'rounded-2xl border px-4 py-3 text-left text-sm font-black uppercase tracking-[0.16em] transition',
                      isSelected
                        ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.16)]'
                        : 'border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {error ? (
              <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
                {error}
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isExporting}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white/65 transition hover:bg-white/10 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.28)] transition active:scale-[0.98] disabled:opacity-60"
              >
                {isExporting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                ) : null}
                <span>{isExporting ? 'Exporting' : 'Export'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
