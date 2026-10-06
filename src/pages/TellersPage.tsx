import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { assignTellerShop, createTeller, listShops, listTellers, setTellerStatus, type Shop, type Teller } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

export function TellersPage() {
  const { decoded } = useAuth()
  const merchantId = decoded?.merchant_id ?? null
  const [tellers, setTellers] = useState<Teller[] | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    if (!merchantId) return
    const [t, s] = await Promise.all([listTellers(merchantId), listShops(merchantId)])
    setTellers(t)
    setShops(s)
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  async function handleToggleActive(teller: Teller) {
    if (!merchantId) return
    setBusyId(teller.id)
    setError(null)
    try {
      await setTellerStatus(merchantId, teller.id, !teller.is_active)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update teller')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReassign(teller: Teller, shopId: string) {
    if (!merchantId) return
    setBusyId(teller.id)
    setError(null)
    try {
      await assignTellerShop(merchantId, teller.id, shopId || null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reassign shop')
    } finally {
      setBusyId(null)
    }
  }



  if (!merchantId) return <p style={{ color: 'var(--status-bad)', fontSize: 13 }}>Not linked to a merchant.</p>
  if (error) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!tellers) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Tellers</h1>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Add teller'}
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        A teller only ever sees their own transactions, scoped to the shop they're assigned to.
      </p>

      {showForm && (
        <AddTellerForm
          merchantId={merchantId}
          shops={shops}
          onCreated={() => {
            setShowForm(false)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      {tellers.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No tellers yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Shop</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {tellers.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td>{t.full_name}</Td>
                <Td className="num">{t.email}</Td>
                <Td>{t.role.replace(/_/g, ' ')}</Td>
                <Td>
                  <select
                    value={t.shop_id ?? ''}
                    disabled={busyId === t.id}
                    onChange={(e) => handleReassign(t, e.target.value)}
                    style={{ ...inputStyle, fontSize: 12, padding: '4px 6px' }}
                  >
                    <option value="">Unassigned</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td>
                  <StatusBadge status={t.is_active ? 'active' : 'disabled'} />
                </Td>
                <Td>
                  <button
                    onClick={() => handleToggleActive(t)}
                    disabled={busyId === t.id}
                    style={{ ...linkButtonStyle, color: t.is_active ? 'var(--status-bad)' : 'var(--accent)' }}
                  >
                    {t.is_active ? 'Deactivate' : 'Reactivate'}
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

function AddTellerForm({
  merchantId,
  shops,
  onCreated,
}: {
  merchantId: string
  shops: Shop[]
  onCreated: () => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('teller')
  const [shopId, setShopId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await createTeller(merchantId, email, password, fullName, role, shopId || null)
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create teller')
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
        <label style={labelStyle}>Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Temporary password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
          <option value="teller">Teller</option>
          <option value="merchant_owner">Co-owner</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>Shop</label>
        <select value={shopId} onChange={(e) => setShopId(e.target.value)} style={inputStyle}>
          <option value="">Unassigned</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Creating…' : 'Create login'}
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
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={className} style={{ padding: '10px 12px', fontSize: 13 }}>
      {children}
    </td>
  )
}
