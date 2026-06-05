'use client'

import { useState } from 'react'

type VaultTab = 'find' | 'collection'
type ExportFormat = 'csv' | 'txt' | 'json'

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

const formatLabels: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'txt', label: 'TXT' },
  { value: 'json', label: 'JSON' },
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
  if (format === 'json') return 'application/json'
  if (format === 'csv') return 'text/csv'
  return 'text/plain'
}

function buildFileContent(format: ExportFormat, rows: ExportRow[]) {
  if (format === 'json') return JSON.stringify(rows, null, 2)
  if (format === 'txt') return buildTxt(rows)
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

export default function VaultExportButton({
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
        }),
      })

      const json = (await response.json()) as ExportResponse

      if (!response.ok) {
        throw new Error(json.error || 'Export failed.')
      }

      downloadFile({
        content: buildFileContent(format, json.rows),
        filename: json.filename,
        format,
      })

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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-export-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-[0_0_40px_rgba(34,211,238,0.18)]">
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
                      'rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.16em] transition',
                      isSelected
                        ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.16)]'
                        : 'border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                )
              })}

              <button
                type="button"
                disabled
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white/25"
              >
                PDF
                <span className="mt-1 block text-[9px] tracking-[0.12em]">
                  Coming later
                </span>
              </button>
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
