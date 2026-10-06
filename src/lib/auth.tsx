import { createContext, useContext, useState, type ReactNode } from 'react'
import { login as apiLogin, decodeToken, type DecodedToken } from './api'

interface AuthState {
  token: string | null
  decoded: DecodedToken | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const STORAGE_KEY = 'paypulse_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
  const [decoded, setDecoded] = useState<DecodedToken | null>(() => {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (!existing) return null
    try {
      const d = decodeToken(existing)
      // Drop an expired token rather than silently trusting it — the API
      // will reject it anyway, so failing fast here gives a clearer login
      // screen instead of a confusing string of 401s.
      if (d.exp * 1000 < Date.now()) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
      return d
    } catch {
      return null
    }
  })

  async function login(username: string, password: string) {
    const newToken = await apiLogin(username, password)
    localStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
    setDecoded(decodeToken(newToken))
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setDecoded(null)
  }

  return <AuthContext.Provider value={{ token, decoded, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
