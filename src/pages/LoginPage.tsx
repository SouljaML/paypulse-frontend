import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ink)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 320,
          background: 'var(--paper-raised)',
          borderRadius: 'var(--radius)',
          padding: 32,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>PayPulse</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Sign in</div>
        </div>

        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
          style={{
            width: '100%',
            padding: '8px 10px',
            marginBottom: 16,
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
            background: 'var(--paper)',
          }}
        />

        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '8px 10px',
            marginBottom: 20,
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
            background: 'var(--paper)',
          }}
        />

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

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '9px 0',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: 14,
            fontWeight: 500,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
