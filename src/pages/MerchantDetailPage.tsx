import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  activateMerchant,
  approveKycDocument,
  downloadKycDocumentFile,
  getMerchant,
  listKycDocuments,
  listSettlements,
  rejectKycDocument,
  setMerchantStatus,
  uploadKycDocument,
  type KycDocument,
  type Merchant,
  type Settlement,
} from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { MerchantLogins } from '../components/MerchantLogins'
import { MerchantProviderAccounts } from '../components/MerchantProviderAccounts'

export function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [docs, setDocs] = useState<KycDocument[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    if (!id) return
    const [m, d, s] = await Promise.all([getMerchant(id), listKycDocuments(id), listSettlements(id)])
    setMerchant(m)
    setDocs(d)
    setSettlements(s)
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function withBusy(fn: () => Promise<unknown>) {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleApprove(docId: string) {
    if (!id) return
    await withBusy(() => approveKycDocument(id, docId))
  }

  async function handleReject(docId: string) {
    if (!id) return
    const reason = window.prompt('Reason for rejecting this document:')
    if (!reason || !reason.trim()) return
    await withBusy(() => rejectKycDocument(id, docId, reason.trim()))
  }

  async function handleActivate() {
    if (!id) return
    await withBusy(() => activateMerchant(id))
  }

  async function handleSuspend() {
    if (!id) return
    await withBusy(() => setMerchantStatus(id, 'suspended'))
  }

  async function handleReactivate() {
    if (!id) return
    await withBusy(() => setMerchantStatus(id, 'active'))
  }

  async function handleDownload(doc: KycDocument) {
    if (!id) return
    setActionError(null)
    try {
      const suggestedName = doc.file_reference.split('/').pop()?.split('_').slice(1).join('_') || 'document'
      await downloadKycDocumentFile(id, doc.id, suggestedName)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not download file')
    }
  }

  if (error) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!merchant) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  const allVerified = docs.length > 0 && docs.every((d) => d.status === 'verified')
  const canActivate = merchant.status === 'pending_kyc' && allVerified

  return (
    <div>
      <Link to="/merchants" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        ← Merchants
      </Link>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '12px 0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{merchant.trading_name}</h1>
          <StatusBadge status={merchant.status} />
        </div>
        {merchant.status === 'active' && (
          <button onClick={handleSuspend} disabled={busy} style={dangerButtonStyle}>
            Suspend merchant
          </button>
        )}
        {merchant.status === 'suspended' && (
          <button onClick={handleReactivate} disabled={busy} style={secondaryButtonStyle}>
            Reactivate merchant
          </button>
        )}
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 28px' }}>
        {merchant.legal_name} · reg. <span className="num">{merchant.registration_number}</span>
      </p>

      {actionError && (
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
          {actionError}
        </div>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>KYC documents</h2>

      {docs.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No documents submitted yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Type</Th>
              <Th>File</Th>
              <Th>Status</Th>
              <Th>Submitted</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td>{doc.doc_type.replace(/_/g, ' ')}</Td>
                <Td>
                  <button onClick={() => handleDownload(doc)} style={linkButtonStyle}>
                    {doc.file_reference.split('/').pop()?.split('_').slice(1).join('_') || doc.file_reference}
                  </button>
                </Td>
                <Td>
                  <StatusBadge status={doc.status} />
                  {doc.status === 'rejected' && doc.rejection_reason && (
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>
                      {doc.rejection_reason}
                    </div>
                  )}
                </Td>
                <Td className="num">{new Date(doc.created_at).toLocaleDateString()}</Td>
                <Td>
                  {doc.status === 'submitted' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => handleApprove(doc.id)} disabled={busy} style={linkButtonStyle}>
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(doc.id)}
                        disabled={busy}
                        style={{ ...linkButtonStyle, color: 'var(--status-bad)' }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <UploadDocumentForm
        onUpload={(docType, file) => {
          if (!id) return Promise.resolve()
          return withBusy(() => uploadKycDocument(id, docType, file))
        }}
        busy={busy}
      />

      {merchant.status === 'pending_kyc' && (
        <div style={{ marginTop: 28 }}>
          <button onClick={handleActivate} disabled={busy || !canActivate} style={primaryButtonStyle(canActivate)}>
            Activate merchant
          </button>
          {!canActivate && (
            <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 8 }}>
              All submitted documents must be verified before this merchant can be activated.
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 36 }}>{id && <MerchantLogins merchantId={id} />}</div>

      <div style={{ marginTop: 36 }}>{id && <MerchantProviderAccounts merchantId={id} />}</div>

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '36px 0 12px' }}>Settlements</h2>
      {settlements.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          No settlement snapshots yet — these are written daily by the reconciliation job once it's running.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>Date</Th>
              <Th>Provider</Th>
              <Th>Opening</Th>
              <Th>Collections</Th>
              <Th>Withdrawals</Th>
              <Th>Closing (computed)</Th>
              <Th>Closing (provider)</Th>
              <Th>Discrepancy</Th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td className="num">{new Date(s.settlement_date).toLocaleDateString()}</Td>
                <Td>{s.provider_name}</Td>
                <Td className="num">{s.opening_balance}</Td>
                <Td className="num">{s.total_collections}</Td>
                <Td className="num">{s.total_withdrawals}</Td>
                <Td className="num">{s.computed_closing_balance}</Td>
                <Td className="num">{s.provider_reported_closing_balance ?? '—'}</Td>
                <Td
                  className="num"
                  style={{ color: parseFloat(s.discrepancy) !== 0 ? 'var(--status-bad)' : undefined }}
                >
                  {s.discrepancy}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function UploadDocumentForm({
  onUpload,
  busy,
}: {
  onUpload: (docType: string, file: File) => Promise<void>
  busy: boolean
}) {
  const [docType, setDocType] = useState('business_registration')
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const file = fileInputRef.current?.files?.[0]
        if (!file) return
        onUpload(docType, file).then(() => {
          if (fileInputRef.current) fileInputRef.current.value = ''
        })
      }}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
    >
      <div>
        <label style={labelStyle}>Document type</label>
        <select value={docType} onChange={(e) => setDocType(e.target.value)} style={inputStyle}>
          <option value="business_registration">Business registration</option>
          <option value="director_id">Director ID</option>
          <option value="proof_of_address">Proof of address</option>
          <option value="tax_clearance">Tax clearance</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>File</label>
        <input ref={fileInputRef} type="file" required style={{ fontSize: 13 }} />
      </div>
      <button type="submit" disabled={busy} style={secondaryButtonStyle}>
        Upload
      </button>
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
  background: 'var(--paper-raised)',
}

const linkButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent)',
  cursor: 'pointer',
  fontSize: 13,
  padding: 0,
  textAlign: 'left',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--paper-raised)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const dangerButtonStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--status-bad-bg)',
  color: 'var(--status-bad)',
  border: '1px solid var(--status-bad-bg)',
  borderRadius: 'var(--radius)',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function primaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '9px 16px',
    background: enabled ? 'var(--accent)' : 'var(--hairline)',
    color: enabled ? '#fff' : 'var(--text-dim)',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    fontWeight: 500,
    cursor: enabled ? 'pointer' : 'not-allowed',
  }
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
