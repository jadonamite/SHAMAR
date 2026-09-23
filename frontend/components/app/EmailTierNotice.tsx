'use client'

interface EmailTierNoticeProps {
  merchant: string
  recipient?: string | null
  calendarEventCreated?: boolean
}

export default function EmailTierNotice({
  merchant,
  recipient,
  calendarEventCreated = true,
}: EmailTierNoticeProps) {
  return (
    <div
      role="status"
      className="p-4 rounded border my-3 space-y-2 text-xs"
      style={{
        backgroundColor: 'rgba(217, 119, 6, 0.08)',
        borderColor: 'rgba(217, 119, 6, 0.3)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: '#D97706' }}
        />
        <span
          className="font-semibold uppercase tracking-wider text-[11px]"
          style={{ fontFamily: 'var(--font-sans)', color: '#D97706' }}
        >
          Email cancellation dispatched — best effort
        </span>
      </div>

      <p className="text-secondary leading-relaxed">
        Cancellation request emailed to {recipient ?? `billing@${merchant.toLowerCase()}.com`}.
        Merchants may delay processing, ignore emails, or redirect to retention pages.
        {calendarEventCreated && (
          <span className="text-white block mt-1">
            A reminder event has been placed on your Google Calendar to verify written confirmation within 7 days.
          </span>
        )}
      </p>

      <div className="pt-2 border-t text-[11px] text-muted flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'rgba(217, 119, 6, 0.2)' }}>
        <span>Default Tier: Request sent</span>
        <span className="font-mono text-[10px] text-secondary">
          Card Tier (Upcoming): Instant closure at Visa network level
        </span>
      </div>
    </div>
  )
}
