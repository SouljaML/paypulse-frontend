import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { createShop, listShops, setShopStatus, type Shop } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

export function ShopsPage() {
  const { decoded } = useAuth()
  const merchantId = decoded?.merchant_id ?? null
  const [shops, setShops] = useState<Shop[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    if (!merchantId) return
    setShops(await listShops(merchantId))
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  async function handleToggle(shop: Shop) {
    if (!merchantId) return
    setBusyId(shop.id)
    setError(null)
    try {
      await setShopStatus(merchantId, shop.id, shop.status === 'active' ? 'suspended' : 'active')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update shop')
    } finally {
      setBusyId(null)
    }
  }

  if (!merchantId) return <p style={{ color: 'var(--status-bad)', fontSize: 13 }}>Not linked to a merchant.</p>
  if (error) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!shops) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Shops</h1>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Add shop'}
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        Each shop has its own provider accounts and balances.
      </p>

      {showForm && (
        <AddShopForm
          merchantId={merchantId}
          onCreated={() => {
            setShowForm(false)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      {shops.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No shops yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Name</Th>
              <Th>Location</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {shops.map((shop) => (
              <tr key={shop.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td>
                  <Link to={`/shops/${shop.id}`} style={{ color: 'var(--text)', fontWeight: 500 }}>
                    {shop.name}
                  </Link>
                </Td>
                <Td>{shop.location ?? '—'}</Td>
                <Td>
                  <StatusBadge status={shop.status} />
                </Td>
                <Td>
                  <button
                    onClick={() => handleToggle(shop)}
                    disabled={busyId === shop.id}
                    style={{ ...linkButtonStyle, color: shop.status === 'active' ? 'var(--status-bad)' : 'var(--accent)' }}
                  >
                    {shop.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function AddShopForm({ merchantId, onCreated }: { merchantId: string; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await createShop(merchantId, name, location)
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create shop')
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
        marginBottom: 24,
        background: 'var(--paper-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div>
        <label style={labelStyle}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
      </div>
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Creating…' : 'Create shop'}
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
const linkButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  padding: 0,
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>
      {children}
    </th>
  )
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '10px 12px', fontSize: 13 }}>{children}</td>
}
