import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createProvider, listProviders, setProviderStatus, type Provider, type ProviderStatus } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

const STATUS_OPTIONS: ProviderStatus[] = ['active', 'degraded', 'disabled']

export function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function reload() {
    const data = await listProviders()
    setProviders(data)
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
  }, [])

  async function handleStatusChange(providerId: string, status: ProviderStatus) {
    setBusyId(providerId)
    setError(null)
    try {
      const updated = await setProviderStatus(providerId, status)
      setProviders((prev) => prev?.map((p) => (p.id === providerId ? updated : p)) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status')
    } finally {
      setBusyId(null)
    }
  }

  if (!providers) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Providers</h1>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Add provider'}
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        Setting a provider to disabled removes it from every merchant's POS dropdown immediately.
      </p>

      {showForm && (
        <AddProviderForm
          onCreated={() => {
            setShowForm(false)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      {error && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--status-bad)',
            background: 'var(--status-bad-bg)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
            <Th>Provider</Th>
            <Th>Adapter key</Th>
            <Th>Status</Th>
            <Th>Set status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Td style={{ fontWeight: 500 }}>{p.name}</Td>
              <Td className="num">{p.adapter_key}</Td>
              <Td>
                <StatusBadge status={p.status} />
              </Td>
              <Td>
                <select
                  value={p.status}
                  disabled={busyId === p.id}
                  onChange={(e) => handleStatusChange(p.id, e.target.value as ProviderStatus)}
                  style={{
                    padding: '5px 8px',
                    border: '1px solid var(--hairline)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--paper-raised)',
                    fontSize: 13,
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>
                <Link to={`/providers/${p.id}`} style={{ fontSize: 13, color: 'var(--accent)' }}>
                  Commission rate
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
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

function Td({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <td className={className} style={{ padding: '10px 12px', fontSize: 13, ...style }}>
      {children}
    </td>
  )
}

function AddProviderForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [adapterKey, setAdapterKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await createProvider(name, adapterKey)
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create provider')
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
        <label style={labelStyle}>
          Adapter key{' '}
          <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(must already exist in code)</span>
        </label>
        <input
          value={adapterKey}
          onChange={(e) => setAdapterKey(e.target.value)}
          placeholder="e.g. mpesa"
          required
          style={inputStyle}
        />
      </div>
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Creating…' : 'Create provider'}
      </button>
      {formError && <span style={{ color: 'var(--status-bad)', fontSize: 13, maxWidth: 360 }}>{formError}</span>}
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
