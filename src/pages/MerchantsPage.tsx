import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createMerchant, listMerchants, type Merchant } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'

export function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function reload() {
    const data = await listMerchants()
    setMerchants(data)
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
  }, [])

  if (error) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!merchants) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  const pending = merchants.filter((m) => m.status === 'pending_kyc')
  const rest = merchants.filter((m) => m.status !== 'pending_kyc')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Merchants</h1>
        <button onClick={() => setShowForm((s) => !s)} style={secondaryButtonStyle}>
          {showForm ? 'Cancel' : 'Add merchant'}
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        {pending.length === 0
          ? 'No merchants waiting on KYC review.'
          : `${pending.length} merchant${pending.length === 1 ? '' : 's'} waiting on KYC review.`}
      </p>

      {showForm && (
        <AddMerchantForm
          onCreated={() => {
            setShowForm(false)
            reload().catch((err) => setError(err.message))
          }}
        />
      )}

      <MerchantTable merchants={[...pending, ...rest]} />
    </div>
  )
}

function AddMerchantForm({ onCreated }: { onCreated: () => void }) {
  const [legalName, setLegalName] = useState('')
  const [tradingName, setTradingName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await createMerchant(legalName, tradingName, regNumber)
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create merchant')
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
        <label style={labelStyle}>Legal name</label>
        <input value={legalName} onChange={(e) => setLegalName(e.target.value)} required style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Trading name</label>
        <input value={tradingName} onChange={(e) => setTradingName(e.target.value)} required style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Registration number</label>
        <input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} required style={inputStyle} />
      </div>
      <button type="submit" disabled={saving} style={primaryButtonStyle}>
        {saving ? 'Creating…' : 'Create merchant'}
      </button>
      {formError && <span style={{ color: 'var(--status-bad)', fontSize: 13 }}>{formError}</span>}
    </form>
  )
}

function MerchantTable({ merchants }: { merchants: Merchant[] }) {
  if (merchants.length === 0) {
    return <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No merchants yet.</div>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
          <Th>Trading name</Th>
          <Th>Legal name</Th>
          <Th>Registration</Th>
          <Th>Status</Th>
          <Th>Onboarded</Th>
        </tr>
      </thead>
      <tbody>
        {merchants.map((m) => (
          <tr key={m.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
            <Td>
              <Link to={`/merchants/${m.id}`} style={{ color: 'var(--text)', fontWeight: 500 }}>
                {m.trading_name}
              </Link>
            </Td>
            <Td>{m.legal_name}</Td>
            <Td className="num">{m.registration_number}</Td>
            <Td>
              <StatusBadge status={m.status} />
            </Td>
            <Td className="num">{new Date(m.created_at).toLocaleDateString()}</Td>
          </tr>
        ))}
      </tbody>
    </table>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--text-dim)',
      }}
    >
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
