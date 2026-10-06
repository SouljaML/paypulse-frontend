import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  createShopProviderAccount,
  listShopProviderAccounts,
  listShops,
  listSettlements,
  type ProviderAccount,
  type Settlement,
  type Shop,
} from '../lib/api'

const PROVIDER_KEYS = ['cpay', 'mpesa', 'ecocash', 'mywallet', 'khetsi']

export function ShopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { decoded } = useAuth()
  const merchantId = decoded?.merchant_id ?? null

  const [shop, setShop] = useState<Shop | null>(null)
  const [accounts, setAccounts] = useState<ProviderAccount[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function reload() {
    if (!merchantId || !id) return
    const [shops, accs, settle] = await Promise.all([
      listShops(merchantId),
      listShopProviderAccounts(merchantId, id),
      listSettlements(merchantId),
    ])
    setShop(shops.find((s) => s.id === id) ?? null)
    setAccounts(accs)
    setSettlements(settle.filter((s) => s.shop_id === id))
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, id])

  if (error) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!shop) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <Link to="/shops" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        ← Shops
      </Link>

      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 4px' }}>{shop.name}</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 28px' }}>{shop.location ?? 'No location set'}</p>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Provider accounts</h2>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Add provider account'}
        </button>
      </div>

      {showForm && merchantId && id && (
        <AddAccountForm
          merchantId={merchantId}
          shopId={id}
          onCreated={() => {
            setShowForm(false)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      {accounts.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 28 }}>
          No provider accounts registered for this shop yet.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Provider</Th>
              <Th>Account</Th>
              <Th>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td>{a.provider_name}</Td>
                <Td className="num">{a.account_identifier}</Td>
                <Td className="num">{a.cached_balance !== null ? `LSL ${a.cached_balance}` : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Settlements</h2>
      {settlements.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No settlement snapshots yet for this shop.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Date</Th>
              <Th>Provider</Th>
              <Th>Collections</Th>
              <Th>Withdrawals</Th>
              <Th>Closing</Th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td className="num">{new Date(s.settlement_date).toLocaleDateString()}</Td>
                <Td>{s.provider_name}</Td>
                <Td className="num">{s.total_collections}</Td>
                <Td className="num">{s.total_withdrawals}</Td>
                <Td className="num">{s.computed_closing_balance}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function AddAccountForm({
  merchantId,
  shopId,
  onCreated,
}: {
  merchantId: string
  shopId: string
  onCreated: () => void
}) {
  const [providerKey, setProviderKey] = useState('cpay')
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await createShopProviderAccount(merchantId, shopId, providerKey, accountId)
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        padding: 16,
        marginBottom: 20,
        background: 'var(--paper-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div>
        <label style={labelStyle}>Provider</label>
        <select value={providerKey} onChange={(e) => setProviderKey(e.target.value)} style={inputStyle}>
          {PROVIDER_KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Account identifier</label>
        <input value={accountId} onChange={(e) => setAccountId(e.target.value)} required style={inputStyle} />
      </div>
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Adding…' : 'Add account'}
      </button>
      {formError && <span style={{ color: 'var(--status-bad)', fontSize: 13 }}>{formError}</span>}
    </form>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  padding: '7px 9px',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  background: 'var(--paper)',
}
const secondaryButtonStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--paper-raised)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  fontSize: 13,
  cursor: 'pointer',
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
  whiteSpace: 'nowrap',
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
