'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Subscription } from './SubscriptionRow'
import { aggregateByCurrency, formatAggregate, formatMoney } from '@/lib/format'
import BrandLogo from '@/components/ui/BrandLogo'

interface Renewal {
  sub: Subscription
  date: Date
  daysFromNow: number
}

function cadenceDays(c: Subscription['cadence']): number {
  if (c === 'daily') return 1
  if (c === 'weekly') return 7
  if (c === 'yearly') return 365
  return 30
}

function computeRenewals(subs: Subscription[], windowDays = 14): Renewal[] {
  const now = new Date()
  const out: Renewal[] = []

  for (const sub of subs) {
    if (sub.status !== 'active') continue
    if (!sub.last_charged) continue

    const last = new Date(sub.last_charged)
    const next = new Date(last.getTime() + cadenceDays(sub.cadence) * 86400_000)
    const daysFromNow = Math.ceil((next.getTime() - now.getTime()) / 86400_000)

    if (daysFromNow >= 0 && daysFromNow <= windowDays) {
      out.push({ sub, date: next, daysFromNow })
    }
  }

  return out.sort((a, b) => a.daysFromNow - b.daysFromNow)
}

export default function RenewalsTimeline({ subs }: { subs: Subscription[] }) {
  const WINDOW = 14
  const renewals = useMemo(() => computeRenewals(subs, WINDOW), [subs])
  const [hovered, setHovered] = useState<Renewal | null>(null)

  if (renewals.length === 0) return null

  const totalStr = formatAggregate(
    aggregateByCurrency(
      renewals,
      (r) => r.sub.amount,
      (r) => r.sub.currency ?? 'USD'
    )
  )

  const activeRenewal = hovered || renewals[0]

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[var(--radius-section)] bg-surface p-6 sm:p-8 border border-separator/80 shadow-xs space-y-6"
      aria-label="Upcoming renewals in next 14 days"
    >
      {/* Header with Title and Selected/Hovered Card Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-separator/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent" />
            <span className="type-eyebrow text-label-3 uppercase tracking-wider font-semibold">
              Next {WINDOW} Days
            </span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="type-display text-2xl sm:text-3xl font-[600] text-label tabular">
              {totalStr}
            </span>
            <span className="type-caption text-label-2 font-medium">
              across {renewals.length} upcoming{' '}
              {renewals.length === 1 ? 'renewal' : 'renewals'}
            </span>
          </div>
        </div>

        {/* Hover / Selected Focus Badge */}
        {activeRenewal && (
          <div className="flex items-center gap-3 p-2.5 sm:px-4 sm:py-2.5 rounded-[var(--radius-tile)] bg-surface-2 border border-separator/70 self-start sm:self-auto">
            <BrandLogo
              merchant={activeRenewal.sub.merchant}
              domain={(activeRenewal.sub as any).domain}
              size={24}
              label={activeRenewal.sub.merchant}
            />
            <div className="flex flex-col">
              <span className="type-footnote font-semibold text-label">
                {activeRenewal.sub.merchant}
              </span>
              <span className="type-caption font-mono font-medium text-accent">
                {formatMoney(activeRenewal.sub.amount, activeRenewal.sub.currency)} ·{' '}
                {activeRenewal.daysFromNow === 0
                  ? 'Due today'
                  : activeRenewal.daysFromNow === 1
                    ? 'Due tomorrow'
                    : `In ${activeRenewal.daysFromNow} days`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Timeline Bar */}
      <div className="pt-4 pb-2 px-2">
        <div className="relative h-12 flex items-center">
          {/* Base track line */}
          <div className="absolute left-0 right-0 h-2 rounded-full bg-surface-2 border border-separator/70" />

          {/* Today Start Indicator */}
          <div className="absolute left-0 -top-1 -bottom-1 w-1 rounded-full bg-accent z-10" />

          {/* Day Grid Markers */}
          {Array.from({ length: WINDOW + 1 }).map((_, i) => (
            <div
              key={i}
              className={`absolute -translate-x-1/2 ${
                i % 7 === 0 ? 'h-4 w-[1.5px] bg-separator-strong' : 'h-2 w-[1px] bg-separator'
              }`}
              style={{ left: `${(i / WINDOW) * 100}%` }}
            />
          ))}

          {/* Interactive Renewal Nodes */}
          {renewals.map((r) => {
            const isHovered = hovered?.sub.id === r.sub.id
            const isImminent = r.daysFromNow <= 3
            const leftPercent = Math.min(Math.max((r.daysFromNow / WINDOW) * 100, 2), 98)

            return (
              <div
                key={r.sub.id}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${leftPercent}%`,
                  top: '50%',
                }}
              >
                <motion.button
                  type="button"
                  onMouseEnter={() => setHovered(r)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() =>
                    setHovered((cur) => (cur?.sub.id === r.sub.id ? null : r))
                  }
                  whileHover={{ scale: 1.35 }}
                  whileTap={{ scale: 0.95 }}
                  className={`touch-target size-5 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
                    isImminent
                      ? 'bg-accent border-surface ring-2 ring-accent/30 shadow-xs'
                      : 'bg-label border-surface ring-2 ring-separator shadow-2xs'
                  } ${isHovered ? 'scale-125 ring-4 ring-accent/40' : ''}`}
                  aria-label={`${r.sub.merchant} renewing in ${r.daysFromNow} days`}
                >
                  <span className="size-1.5 rounded-full bg-white" />
                </motion.button>
              </div>
            )
          })}
        </div>

        {/* Axis Labels */}
        <div className="flex justify-between items-center pt-2 type-caption font-mono text-label-3">
          <span>Today</span>
          <span>+7 days</span>
          <span>+{WINDOW} days</span>
        </div>
      </div>
    </motion.section>
  )
}
