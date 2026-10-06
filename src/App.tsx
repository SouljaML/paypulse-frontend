import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { MerchantsPage } from './pages/MerchantsPage'
import { MerchantDetailPage } from './pages/MerchantDetailPage'
import { ProvidersPage } from './pages/ProvidersPage'
import { ProviderDetailPage } from './pages/ProviderDetailPage'
import { BalancesPage } from './pages/BalancesPage'
import { SettingsPage } from './pages/SettingsPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { MerchantTransactionsPage } from './pages/MerchantTransactionsPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { ShopsPage } from './pages/ShopsPage'
import { ShopDetailPage } from './pages/ShopDetailPage'
import { TillsPage } from './pages/TillsPage'
import { TellersPage } from './pages/TellersPage'
import { ForcedPasswordChangePage } from './pages/ForcedPasswordChangePage'
import { ReportsPage } from './pages/ReportsPage'

const ADMIN_ROLES = ['platform_admin', 'compliance_officer']
const OWNER_ROLES = ['merchant_owner']

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { decoded } = useAuth()
  if (!decoded) return <Navigate to="/login" replace />
  if (decoded.must_change_password) return <ForcedPasswordChangePage />
  return <>{children}</>
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { decoded } = useAuth()
  if (!decoded) return <Navigate to="/login" replace />

  if (!roles.includes(decoded.role)) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 16, fontWeight: 600 }}>Not authorized</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          This section isn't available for your account's role (
          <span className="num">{decoded.role}</span>).
        </p>
      </div>
    )
  }

  return <>{children}</>
}

function HomeRedirect() {
  const { decoded } = useAuth()
  if (decoded && ADMIN_ROLES.includes(decoded.role)) return <Navigate to="/merchants" replace />
  if (decoded && OWNER_ROLES.includes(decoded.role)) return <Navigate to="/balances" replace />
  return <Navigate to="/transactions" replace />
}

/** Same URL, different view — an admin sees the global monitoring page, a
 * merchant user (owner or teller) sees their own scoped one. The backend
 * already enforces the actual data boundary either way; this just picks
 * the right screen. */
function TransactionsRouter() {
  const { decoded } = useAuth()
  if (decoded && ADMIN_ROLES.includes(decoded.role)) return <TransactionsPage />
  return <MerchantTransactionsPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomeRedirect />} />

        <Route
          path="/merchants"
          element={
            <RequireRole roles={ADMIN_ROLES}>
              <MerchantsPage />
            </RequireRole>
          }
        />
        <Route
          path="/merchants/:id"
          element={
            <RequireRole roles={ADMIN_ROLES}>
              <MerchantDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/providers"
          element={
            <RequireRole roles={ADMIN_ROLES}>
              <ProvidersPage />
            </RequireRole>
          }
        />
        <Route
          path="/providers/:id"
          element={
            <RequireRole roles={ADMIN_ROLES}>
              <ProviderDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireRole roles={['platform_admin']}>
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route
          path="/audit-log"
          element={
            <RequireRole roles={ADMIN_ROLES}>
              <AuditLogPage />
            </RequireRole>
          }
        />

        <Route path="/transactions" element={<TransactionsRouter />} />

        <Route
          path="/shops"
          element={
            <RequireRole roles={OWNER_ROLES}>
              <ShopsPage />
            </RequireRole>
          }
        />
        <Route
          path="/shops/:id"
          element={
            <RequireRole roles={OWNER_ROLES}>
              <ShopDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/tills"
          element={
            <RequireRole roles={OWNER_ROLES}>
              <TillsPage />
            </RequireRole>
          }
        />
        <Route
          path="/tellers"
          element={
            <RequireRole roles={OWNER_ROLES}>
              <TellersPage />
            </RequireRole>
          }
        />

        <Route path="/balances" element={<BalancesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
