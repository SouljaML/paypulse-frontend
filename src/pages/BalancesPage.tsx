import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { getBalances, listProviderAccounts, type ProviderAccount } from '../lib/api'

export function BalancesPage() {
  const { decoded } = useAuth()
  const [accounts, setAccounts] = useState<ProviderAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const merchantId = decoded?.merchant_id ?? null
  const isTeller = decoded?.role === 'teller'

  async function load() {
    if (!merchantId) return
    // The server decides what each role may see; providers are set up once
    // for the whole merchant.
    setAccounts(await listProviderAccounts(merchantId))
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  async function handleRefresh() {
    if (!merchantId) return
    setRefreshing(true)
    setError(null)
    try {
      await getBalances(merchantId) // refreshes cached_balance server-side, merchant-wide
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh balances')
    } finally {
      setRefreshing(false)
    }
  }

  if (!merchantId) {
    return (
      <p style={{ color: 'var(--status-bad)', fontSize: 13 }}>
        Your account isn't linked to a merchant — nothing to show here.
      </p>
    )
  }

  if (error) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!accounts) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Balances</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>
            {isTeller ? 'Provider accounts available at your shop.' : 'Provider accounts set up for your business, usable in every shop.'}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} style={secondaryButtonStyle}>
          {refreshing ? 'Refreshing…' : 'Refresh balances'}
        </button>
      </div>

      {accounts.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No providers have been set up for your business yet. Contact PayPulse.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Provider</Th>
              <Th>Account</Th>
              <Th>Balance</Th>
              <Th>As of</Th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td style={{ fontWeight: 500 }}>{a.provider_name}</Td>
                <Td className="num">{a.account_identifier}</Td>
                <Td className="num">{a.is_active ? (a.cached_balance !== null ? `LSL ${a.cached_balance}` : 'Not available') : 'Switched off'}</Td>
                <Td className="num">
                  {a.balance_updated_at ? new Date(a.balance_updated_at).toLocaleString() : '—'}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--paper-raised)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  fontSize: 13,
  cursor: 'pointer',
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>
      {children}
    </th>
  )
}

function Td({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <td className={className} style={{ padding: '10px 12px', fontSize: 13, ...style }}>
      {children}
    </td>
  )
}
