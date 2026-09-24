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
      className="my-3 space-y-2.5 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 p-4 text-xs"
    >
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-warning shrink-0 animate-pulse" />
        <span className="type-eyebrow font-semibold text-warning">
          Email cancellation dispatched · best effort
        </span>
      </div>

      <p className="type-caption leading-relaxed text-label">
        Cancellation request emailed to{' '}
        <span className="font-semibold text-label">
          {recipient ??
            `billing@${merchant.toLowerCase().replace(/\s+/g, '')}.com`}
        </span>
        . Merchants may delay processing or redirect to retention forms.
        {calendarEventCreated && (
          <span className="mt-1 block font-medium text-label-2">
            A reminder event has been placed on your Google Calendar to verify
            written confirmation within 7 days.
          </span>
        )}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-warning/15 pt-2 text-[11px] text-label-3">
        <span>Default Tier: Request sent</span>
        <span className="font-mono text-[10px] text-label-3">
          Card tier: coming soon
        </span>
      </div>
    </div>
  )
}
