import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { changePassword } from '../lib/api'

/**
 * Shown, in place of the whole app, to anyone who signed in with a temporary
 * password from a reset. The server refuses everything else until this is
 * done, so there's nothing for this screen to fall back to.
 */
export function ForcedPasswordChangePage() {
  const { logout } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('Your new password needs at least 8 characters')
    if (next !== confirm) return setError("The two new passwords don't match")
    setBusy(true)
    try {
      await changePassword(current, next)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ink)' }}>
      <div style={{ width: 340, background: 'var(--paper-raised)', borderRadius: 'var(--radius)', padding: 32 }}>
        {done ? (
          <>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Password changed</div>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Sign in again with your new password.</p>
            <button onClick={logout} style={primaryButtonStyle}>
              Sign in again
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Choose a new password</div>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '4px 0 20px' }}>
              You signed in with a temporary password. Choose your own before you continue.
            </p>

            <label htmlFor="fp-current" style={labelStyle}>Temporary password</label>
            <input id="fp-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required style={inputStyle} />

            <label htmlFor="fp-new" style={{ ...labelStyle, marginTop: 14 }}>New password</label>
            <input id="fp-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required style={inputStyle} />

            <label htmlFor="fp-confirm" style={{ ...labelStyle, marginTop: 14 }}>Confirm new password</label>
            <input id="fp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={inputStyle} />

            {error && (
              <div style={{ fontSize: 13, color: 'var(--status-bad)', background: 'var(--status-bad-bg)', borderRadius: 'var(--radius)', padding: '8px 10px', marginTop: 14 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={busy} style={{ ...primaryButtonStyle, marginTop: 18 }}>
              {busy ? 'Saving…' : 'Change password'}
            </button>
            <button type="button" onClick={logout} style={{ ...linkStyle, marginTop: 12 }}>
              Sign out
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius)',
  background: 'var(--paper)',
}
const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 0',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}
const linkStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim)',
  fontSize: 13,
  cursor: 'pointer',
}
