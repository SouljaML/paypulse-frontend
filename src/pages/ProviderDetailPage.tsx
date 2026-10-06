import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getCommissionSummary,
  getCurrentCommissionRate,
  listCommissionEntries,
  listCommissionRateHistory,
  listProviders,
  previewCommission,
  setCommissionRate,
  setCommissionTiers,
  type CommissionEntry,
  type CommissionRate,
  type CommissionSummary,
  type CommissionTier,
  type CommissionTierInput,
  type CommissionType,
  type Provider,
} from '../lib/api'

export function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [currentRate, setCurrentRate] = useState<CommissionRate | null>(null)
  const [history, setHistory] = useState<CommissionRate[]>([])
  const [summary, setSummary] = useState<CommissionSummary | null>(null)
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!id) return
    const [providers, rate, hist, sum, ent] = await Promise.all([
      listProviders(),
      getCurrentCommissionRate(id),
      listCommissionRateHistory(id),
      getCommissionSummary(id),
      listCommissionEntries(id),
    ])
    setProvider(providers.find((p) => p.id === id) ?? null)
    setCurrentRate(rate)
    setHistory(hist)
    setSummary(sum)
    setEntries(ent)
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!provider) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <Link to="/providers" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        ← Providers
      </Link>

      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 24px' }}>{provider.name}</h1>

      <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
        <SummaryStat label="Total commission earned" value={`LSL ${summary?.total_commission ?? '0.00'}`} />
        <SummaryStat label="Confirmed transactions" value={String(summary?.transaction_count ?? 0)} />
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Current rate</h2>
      {currentRate && currentRate.tiers.length > 0 ? (
        <table style={{ borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Amount range</Th>
              <Th>Provider fee</Th>
              <Th>Our commission</Th>
            </tr>
          </thead>
          <tbody>
            {currentRate.tiers.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td className="num">{describeRange(t)}</Td>
                <Td className="num">LSL {t.provider_fee}</Td>
                <Td className="num">{describeShare(t)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : currentRate ? (
        <p className="num" style={{ fontSize: 13, margin: '0 0 24px' }}>
          {describeRate(currentRate)}
        </p>
      ) : (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 24px' }}>
          No rate configured yet — set one below.
        </p>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Tiered fees</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: '0 0 12px', maxWidth: 680 }}>
        For each amount band, enter the fee the provider charges and what we keep of it: our commission is the
        provider fee × our percentage, plus any flat fee. A band covers its min through its max, both included, and
        bands can't overlap. An amount that falls outside every band earns no commission and shows as
        "uncommissioned" in reports. Saving replaces the whole schedule and applies to transactions confirmed from
        now on; past ones keep what they recorded. Use this OR the single rate below — whichever you saved last is
        the one in force.
      </p>
      <TierEditor key={currentRate?.id ?? 'none'} providerId={id!} currentRate={currentRate} onSaved={reload} />

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '32px 0 12px' }}>Single rate (no tiers)</h2>
      <RateForm providerId={id!} onSaved={reload} />

      {history.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '32px 0 12px' }}>Rate history</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Th>Rate</Th>
                <Th>Effective from</Th>
                <Th>Effective to</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                  <Td className="num">{describeRate(r)}</Td>
                  <Td className="num">{new Date(r.effective_from).toLocaleString()}</Td>
                  <Td className="num">{r.effective_to ? new Date(r.effective_to).toLocaleString() : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Commission ledger</h2>
      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          No commission entries yet — they're recorded the moment a transaction is confirmed.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Transaction</Th>
              <Th>Type</Th>
              <Th>Amount</Th>
              <Th>Recorded</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td className="num">{e.transaction_id.slice(0, 8)}</Td>
                <Td>{e.entry_type}</Td>
                <Td className="num">LSL {e.amount}</Td>
                <Td className="num">{new Date(e.created_at).toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function describeRate(rate: CommissionRate): string {
  if (rate.tiers.length > 0) return `Tiered · ${rate.tiers.length} band${rate.tiers.length === 1 ? '' : 's'}`
  const pct = `${(parseFloat(rate.percentage) * 100).toFixed(2)}%`
  const flat = `LSL ${rate.flat_fee}`
  if (rate.commission_type === 'percentage') return pct
  if (rate.commission_type === 'flat') return flat
  return `${pct} + ${flat}`
}

function describeRange(t: { min_amount: string; max_amount: string | null }): string {
  return t.max_amount === null ? `LSL ${t.min_amount} and above` : `LSL ${t.min_amount} – ${t.max_amount}`
}

/** "20% of fee + LSL 0.10", "20% of fee", "LSL 0.10", or "—" when we keep nothing. */
function describeShare(t: CommissionTier): string {
  const pct = parseFloat(t.percentage)
  const flat = parseFloat(t.flat_fee)
  const parts: string[] = []
  if (pct > 0) parts.push(`${Math.round(pct * 10000) / 100}% of fee`)
  if (flat > 0) parts.push(`LSL ${t.flat_fee}`)
  return parts.length > 0 ? parts.join(' + ') : '—'
}

/** Percent the user types (20) <-> fraction the API stores (0.2). */
function percentToFraction(percent: string): string {
  const v = Number(percent)
  if (percent.trim() === '' || !Number.isFinite(v)) return 'NaN'
  return (Math.round(v * 100) / 10000).toFixed(4)
}

function fractionToPercent(fraction: string): string {
  const v = Number(fraction)
  return Number.isFinite(v) ? String(Math.round(v * 10000) / 100) : '0'
}

type TierRow = { min: string; max: string; fee: string; pct: string; flat: string }

function rowsFromRate(rate: CommissionRate | null): TierRow[] {
  if (rate && rate.tiers.length > 0) {
    return rate.tiers.map((t) => ({
      min: t.min_amount,
      max: t.max_amount ?? '',
      fee: t.provider_fee,
      pct: fractionToPercent(t.percentage),
      flat: t.flat_fee,
    }))
  }
  return [{ min: '', max: '', fee: '', pct: '', flat: '0.00' }]
}

/** Server validation errors arrive as a JSON array of {msg}; show just the messages. */
function readableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Could not save'
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((p) => String(p.msg ?? p).replace(/^Value error, /, '')).join('; ')
    }
  } catch {
    // not JSON — use as is
  }
  return raw
}

function TierEditor({
  providerId,
  currentRate,
  onSaved,
}: {
  providerId: string
  currentRate: CommissionRate | null
  onSaved: () => Promise<void>
}) {
  const [rows, setRows] = useState<TierRow[]>(() => rowsFromRate(currentRate))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [previewAmount, setPreviewAmount] = useState('')
  const [previewResult, setPreviewResult] = useState<string | null>(null)

  function update(i: number, patch: Partial<TierRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function addBand() {
    setFormError(null)
    setRows((rs) => {
      // Suggest the next band's min as one cent above the previous max; it's only a suggestion.
      const lastMax = Number(rs[rs.length - 1].max)
      const suggested = rs[rs.length - 1].max.trim() !== '' && Number.isFinite(lastMax) ? (lastMax + 0.01).toFixed(2) : ''
      return [...rs, { min: suggested, max: '', fee: '', pct: rs[rs.length - 1].pct, flat: rs[rs.length - 1].flat }]
    })
  }

  function removeBand(i: number) {
    setFormError(null)
    setRows((rs) => rs.filter((_, idx) => idx !== i))
  }

  function money(label: string, value: string, allowEmpty = false): string | null | { error: string } {
    if (value.trim() === '') return allowEmpty ? null : { error: `${label} is required.` }
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0) return { error: `${label} must be 0 or more.` }
    return n.toFixed(2)
  }

  function buildInput(): CommissionTierInput[] | string {
    const out: CommissionTierInput[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const where = `Band ${i + 1}`
      const min = money(`${where}: min amount`, r.min)
      const max = money(`${where}: max amount`, r.max, true)
      const fee = money(`${where}: provider fee`, r.fee)
      const flat = money(`${where}: flat fee`, r.flat === '' ? '0' : r.flat)
      for (const v of [min, max, fee, flat]) if (v !== null && typeof v === 'object') return v.error
      const fraction = percentToFraction(r.pct === '' ? '0' : r.pct)
      if (fraction === 'NaN' || Number(fraction) < 0 || Number(fraction) > 1)
        return `${where}: our percentage must be between 0 and 100.`
      if (max !== null && Number(max) < Number(min)) return `${where}: max amount can't be below min amount.`
      out.push({
        min_amount: min as string,
        max_amount: max as string | null,
        provider_fee: fee as string,
        percentage: fraction,
        flat_fee: flat as string,
      })
    }
    return out
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const input = buildInput()
    if (typeof input === 'string') {
      setFormError(input)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await setCommissionTiers(providerId, input)
      await onSaved()
    } catch (err) {
      setFormError(readableError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handlePreview() {
    setPreviewResult(null)
    try {
      const r = await previewCommission(providerId, previewAmount)
      setPreviewResult(
        r.rate_id === null
          ? 'No rate configured — nothing would be recorded.'
          : r.commission === null
            ? `No band covers LSL ${r.amount} — nothing would be recorded.`
            : r.provider_fee !== null
              ? `LSL ${r.amount} → provider fee LSL ${r.provider_fee}, our commission LSL ${r.commission}`
              : `LSL ${r.amount} → commission LSL ${r.commission}`,
      )
    } catch (err) {
      setPreviewResult(readableError(err))
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <form onSubmit={handleSave}>
        <table style={{ borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Min amount (LSL)</Th>
              <Th>Max amount (LSL)</Th>
              <Th>Provider fee (LSL)</Th>
              <Th>Our % of the fee</Th>
              <Th>Flat fee (LSL)</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <td style={{ padding: '6px 12px' }}>
                  <input value={r.min} onChange={(e) => update(i, { min: e.target.value })} style={{ ...inputStyle, width: 110 }} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <input
                    value={r.max}
                    onChange={(e) => update(i, { max: e.target.value })}
                    placeholder="no limit"
                    style={{ ...inputStyle, width: 110 }}
                  />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <input value={r.fee} onChange={(e) => update(i, { fee: e.target.value })} style={{ ...inputStyle, width: 110 }} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <input
                    value={r.pct}
                    onChange={(e) => update(i, { pct: e.target.value })}
                    placeholder="e.g. 20"
                    style={{ ...inputStyle, width: 90 }}
                  />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <input value={r.flat} onChange={(e) => update(i, { flat: e.target.value })} style={{ ...inputStyle, width: 90 }} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeBand(i)} style={linkButtonStyle}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={addBand} style={secondaryButtonStyle}>
            + Add band
          </button>
          <button type="submit" disabled={saving} style={primaryButtonStyle}>
            {saving ? 'Saving…' : 'Save tiers'}
          </button>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            Leave "Max amount" empty on the highest band for no upper limit. Commission = provider fee × our % + flat fee.
          </span>
        </div>
        {formError && <div style={{ color: 'var(--status-bad)', fontSize: 13, marginTop: 8 }}>{formError}</div>}
      </form>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
        <input
          value={previewAmount}
          onChange={(e) => setPreviewAmount(e.target.value)}
          placeholder="Check an amount"
          style={{ ...inputStyle, width: 140 }}
        />
        <button type="button" onClick={handlePreview} disabled={previewAmount.trim() === ''} style={secondaryButtonStyle}>
          Check commission
        </button>
        {previewResult && <span className="num" style={{ fontSize: 13 }}>{previewResult}</span>}
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: '6px 0 0' }}>
        Uses the schedule currently saved (not unsaved edits above) — the same calculation a confirmation uses.
      </p>
    </div>
  )
}

function RateForm({ providerId, onSaved }: { providerId: string; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<CommissionType>('percentage_plus_flat')
  const [percentage, setPercentage] = useState('0.02')
  const [flatFee, setFlatFee] = useState('1.50')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await setCommissionRate(providerId, type, percentage, flatFee)
      await onSaved()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save rate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <label style={labelStyle}>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as CommissionType)} style={inputStyle}>
          <option value="percentage">Percentage only</option>
          <option value="flat">Flat fee only</option>
          <option value="percentage_plus_flat">Percentage + flat fee</option>
        </select>
      </div>
      {type !== 'flat' && (
        <div>
          <label style={labelStyle}>Percentage (0.02 = 2%)</label>
          <input value={percentage} onChange={(e) => setPercentage(e.target.value)} style={{ ...inputStyle, width: 120 }} />
        </div>
      )}
      {type !== 'percentage' && (
        <div>
          <label style={labelStyle}>Flat fee (LSL)</label>
          <input value={flatFee} onChange={(e) => setFlatFee(e.target.value)} style={{ ...inputStyle, width: 120 }} />
        </div>
      )}
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Saving…' : 'Save rate'}
      </button>
      {formError && <span style={{ color: 'var(--status-bad)', fontSize: 13 }}>{formError}</span>}
    </form>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="num" style={{ fontSize: 22, fontWeight: 500 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--text-dim)',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  padding: '7px 9px',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  background: 'var(--paper-raised)',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  fontSize: 13,
  cursor: 'pointer',
}

const linkButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--status-bad)',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={className} style={{ padding: '10px 12px', fontSize: 13 }}>
      {children}
    </td>
  )
}
