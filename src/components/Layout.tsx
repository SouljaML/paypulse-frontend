import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const ADMIN_ROLES = ['platform_admin', 'compliance_officer']

type NavItem = { to: string; label: string; platformAdminOnly?: boolean }

const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Platform admin',
  compliance_officer: 'Compliance officer',
  merchant_owner: 'Merchant owner',
  teller: 'Teller',
}

const ADMIN_NAV: NavItem[] = [
  { to: '/merchants', label: 'Merchants' },
  { to: '/providers', label: 'Providers' },
  { to: '/transactions', label: 'Transactions' },
  // Commission is PayPulse's own margin, so compliance staff don't get this.
  { to: '/reports', label: 'Reports', platformAdminOnly: true },
  { to: '/audit-log', label: 'Audit log' },
  { to: '/settings', label: 'Settings' },
]

const OWNER_NAV: NavItem[] = [
  { to: '/shops', label: 'Shops' },
  { to: '/tellers', label: 'Tellers' },
  { to: '/tills', label: 'Tills' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/balances', label: 'Balances' },
  { to: '/settings', label: 'Settings' },
]

const TELLER_NAV: NavItem[] = [
  { to: '/transactions', label: 'Transactions' },
  { to: '/balances', label: 'Balances' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  const { decoded, logout } = useAuth()
  const isAdmin = !!decoded && ADMIN_ROLES.includes(decoded.role)
  const isOwner = !!decoded && decoded.role === 'merchant_owner'
  const isPlatformAdmin = decoded?.role === 'platform_admin'
  const navItems = (isAdmin ? ADMIN_NAV : isOwner ? OWNER_NAV : TELLER_NAV).filter(
    (item) => !item.platformAdminOnly || isPlatformAdmin,
  )
  // Sessions started before the token carried a name have no full_name;
  // show their role rather than nothing until they next sign in.
  const displayName = decoded?.full_name || decoded?.email
  const roleLabel = ROLE_LABELS[decoded?.role ?? ''] ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          padding: '0 16px',
          background: 'var(--ink)',
          borderBottom: '1px solid var(--ink-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, letterSpacing: 0.2 }}>PayPulse</span>
          <span style={{ color: 'var(--ink-text-dim)', fontSize: 13 }}>{isAdmin ? 'Operations' : 'Merchant'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            {displayName && (
              <span title={decoded?.email} style={{ color: 'var(--ink-text)', fontSize: 13 }}>
                {displayName}
              </span>
            )}
            <span style={{ color: 'var(--ink-text-dim)', fontSize: 12 }}>{roleLabel}</span>
          </div>
          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: '1px solid var(--ink-border)',
              color: 'var(--ink-text)',
              borderRadius: 'var(--radius)',
              padding: '5px 10px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <nav
          style={{
            width: 176,
            flexShrink: 0,
            background: 'var(--ink)',
            padding: '16px 8px',
          }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'block',
                padding: '8px 12px',
                marginBottom: 2,
                borderRadius: 'var(--radius)',
                fontSize: 13,
                textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--ink-text)',
                background: isActive ? 'var(--ink-2)' : 'transparent',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '28px 32px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
