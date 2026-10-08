import { useEffect, useState, type FormEvent } from 'react'
import {
  createMerchantProviderAccount,
  listProviderAccounts,
  listProviders,
  setProviderAccountActive,
  type Provider,
  type ProviderAccount,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { StatusBadge } from './StatusBadge'

/**
 * Platform-admin view of which payment providers a merchant can use.
 * Switched on once here, they work in every shop and on every registered
 * device of the merchant; merchants can't add or remove them themselves.
 */
export function MerchantProviderAccounts({ merchantId }: { merchantId: string }) {
  const { decoded } = useAuth()
  const canManage = decoded?.role === 'platform_admin'
  const [accounts, setAccounts] = useState<ProviderAccount[] | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    const [a, p] = await Promise.all([listProviderAccounts(merchantId), listProviders()])
    setAccounts(a)
    setProviders(p)
  }

  useEffect(() => {
    if (!canManage) return
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, canManage])

  async function toggle(a: ProviderAccount) {
    const next = !a.is_active
    const verb = next ? 'Switch on' : 'Switch off'
    if (!window.confirm(`${verb} ${a.provider_name} (${a.account_identifier}) for this merchant? ${next ? '' : 'No device will be able to take payments with it.'}`)) return
    setBusyId(a.id)
    setError(null)
    try {
      await setProviderAccountActive(merchantId, a.id, next)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the provider')
    } finally {
      setBusyId(null)
    }
  }

  // Only PayPulse platform admins manage providers; other staff see nothing here.
  if (!canManage) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Providers</h2>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Add provider'}
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 12px' }}>
        Added once, then available in every shop and on every registered device of this merchant.
      </p>

      {error && <div style={{ color: 'var(--status-bad)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {showForm && (
        <AddForm
          merchantId={merchantId}
          providers={providers}
          onCreated={() => {
            setShowForm(false)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      {!accounts ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
      ) : accounts.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No providers set up yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Provider</Th>
              <Th>Account</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td style={{ fontWeight: 500 }}>{a.provider_name}</Td>
                <Td className="num">{a.account_identifier}</Td>
                <Td>
                  <StatusBadge status={a.is_active ? 'active' : 'disabled'} />
                </Td>
                <Td>
                  <button
                    onClick={() => toggle(a)}
                    disabled={busyId === a.id}
                    style={{ ...linkButtonStyle, color: a.is_active ? 'var(--status-bad)' : 'var(--accent)' }}
                  >
                    {a.is_active ? 'Switch off' : 'Switch on'}
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

function AddForm({
  merchantId,
  providers,
  onCreated,
}: {
  merchantId: string
  providers: Provider[]
  onCreated: () => void
}) {
  const [adapterKey, setAdapterKey] = useState(providers[0]?.adapter_key ?? '')
  const [identifier, setIdentifier] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!adapterKey) return
    setSaving(true)
    setFormError(null)
    try {
      await createMerchantProviderAccount(merchantId, adapterKey, identifier.trim())
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add provider')
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
        <select value={adapterKey} onChange={(e) => setAdapterKey(e.target.value)} style={inputStyle}>
          {providers.map((p) => (
            <option key={p.id} value={p.adapter_key}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Merchant's account / agent number</label>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required style={inputStyle} />
      </div>
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Adding…' : 'Add provider'}
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
const linkButtonStyle: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }

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
