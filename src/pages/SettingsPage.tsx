import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import {
  changePassword,
  createStaffUser,
  listStaffUsers,
  setStaffUserStatus,
  type StaffUser,
} from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { ResetUserPassword } from '../components/ResetUserPassword'

export function SettingsPage() {
  const { decoded } = useAuth()
  const isAdmin = decoded?.role === 'platform_admin'
  const isOwner = decoded?.role === 'merchant_owner'

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 24px' }}>Settings</h1>

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Password</h2>
      <ChangePasswordForm />

      {isAdmin && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '32px 0 12px' }}>Reset a merchant user's password</h2>
          <ResetUserPassword description="For a merchant owner or teller who can't get in. Enter the email they sign in with." />
        </>
      )}

      {isOwner && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '32px 0 12px' }}>Reset a teller's password</h2>
          <ResetUserPassword description="For one of your tellers who can't get in. Enter the email they sign in with — it has to be a teller at your business." />
        </>
      )}

      {isAdmin && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '32px 0 12px' }}>Team</h2>
          <TeamSection />
        </>
      )}
    </div>
  )
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320 }}>
      <label style={labelStyle}>Current password</label>
      <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required style={inputStyle} />

      <label style={{ ...labelStyle, marginTop: 12 }}>New password</label>
      <input
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        required
        minLength={8}
        style={inputStyle}
      />

      {error && (
        <p style={{ color: 'var(--status-bad)', fontSize: 13, margin: '10px 0 0' }}>{error}</p>
      )}
      {success && (
        <p style={{ color: 'var(--status-good)', fontSize: 13, margin: '10px 0 0' }}>Password changed.</p>
      )}

      <button type="submit" disabled={saving} style={{ ...primaryButtonStyle, marginTop: 14 }}>
        {saving ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}

const STAFF_ROLES = ['platform_admin', 'compliance_officer']

function TeamSection() {
  const [staff, setStaff] = useState<StaffUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    const data = await listStaffUsers()
    setStaff(data)
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
  }, [])

  async function handleToggleActive(user: StaffUser) {
    setBusyId(user.id)
    setError(null)
    try {
      await setStaffUserStatus(user.id, !user.is_active)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update user')
    } finally {
      setBusyId(null)
    }
  }

  if (error) return <div style={{ color: 'var(--status-bad)', fontSize: 13 }}>{error}</div>
  if (!staff) return <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Add team member'}
        </button>
      </div>

      {showForm && (
        <AddStaffForm
          onCreated={() => {
            setShowForm(false)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {staff.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Td>{u.full_name}</Td>
              <Td className="num">{u.email}</Td>
              <Td>{u.role.replace(/_/g, ' ')}</Td>
              <Td>
                <StatusBadge status={u.is_active ? 'active' : 'disabled'} />
              </Td>
              <Td>
                <button
                  onClick={() => handleToggleActive(u)}
                  disabled={busyId === u.id}
                  style={{ ...linkButtonStyle, color: u.is_active ? 'var(--status-bad)' : 'var(--accent)' }}
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AddStaffForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('compliance_officer')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await createStaffUser(email, password, fullName, role)
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create user')
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
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, ' ')}
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
  background: 'var(--paper)',
  width: '100%',
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

const secondaryButtonStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--paper-raised)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  fontSize: 13,
  cursor: 'pointer',
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
