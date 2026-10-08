import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import {
  createTill,
  listAvailableDevices,
  listShops,
  listTills,
  setTillDevice,
  setTillStatus,
  type DeviceRecord,
  type Shop,
  type TillRecord,
} from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

export function TillsPage() {
  const { decoded } = useAuth()
  const merchantId = decoded?.merchant_id ?? null
  const [tills, setTills] = useState<TillRecord[] | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [available, setAvailable] = useState<DeviceRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    if (!merchantId) return
    const [t, s, a] = await Promise.all([listTills(merchantId), listShops(merchantId), listAvailableDevices(merchantId)])
    setTills(t)
    setShops(s)
    setAvailable(a)
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  async function handleBlock(till: TillRecord) {
    if (!merchantId) return
    const reason = window.prompt('Reason for blocking this till:')
    if (!reason || !reason.trim()) return
    setBusyId(till.id)
    setError(null)
    try {
      await setTillStatus(merchantId, till.id, 'blocked', reason.trim())
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block till')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnblock(till: TillRecord) {
    if (!merchantId) return
    setBusyId(till.id)
    setError(null)
    try {
      await setTillStatus(merchantId, till.id, 'active')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unblock till')
    } finally {
      setBusyId(null)
    }
  }

  async function handleChangeDevice(till: TillRecord, deviceId: string) {
    if (!merchantId || !deviceId) return
    setBusyId(till.id)
    setError(null)
    try {
      await setTillDevice(merchantId, till.id, deviceId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change device')
    } finally {
      setBusyId(null)
    }
  }

  const shopName = (shopId: string) => shops.find((s) => s.id === shopId)?.name ?? shopId.slice(0, 8)

  if (!merchantId) return <p style={{ color: 'var(--status-bad)', fontSize: 13 }}>Not linked to a merchant.</p>
  if (error && !tills) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!tills) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Tills</h1>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Add till'}
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        Each till runs on one PayPulse device. Blocking a till stops the very next transaction attempted from it —
        across every provider.
      </p>
      {error && <div style={{ color: 'var(--status-bad)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {showForm && (
        <AddTillForm
          merchantId={merchantId}
          shops={shops}
          devices={available}
          onCreated={() => {
            setShowForm(false)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      {tills.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No tills registered yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Label</Th>
              <Th>Device</Th>
              <Th>Shop</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {tills.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td style={{ fontWeight: 500 }}>{t.label}</Td>
                <Td>
                  <div className="num">{t.device_reference ?? '—'}</div>
                  {t.device_status && t.device_status !== 'active' && (
                    <div style={{ marginTop: 2 }}>
                      <StatusBadge status={t.device_status} />
                    </div>
                  )}
                  {available.length > 0 && (
                    <select
                      value=""
                      disabled={busyId === t.id}
                      onChange={(e) => handleChangeDevice(t, e.target.value)}
                      style={{ ...inputStyle, marginTop: 4, fontSize: 12 }}
                    >
                      <option value="">Change device…</option>
                      {available.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label} ({d.reference})
                        </option>
                      ))}
                    </select>
                  )}
                </Td>
                <Td>{shopName(t.shop_id)}</Td>
                <Td>
                  <StatusBadge status={t.status} />
                  {t.status === 'blocked' && t.blocked_reason && (
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>{t.blocked_reason}</div>
                  )}
                </Td>
                <Td>
                  {t.status === 'active' ? (
                    <button
                      onClick={() => handleBlock(t)}
                      disabled={busyId === t.id}
                      style={{ ...linkButtonStyle, color: 'var(--status-bad)' }}
                    >
                      Block
                    </button>
                  ) : (
                    <button onClick={() => handleUnblock(t)} disabled={busyId === t.id} style={linkButtonStyle}>
                      Unblock
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function AddTillForm({
  merchantId,
  shops,
  devices,
  onCreated,
}: {
  merchantId: string
  shops: Shop[]
  devices: DeviceRecord[]
  onCreated: () => void
}) {
  const [shopId, setShopId] = useState(shops[0]?.id ?? '')
  const [deviceId, setDeviceId] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!shopId) {
      setFormError('Create a shop first')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await createTill(merchantId, shopId, deviceId, label)
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not register till')
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
        <label style={labelStyle}>Shop</label>
        <select value={shopId} onChange={(e) => setShopId(e.target.value)} style={inputStyle}>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Device</label>
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} required style={inputStyle}>
          <option value="">{devices.length ? 'Select a device…' : 'No devices available'}</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} ({d.reference})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Back Counter"
          required
          style={inputStyle}
        />
      </div>
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Adding…' : 'Add till'}
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
function Td({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <td className={className} style={{ padding: '10px 12px', fontSize: 13, ...style }}>
      {children}
    </td>
  )
}
