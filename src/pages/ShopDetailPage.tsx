import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  listShopProviderAccounts,
  listShops,
  listSettlements,
  type ProviderAccount,
  type Settlement,
  type Shop,
} from '../lib/api'

export function ShopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { decoded } = useAuth()
  const merchantId = decoded?.merchant_id ?? null

  const [shop, setShop] = useState<Shop | null>(null)
  const [accounts, setAccounts] = useState<ProviderAccount[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [error, setError] = useState<string | null>(null)

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

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Providers</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 12px' }}>
        Set up once for your whole business by PayPulse. Every device registered at this shop can use them.
      </p>

      {accounts.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 28 }}>
          No providers have been set up for your business yet. Contact PayPulse.
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
                <Td className="num">
                  {a.is_active ? (a.cached_balance !== null ? `LSL ${a.cached_balance}` : '—') : 'Switched off'}
                </Td>
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
