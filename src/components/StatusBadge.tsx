type Tone = 'good' | 'pending' | 'warn' | 'bad'

const STATUS_TONE: Record<string, Tone> = {
  active: 'good',
  verified: 'good',
  confirmed: 'good',
  pending_kyc: 'pending',
  submitted: 'pending',
  pending: 'pending',
  degraded: 'warn',
  suspended: 'bad',
  rejected: 'bad',
  disabled: 'bad',
  declined: 'bad',
}

const LABEL_OVERRIDES: Record<string, string> = {
  pending_kyc: 'Pending KYC',
}

function label(status: string): string {
  if (LABEL_OVERRIDES[status]) return LABEL_OVERRIDES[status]
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'pending'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        color: `var(--status-${tone})`,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: `var(--status-${tone})`,
          flexShrink: 0,
        }}
      />
      {label(status)}
    </span>
  )
}
