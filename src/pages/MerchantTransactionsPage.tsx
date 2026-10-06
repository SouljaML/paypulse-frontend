import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { listShops, listTellers, listTransactions, type Shop, type Teller, type Transaction, type TransactionStatus } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

const STATUS_OPTIONS: TransactionStatus[] = [
  'initiated',
  'sent_to_provider',
  'pending_confirmation',
  'confirmed',
  'declined',
  'expired',
  'failed',
]

export function MerchantTransactionsPage() {
  const { decoded } = useAuth()
  const merchantId = decoded?.merchant_id ?? null
  const isOwner = decoded?.role === 'merchant_owner'

  const [transactions, setTransactions] = useState<Transaction[] | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [tellers, setTellers] = useState<Teller[]>([])
  const [error, setError] = useState<string | null>(null)

  const [shopId, setShopId] = useState('')
  const [tellerId, setTellerId] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (isOwner && merchantId) {
      listShops(merchantId).then(setShops).catch(() => {})
      listTellers(merchantId).then(setTellers).catch(() => {})
    }
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  async function reload() {
    const data = await listTransactions({
      status: (status as TransactionStatus) || undefined,
    })
    setTransactions(data)
  }

  async function handleFilter() {
    setError(null)
    try {
      const data = await listTransactions({
        shop_id: shopId || undefined,
        initiated_by: tellerId || undefined,
        status: (status as TransactionStatus) || undefined,
        search: search || undefined,
      })
      setTransactions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load transactions')
    }
  }

  const shopName = (id: string | null) => (id ? shops.find((s) => s.id === id)?.name ?? id.slice(0, 8) : '—')

  if (error) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Transactions</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        {isOwner ? 'Across every shop, most recent first.' : 'Your own transactions, most recent first.'}
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
        {isOwner && (
          <div>
            <label style={labelStyle}>Shop</label>
            <select value={shopId} onChange={(e) => setShopId(e.target.value)} style={inputStyle}>
              <option value="">All</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {isOwner && tellers.length > 0 && (
          <div>
            <label style={labelStyle}>Teller</label>
            <select value={tellerId} onChange={(e) => setTellerId(e.target.value)} style={inputStyle}>
              <option value="">All</option>
              {tellers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
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
          <label style={labelStyle}>Search (phone or reference)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={handleFilter} style={primaryButtonStyle}>
          Apply
        </button>
      </div>

      {!transactions ? (
        <div style={{ color: 'var(--text-dim)' }}>Loading…</div>
      ) : transactions.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No transactions match these filters.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              {isOwner && <Th>Shop</Th>}
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
                {isOwner && <Td>{shopName(t.shop_id)}</Td>}
                <Td>{t.type}</Td>
                <Td className="num">LSL {t.amount}</Td>
                <Td className="num">{t.customer_msisdn || '—'}</Td>
                <Td>
                  <StatusBadge status={t.status} />
                </Td>
                <Td className="num">{new Date(t.created_at).toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }
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
