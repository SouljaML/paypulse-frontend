import { useEffect, useState } from 'react'
import { listProviders, listTransactions, type Provider, type Transaction, type TransactionStatus } from '../lib/api'

const STATUS_OPTIONS: TransactionStatus[] = [
  'initiated',
  'sent_to_provider',
  'pending_confirmation',
  'confirmed',
  'declined',
  'expired',
  'failed',
]

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [error, setError] = useState<string | null>(null)

  const [providerId, setProviderId] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function reload() {
    const data = await listTransactions({
      provider_id: providerId || undefined,
      status: (status as TransactionStatus) || undefined,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
    })
    setTransactions(data)
  }

  useEffect(() => {
    listProviders().then(setProviders).catch((err) => setError(err.message))
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFilter() {
    setError(null)
    try {
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load transactions')
    }
  }

  const providerName = (id: string) => providers.find((p) => p.id === id)?.name ?? id.slice(0, 8)

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Transactions</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        Across every merchant, most recent first.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Provider</label>
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={inputStyle}>
            <option value="">All</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={handleFilter} style={primaryButtonStyle}>
          Apply
        </button>
      </div>

      {error && <div style={{ color: 'var(--status-bad)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {!transactions ? (
        <div style={{ color: 'var(--text-dim)' }}>Loading…</div>
      ) : transactions.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No transactions match these filters.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Provider</Th>
              <Th>Type</Th>
              <Th>Amount</Th>
              <Th>Customer</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td>{providerName(t.provider_id)}</Td>
                <Td>{t.type}</Td>
                <Td className="num">LSL {t.amount}</Td>
                <Td className="num">{t.customer_msisdn || '—'}</Td>
                <Td>{t.status.replace(/_/g, ' ')}</Td>
                <Td className="num">{new Date(t.created_at).toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
  fontSize: 13,
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
