import { useEffect, useState, type FormEvent } from 'react'
import { createTeller, listTellers, type Teller } from '../lib/api'
import { StatusBadge } from './StatusBadge'

/**
 * The people who can sign in for one merchant, plus a form to create its
 * owner login. Until a merchant has an owner, nobody can sign in for it, and
 * the owner is who then adds shops, provider accounts, tills and tellers.
 */
export function MerchantLogins({ merchantId }: { merchantId: string }) {
  const [users, setUsers] = useState<Teller[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function reload() {
    setUsers(await listTellers(merchantId))
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId])

  const hasOwner = !!users?.some((u) => u.role === 'merchant_owner')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Logins</h2>
        <button onClick={() => setShowForm((s) => !s)} style={buttonStyle}>
          {showForm ? 'Cancel' : 'Add owner login'}
        </button>
      </div>

      {showForm && (
        <AddOwnerForm
          merchantId={merchantId}
          onCreated={() => {
            setShowForm(false)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      {error && <p style={{ color: 'var(--status-bad)', fontSize: 13 }}>{error}</p>}

      {users && users.length === 0 && (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          No one can sign in for this merchant yet. Add an owner login — they'll then set up their own shops,
          provider accounts, tills and tellers.
        </p>
      )}
      {users && users.length > 0 && !hasOwner && (
        <p style={{ color: 'var(--status-pending)', fontSize: 13 }}>There's no owner login, only tellers.</p>
      )}

      {users && users.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td>{u.full_name}</Td>
                <Td className="num">{u.email}</Td>
                <Td>{u.role.replace(/_/g, ' ')}</Td>
                <Td>
                  <StatusBadge status={u.is_active ? 'active' : 'disabled'} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function AddOwnerForm({ merchantId, onCreated }: { merchantId: string; onCreated: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await createTeller(merchantId, email, password, fullName, 'merchant_owner', null)
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the login')
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
        marginBottom: 16,
        background: 'var(--paper-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div>
        <label htmlFor="owner-name" style={labelStyle}>Full name</label>
        <input id="owner-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={inputStyle} />
      </div>
      <div>
        <label htmlFor="owner-email" style={labelStyle}>Email</label>
        <input id="owner-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
      </div>
      <div>
        <label htmlFor="owner-password" style={labelStyle}>Temporary password</label>
        <input
          id="owner-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />
      </div>
      <button type="submit" disabled={saving} style={{ ...buttonStyle, background: 'var(--accent)', color: '#fff', border: 'none' }}>
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
const buttonStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--paper-raised)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  fontSize: 13,
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
