import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  adminAddDevice,
  adminAssignDevice,
  adminListDevices,
  adminReinstateDevice,
  adminReissueDeviceCode,
  adminRevokeDevice,
  adminSuspendDevice,
  adminUnassignDevice,
  listMerchants,
  type DeviceRecord,
  type DeviceWithCode,
  type Merchant,
} from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

type Filter = 'all' | 'unassigned' | 'active' | 'suspended' | 'revoked'

export function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null)
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  // The enrolment code is only returned once; held here until dismissed.
  const [issued, setIssued] = useState<DeviceWithCode | null>(null)

  async function reload() {
    const [d, m] = await Promise.all([adminListDevices(), listMerchants()])
    setDevices(d)
    setMerchants(m)
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
  }, [])

  async function run(d: DeviceRecord, fn: () => Promise<unknown>, fallback: string) {
    setBusyId(d.id)
    setError(null)
    try {
      await fn()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback)
    } finally {
      setBusyId(null)
    }
  }

  function askReason(question: string): string | null {
    const reason = window.prompt(question)
    return reason && reason.trim() ? reason.trim() : null
  }

  const handleAssign = (d: DeviceRecord, merchantId: string) =>
    merchantId && run(d, () => adminAssignDevice(d.id, merchantId), 'Could not assign device')
  const handleUnassign = (d: DeviceRecord) => {
    if (!window.confirm(`Take "${d.label}" back from ${d.merchant_name}? It will be unlinked from its till.`)) return
    run(d, () => adminUnassignDevice(d.id), 'Could not unassign device')
  }
  const handleSuspend = (d: DeviceRecord) => {
    const reason = askReason(`Reason for suspending "${d.label}" (e.g. lease unpaid):`)
    if (reason) run(d, () => adminSuspendDevice(d.id, reason), 'Could not suspend device')
  }
  const handleReinstate = (d: DeviceRecord) => run(d, () => adminReinstateDevice(d.id), 'Could not reinstate device')
  const handleRevoke = (d: DeviceRecord) => {
    const reason = askReason(`Reason for REVOKING "${d.label}" (permanent — the handset must be re-enrolled):`)
    if (reason) run(d, () => adminRevokeDevice(d.id, reason), 'Could not revoke device')
  }
  const handleReissue = (d: DeviceRecord) => {
    if (d.status === 'revoked') {
      if (!window.confirm(`Return "${d.label}" to inventory with a new code? You can then assign it to any merchant.`)) return
      run(d, async () => setIssued(await adminReissueDeviceCode(d.id)), 'Could not return device to inventory')
      return
    }
    if (!window.confirm(`Issue a new code for "${d.label}"? The handset currently enrolled will stop working.`)) return
    run(d, async () => setIssued(await adminReissueDeviceCode(d.id)), 'Could not issue a new code')
  }

  const shown = useMemo(() => {
    if (!devices) return []
    switch (filter) {
      case 'unassigned':
        return devices.filter((d) => !d.merchant_id && d.status !== 'revoked')
      case 'all':
        return devices
      default:
        return devices.filter((d) => d.status === filter)
    }
  }, [devices, filter])

  const activeMerchants = merchants.filter((m) => m.status === 'active')

  if (error && !devices) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!devices) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Devices</h1>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Add device'}
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 16px' }}>
        PayPulse owns every device. Add it, enrol the handset with the code, then assign it to a merchant — the merchant
        links it to a till. <strong>Suspend</strong> is reversible (e.g. unpaid lease); <strong>Revoke</strong> is
        permanent.
      </p>

      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
        {(['all', 'unassigned', 'active', 'suspended', 'revoked'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...linkButtonStyle, fontWeight: filter === f ? 700 : 400, textDecoration: filter === f ? 'underline' : 'none' }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div style={{ color: 'var(--status-bad)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {issued && <CodeCard issued={issued} onDismiss={() => setIssued(null)} />}

      {showForm && (
        <AddDeviceForm
          onCreated={(d) => {
            setShowForm(false)
            setIssued(d)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      {shown.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No devices here.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Device</Th>
              <Th>Merchant</Th>
              <Th>Shop / till</Th>
              <Th>Status</Th>
              <Th>Last seen</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td>
                  <div style={{ fontWeight: 500 }}>{d.label}</div>
                  <div className="num" style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    {d.reference}
                    {d.model ? ` · ${d.model}` : ''}
                  </div>
                </Td>
                <Td>
                  {d.merchant_name ??
                    (d.status === 'revoked' ? (
                      '—'
                    ) : (
                      <select
                        value=""
                        disabled={busyId === d.id}
                        onChange={(e) => handleAssign(d, e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Assign to…</option>
                        {activeMerchants.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.trading_name}
                          </option>
                        ))}
                      </select>
                    ))}
                </Td>
                <Td>
                  {d.shop_name ?? '—'}
                  {d.till_label && <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{d.till_label}</div>}
                  {d.merchant_id && !d.till_id && d.status !== 'revoked' && (
                    <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>Not linked to a till</div>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={d.status} />
                  {d.status === 'pending' && d.enrollment_expires_at && (
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>
                      Code expires {formatWhen(d.enrollment_expires_at)}
                    </div>
                  )}
                  {d.status === 'suspended' && d.suspended_reason && (
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>{d.suspended_reason}</div>
                  )}
                  {d.status === 'revoked' && d.revoked_reason && (
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>{d.revoked_reason}</div>
                  )}
                </Td>
                <Td>{d.last_seen_at ? formatWhen(d.last_seen_at) : '—'}</Td>
                <Td>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button onClick={() => handleReissue(d)} disabled={busyId === d.id} style={linkButtonStyle}>
                      {d.status === 'revoked' ? 'Return to inventory' : 'New code'}
                    </button>
                    {d.merchant_id && d.status !== 'revoked' && (
                      <button onClick={() => handleUnassign(d)} disabled={busyId === d.id} style={linkButtonStyle}>
                        Unassign
                      </button>
                    )}
                    {d.status === 'active' && (
                      <button
                        onClick={() => handleSuspend(d)}
                        disabled={busyId === d.id}
                        style={{ ...linkButtonStyle, color: 'var(--status-bad)' }}
                      >
                        Suspend
                      </button>
                    )}
                    {d.status === 'suspended' && (
                      <button onClick={() => handleReinstate(d)} disabled={busyId === d.id} style={linkButtonStyle}>
                        Reinstate
                      </button>
                    )}
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
        Enter this in the PayPulse POS app on the handset. It works once
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

function AddDeviceForm({ onCreated }: { onCreated: (d: DeviceWithCode) => void }) {
  const [label, setLabel] = useState('')
  const [serial, setSerial] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      onCreated(await adminAddDevice({ label: label.trim(), serial_number: serial.trim() || null }))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add device')
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
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. POS terminal 014" required style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Serial number (optional)</label>
        <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Printed on the device" style={inputStyle} />
      </div>
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Adding…' : 'Add device'}
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
