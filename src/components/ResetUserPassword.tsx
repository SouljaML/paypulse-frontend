import { useState, type FormEvent } from 'react'
import { resetUserPassword, type ResetPasswordResult } from '../lib/api'

/**
 * "Reset someone else's password, by their email." Used twice with different
 * wording: an admin resets a merchant's users, a merchant owner resets a
 * teller. What each person is actually allowed to reset is decided by the
 * server, not by this component — it only ever sends the email.
 */
export function ResetUserPassword({ description }: { description: string }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResetPasswordResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const target = email.trim()
    if (!target) return
    if (!window.confirm(`Reset the password for ${target}? Their current password will stop working straight away.`)) return

    setBusy(true)
    setError(null)
    setResult(null)
    setCopied(false)
    try {
      setResult(await resetUserPassword(target))
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.temporary_password)
      setCopied(true)
    } catch {
      // Clipboard is unavailable on plain-http pages; the password is on
      // screen to read out or copy by hand, which is all this is a shortcut for.
    }
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 12px' }}>{description}</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="reset-email" style={labelStyle}>
            User's email
          </label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </div>
        <button type="submit" disabled={busy} style={buttonStyle}>
          {busy ? 'Resetting…' : 'Reset password'}
        </button>
      </form>

      {error && <p style={{ color: 'var(--status-bad)', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: 'var(--status-pending-bg)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
          }}
        >
          <div style={{ fontSize: 13 }}>
            Temporary password for <strong>{result.full_name}</strong> ({result.email}):
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
            <span className="num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: 1 }}>
              {result.temporary_password}
            </span>
            <button type="button" onClick={handleCopy} style={{ ...buttonStyle, padding: '5px 10px' }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            Shown once — it isn't stored anywhere you can look it up again. They'll be asked to choose their own
            password the first time they sign in with it.
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  background: 'var(--paper-raised)',
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
