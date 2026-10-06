import type { ReportSummary } from './api'

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD (not toISOString(), which shifts to UTC). */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export type PresetKey = 'today' | 'last7' | 'month' | 'lastMonth'

export function presetRange(key: PresetKey, now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (key) {
    case 'today':
      return { from: toISODate(today), to: toISODate(today) }
    case 'last7': {
      const start = new Date(today)
      start.setDate(start.getDate() - 6) // today plus the six days before it
      return { from: toISODate(start), to: toISODate(today) }
    }
    case 'month':
      return { from: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toISODate(today) }
    case 'lastMonth':
      return {
        from: toISODate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: toISODate(new Date(today.getFullYear(), today.getMonth(), 0)),
      }
  }
}

const numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "1234.5" -> "1,234.50" */
export const money = (value: string) => numberFormat.format(parseFloat(value))

/** Commission as a share of the amount moved, or a dash when nothing moved. */
export function effectiveRate(commission: string, volume: string): string {
  const v = parseFloat(volume)
  return v > 0 ? `${((parseFloat(commission) / v) * 100).toFixed(2)}%` : '—'
}

const csvCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`

/** The by-provider table plus a totals row — the thing you check against a provider's own statement. */
export function buildProviderCsv(r: ReportSummary): string {
  const t = r.totals
  const rows: string[][] = [
    [`PayPulse report ${r.date_from} to ${r.date_to} (${r.timezone}, amounts in ${r.currency})`],
    ['Provider', 'Confirmed transactions', 'Collections', 'Withdrawals', 'Total moved', 'Commission', 'Effective rate', 'Current rate'],
    ...r.by_provider.map((p) => [
      p.provider_name,
      String(p.confirmed_count),
      p.collections_volume,
      p.withdrawals_volume,
      p.volume,
      p.commission,
      effectiveRate(p.commission, p.volume),
      p.current_rate ?? 'not set',
    ]),
    ['Total', String(t.confirmed_count), t.collections_volume, t.withdrawals_volume, t.volume, t.commission, effectiveRate(t.commission, t.volume), ''],
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
