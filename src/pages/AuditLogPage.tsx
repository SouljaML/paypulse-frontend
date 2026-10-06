import { useEffect, useState } from 'react'
import { listAuditLog, type AuditLogEntry } from '../lib/api'

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAuditLog()
      .then(setEntries)
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <div style={{ color: 'var(--status-bad)' }}>{error}</div>
  if (!entries) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Audit log</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 20px' }}>
        Every admin action — most recent first.
      </p>

      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Nothing logged yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <Td className="num">{new Date(e.created_at).toLocaleString()}</Td>
                <Td>{e.actor_email ?? '—'}</Td>
                <Td>{e.action}</Td>
                <Td className="num">
                  {e.target_type}:{e.target_id.slice(0, 8)}
                </Td>
                <Td className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {Object.entries(e.details)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('  ')}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
