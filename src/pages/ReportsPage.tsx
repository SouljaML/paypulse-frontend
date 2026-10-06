import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getReportSummary, type ReportDayRow, type ReportSummary } from '../lib/api'
import { buildProviderCsv, downloadCsv, effectiveRate, money, presetRange, toISODate, type PresetKey } from '../lib/reportFormat'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
]

export function ReportsPage() {
  const [preset, setPreset] = useState<PresetKey | 'custom'>('month')
  const [range, setRange] = useState(() => presetRange('month'))
  const [draftFrom, setDraftFrom] = useState(range.from)
  const [draftTo, setDraftTo] = useState(range.to)
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If the range changes again before this answer arrives, drop it —
    // otherwise a slow earlier request could overwrite a newer one.
    let stale = false
    setLoading(true)
    setError(null)
    getReportSummary(range.from, range.to)
      .then((r) => !stale && setReport(r))
      .catch((err) => !stale && setError(err instanceof Error ? err.message : 'Could not load the report'))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [range])

  function choosePreset(key: PresetKey) {
    const next = presetRange(key)
    setPreset(key)
    setRange(next)
    setDraftFrom(next.from)
    setDraftTo(next.to)
  }

  function applyCustom() {
    if (!draftFrom || !draftTo) return
    setPreset('custom')
    setRange({ from: draftFrom, to: draftTo })
  }

  const t = report?.totals
  const decided = report ? report.outcomes.confirmed + report.outcomes.declined + report.outcomes.failed + report.outcomes.expired : 0
  const successRate = report && decided > 0 ? `${Math.round((report.outcomes.confirmed / decided) * 100)}%` : '—'
  const unearning = report?.by_provider.filter((p) => p.uncommissioned_count > 0) ?? []

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Reports</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        Confirmed transactions only, counted on the day they were confirmed
        {report ? ` (${report.timezone} time)` : ''}.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 24 }}>
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => choosePreset(p.key)} style={presetStyle(preset === p.key)}>
            {p.label}
          </button>
        ))}
        <div style={{ marginLeft: 8 }}>
          <label htmlFor="rep-from" style={labelStyle}>From</label>
          <input id="rep-from" type="date" value={draftFrom} max={draftTo} onChange={(e) => setDraftFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="rep-to" style={labelStyle}>To</label>
          <input id="rep-to" type="date" value={draftTo} min={draftFrom} max={toISODate(new Date())} onChange={(e) => setDraftTo(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={applyCustom} style={presetStyle(preset === 'custom')}>
          Apply dates
        </button>
        <div style={{ flex: 1 }} />
        {report && (
          <button
            onClick={() => downloadCsv(`paypulse-report-${report.date_from}-to-${report.date_to}.csv`, buildProviderCsv(report))}
            style={presetStyle(false)}
          >
            Download CSV
          </button>
        )}
      </div>

      {error && <div style={{ color: 'var(--status-bad)', fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {!report && loading && <div style={{ color: 'var(--text-dim)' }}>Loading…</div>}

      {report && t && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 28 }}>
            <Stat label="Total moved" value={`${report.currency} ${money(t.volume)}`} />
            <Stat label="Commission earned" value={`${report.currency} ${money(t.commission)}`} />
            <Stat label="Confirmed transactions" value={String(t.confirmed_count)} />
            <Stat label="Effective commission" value={effectiveRate(t.commission, t.volume)} />
            <Stat label="Success rate" value={successRate} note="of attempts that got an answer" />
          </div>

          {unearning.length > 0 && (
            <div
              style={{
                background: 'var(--status-pending-bg)',
                color: 'var(--status-pending)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                fontSize: 13,
                marginBottom: 24,
              }}
            >
              {t.uncommissioned_count} confirmed transaction{t.uncommissioned_count === 1 ? '' : 's'} earned no commission
              ({unearning.map((p) => p.provider_name).join(', ')}) — no rate was set when they confirmed.{' '}
              <Link to="/providers" style={{ color: 'inherit', fontWeight: 600 }}>Set rates</Link>
            </div>
          )}

          {t.confirmed_count === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>No confirmed transactions in this period.</p>
          )}

          <h2 style={h2Style}>By provider</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Th>Provider</Th>
                <Th right>Transactions</Th>
                <Th right>Collections</Th>
                <Th right>Withdrawals</Th>
                <Th right>Total moved</Th>
                <Th right>Commission</Th>
                <Th right>Effective</Th>
                <Th>Current rate</Th>
              </tr>
            </thead>
            <tbody>
              {report.by_provider.map((p) => (
                <tr key={p.provider_id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                  <Td style={{ fontWeight: 500 }}>{p.provider_name}</Td>
                  <Td right>{p.confirmed_count}</Td>
                  <Td right>{money(p.collections_volume)}</Td>
                  <Td right>{money(p.withdrawals_volume)}</Td>
                  <Td right>{money(p.volume)}</Td>
                  <Td right>{money(p.commission)}</Td>
                  <Td right>{effectiveRate(p.commission, p.volume)}</Td>
                  <Td style={{ color: p.current_rate ? undefined : 'var(--status-pending)' }}>{p.current_rate ?? 'Not set'}</Td>
                </tr>
              ))}
              <tr style={{ fontWeight: 600 }}>
                <Td>Total</Td>
                <Td right>{t.confirmed_count}</Td>
                <Td right>{money(t.collections_volume)}</Td>
                <Td right>{money(t.withdrawals_volume)}</Td>
                <Td right>{money(t.volume)}</Td>
                <Td right>{money(t.commission)}</Td>
                <Td right>{effectiveRate(t.commission, t.volume)}</Td>
                <Td>{''}</Td>
              </tr>
            </tbody>
          </table>

          {report.by_day.length > 1 && (
            <>
              <h2 style={h2Style}>Moved per day</h2>
              <DailyBars days={report.by_day} currency={report.currency} />
            </>
          )}

          <h2 style={{ ...h2Style, marginTop: 32 }}>By merchant</h2>
          {report.by_merchant.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Nothing to show for this period.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                  <Th>Merchant</Th>
                  <Th right>Transactions</Th>
                  <Th right>Total moved</Th>
                  <Th right>Commission</Th>
                </tr>
              </thead>
              <tbody>
                {report.by_merchant.slice(0, 10).map((m) => (
                  <tr key={m.merchant_id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                    <Td style={{ fontWeight: 500 }}>{m.merchant_name}</Td>
                    <Td right>{m.confirmed_count}</Td>
                    <Td right>{money(m.volume)}</Td>
                    <Td right>{money(m.commission)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {report.by_merchant.length > 10 && (
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Top 10 of {report.by_merchant.length} merchants by amount moved.</p>
          )}

          <h2 style={{ ...h2Style, marginTop: 32 }}>Attempts in this period</h2>
          <p className="num" style={{ fontSize: 13, margin: 0 }}>
            {report.outcomes.confirmed} confirmed, {report.outcomes.declined} declined, {report.outcomes.failed} failed,{' '}
            {report.outcomes.expired} expired, {report.outcomes.pending} still pending
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: '4px 0 0' }}>
            Counted by when each attempt was made, so this can differ from the confirmed count above.
          </p>
        </div>
      )}
    </div>
  )
}

function DailyBars({ days, currency }: { days: ReportDayRow[]; currency: string }) {
  const peak = Math.max(...days.map((d) => parseFloat(d.volume)), 0)
  return (
    <div style={{ maxWidth: 900 }}>
      <div
        role="img"
        aria-label={`Amount moved per day, from ${days[0].day} to ${days[days.length - 1].day}`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: days.length > 45 ? 1 : 3, height: 120 }}
      >
        {days.map((d) => {
          const v = parseFloat(d.volume)
          return (
            <div
              key={d.day}
              title={`${d.day}: ${currency} ${money(d.volume)} moved, ${currency} ${money(d.commission)} commission, ${d.confirmed_count} transactions`}
              style={{
                flex: 1,
                height: peak > 0 ? `${Math.max((v / peak) * 100, v > 0 ? 2 : 0)}%` : 0,
                minHeight: 1,
                background: v > 0 ? 'var(--accent)' : 'var(--hairline)',
                borderRadius: '2px 2px 0 0',
              }}
            />
          )
        })}
      </div>
      <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
        <span>{days[0].day}</span>
        <span>Busiest day: {currency} {money(String(peak))}</span>
        <span>{days[days.length - 1].day}</span>
      </div>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="num" style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</div>
      {note && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{note}</div>}
    </div>
  )
}

const h2Style: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: '0 0 12px' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  background: 'var(--paper-raised)',
  fontSize: 13,
}

function presetStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 12px',
    background: active ? 'var(--accent)' : 'var(--paper-raised)',
    color: active ? '#fff' : 'var(--text)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline)'}`,
    borderRadius: 'var(--radius)',
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th style={{ textAlign: right ? 'right' : 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>
      {children}
    </th>
  )
}

function Td({ children, right, style }: { children: React.ReactNode; right?: boolean; style?: React.CSSProperties }) {
  // Figures line up like a ledger: right-aligned, monospaced.
  return (
    <td className={right ? 'num' : undefined} style={{ textAlign: right ? 'right' : 'left', padding: '10px 12px', fontSize: 13, ...style }}>
      {children}
    </td>
  )
}
