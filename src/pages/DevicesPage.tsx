import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import {
  listDevices,
  listShops,
  listTills,
  registerDevice,
  reissueDeviceCode,
  revokeDevice,
  type DeviceRecord,
  type DeviceWithCode,
  type Shop,
  type TillRecord,
} from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

export function DevicesPage() {
  const { decoded } = useAuth()
  const merchantId = decoded?.merchant_id ?? null
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [tills, setTills] = useState<TillRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  // The enrolment code is only ever returned once, so it is held here for the
  // owner to read out / copy, and gone as soon as they dismiss it.
  const [issued, setIssued] = useState<DeviceWithCode | null>(null)

  async function reload() {
    if (!merchantId) return
    const [d, s, t] = await Promise.all([listDevices(merchantId), listShops(merchantId), listTills(merchantId)])
    setDevices(d)
    setShops(s)
    setTills(t)
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  async function handleReissue(d: DeviceRecord) {
    if (!merchantId) return
    const warning =
      d.status === 'active'
        ? `Issue a new code for "${d.label}"? The phone currently registered will stop working immediately.`
        : `Issue a new code for "${d.label}"?`
    if (!window.confirm(warning)) return
    setBusyId(d.id)
    setError(null)
    try {
      setIssued(await reissueDeviceCode(merchantId, d.id))
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue a new code')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRevoke(d: DeviceRecord) {
    if (!merchantId) return
    const reason = window.prompt(`Reason for revoking "${d.label}":`)
    if (!reason || !reason.trim()) return
    setBusyId(d.id)
    setError(null)
    try {
      await revokeDevice(merchantId, d.id, reason.trim())
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke device')
    } finally {
      setBusyId(null)
    }
  }

  if (!merchantId) return <p style={{ color: 'var(--status-bad)', fontSize: 13 }}>Not linked to a merchant.</p>
  if (error && !devices) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!devices) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Devices</h1>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Register device'}
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        Only registered devices can sign tellers in or take payments. Revoking a device cuts it off on its very next
        request.
      </p>

      {error && <div style={{ color: 'var(--status-bad)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {issued && <CodeCard issued={issued} onDismiss={() => setIssued(null)} />}

      {showForm && (
        <RegisterForm
          merchantId={merchantId}
          shops={shops}
          tills={tills}
          onCreated={(d) => {
            setShowForm(false)
            setIssued(d)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      {devices.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No devices registered yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Device</Th>
              <Th>Shop / till</Th>
              <Th>Status</Th>
              <Th>Handset</Th>
              <Th>Last seen</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td style={{ fontWeight: 500 }}>{d.label}</Td>
                <Td>
                  {d.shop_name ?? '—'}
                  {d.till_label && <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{d.till_label}</div>}
                </Td>
                <Td>
                  <StatusBadge status={d.status} />
                  {d.status === 'pending' && d.enrollment_expires_at && (
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>
                      Code expires {formatWhen(d.enrollment_expires_at)}
                    </div>
                  )}
                  {d.status === 'revoked' && d.revoked_reason && (
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>{d.revoked_reason}</div>
                  )}
                </Td>
                <Td>
                  {d.model ?? '—'}
                  {d.app_version && <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>App {d.app_version}</div>}
                </Td>
                <Td>{d.last_seen_at ? formatWhen(d.last_seen_at) : '—'}</Td>
                <Td>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <button onClick={() => handleReissue(d)} disabled={busyId === d.id} style={linkButtonStyle}>
                      New code
                    </button>
                    {d.status !== 'revoked' && (
                      <button
                        onClick={() => handleRevoke(d)}
                        disabled={busyId === d.id}
                        style={{ ...linkButtonStyle, color: 'var(--status-bad)' }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CodeCard({ issued, onDismiss }: { issued: DeviceWithCode; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.enrollment_code)
      setCopied(true)
    } catch {
      // clipboard blocked — the code is on screen to read out instead
    }
  }

  return (
    <div
      style={{
        padding: 16,
        marginBottom: 24,
        background: 'var(--paper-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        Enrolment code for <strong style={{ color: 'inherit' }}>{issued.label}</strong>
      </div>
      <div className="num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4, margin: '8px 0' }}>
        {issued.enrollment_code}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
        Enter this in the PayPulse POS app on the phone or terminal. It works once
        {issued.enrollment_expires_at ? ` and expires ${formatWhen(issued.enrollment_expires_at)}` : ''}. It can't be
        shown again — use “New code” if it's lost.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={copy} style={secondaryButtonStyle}>
          {copied ? 'Copied' : 'Copy code'}
        </button>
        <button onClick={onDismiss} style={secondaryButtonStyle}>
          Done
        </button>
      </div>
    </div>
  )
}

function RegisterForm({
  merchantId,
  shops,
  tills,
  onCreated,
}: {
  merchantId: string
  shops: Shop[]
  tills: TillRecord[]
  onCreated: (d: DeviceWithCode) => void
}) {
  const [shopId, setShopId] = useState(shops[0]?.id ?? '')
  const [tillId, setTillId] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const shopTills = tills.filter((t) => t.shop_id === shopId && t.status === 'active')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!shopId) {
      setFormError('Create a shop first')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      onCreated(await registerDevice(merchantId, { shop_id: shopId, till_id: tillId || null, label: label.trim() }))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not register device')
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
        <select
          value={shopId}
          onChange={(e) => {
            setShopId(e.target.value)
            setTillId('')
          }}
          style={inputStyle}
        >
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Till (optional)</label>
        <select value={tillId} onChange={(e) => setTillId(e.target.value)} style={inputStyle}>
          <option value="">No specific till</option>
          {shopTills.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Device name</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Counter phone"
          required
          style={inputStyle}
        />
      </div>
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Registering…' : 'Register device'}
      </button>
      {formError && <span style={{ color: 'var(--status-bad)', fontSize: 13 }}>{formError}</span>}
    </form>
  )
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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
