import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getCommissionSummary,
  getCurrentCommissionRate,
  listCommissionEntries,
  listCommissionRateHistory,
  listProviders,
  setCommissionRate,
  type CommissionEntry,
  type CommissionRate,
  type CommissionSummary,
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
      {currentRate ? (
        <p className="num" style={{ fontSize: 13, margin: '0 0 24px' }}>
          {describeRate(currentRate)}
        </p>
      ) : (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 24px' }}>
          No rate configured yet — set one below.
        </p>
      )}

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
  const pct = `${(parseFloat(rate.percentage) * 100).toFixed(2)}%`
  const flat = `LSL ${rate.flat_fee}`
  if (rate.commission_type === 'percentage') return pct
  if (rate.commission_type === 'flat') return flat
  return `${pct} + ${flat}`
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
