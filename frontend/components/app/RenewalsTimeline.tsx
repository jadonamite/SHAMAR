'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Subscription } from './SubscriptionRow'
import { aggregateByCurrency, formatAggregate, formatMoney } from '@/lib/format'

interface Renewal {
  sub: Subscription
  date: Date
  // TODO: add error boundary here
  daysFromNow: number
}

function cadenceDays(c: Subscription['cadence']): number {
  if (c === 'daily')   return 1
  if (c === 'weekly')  return 7
  if (c === 'yearly')  return 365
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
    aggregateByCurrency(renewals, (r) => r.sub.amount, (r) => r.sub.currency ?? 'USD')
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-4 p-4 sm:p-5"
      style={{
        background: '#0f0f0f',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '3px',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span
            style={{
              fontFamily: 'var(--font-geist-sans)',
              color: '#525252',
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            Next {WINDOW} Days
          </span>
          <span
            style={{
              fontFamily: 'var(--font-dm-mono)',
              color: '#fff',
              fontSize: '20px',
              letterSpacing: '-0.02em',
            }}
          >
            {totalStr}{' '}
            <span style={{ color: '#525252', fontSize: '12px' }}>
              · {renewals.length}
            </span>
          </span>
        </div>
        {hovered && (
          <div className="flex flex-col items-end gap-0.5 text-right min-w-0">
            <span
              style={{
                fontFamily: 'var(--font-geist-sans)',
                color: '#fff',
                fontSize: '13px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '180px',
              }}
            >
              {hovered.sub.merchant}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-dm-mono)',
                color: '#E50914',
                fontSize: '12px',
              }}
            >
              {formatMoney(hovered.sub.amount, hovered.sub.currency)} · {hovered.daysFromNow}d
            </span>
          </div>
        )}
      </div>

      {/* timeline */}
      <div className="relative" style={{ height: '40px' }}>
        {/* baseline */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: '50%',
            height: '1px',
            background: 'rgba(255,255,255,0.06)',
          }}
        />

        {/* today marker */}
        <div
          className="absolute"
          style={{
            left: '0%',
            top: '20%',
            bottom: '20%',
            width: '1px',
            background: '#E50914',
            boxShadow: '0 0 6px rgba(229,9,20,0.6)',
          }}
        />

        {/* day ticks */}
        {Array.from({ length: WINDOW + 1 }).map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${(i / WINDOW) * 100}%`,
              top: '45%',
              width: '1px',
              height: '4px',
              background: i % 7 === 0 ? '#525252' : '#2a2a2a',
            }}
          />
        ))}

        {/* renewal dots */}
        {renewals.map((r) => (
          <motion.button
            key={r.sub.id}
            onMouseEnter={() => setHovered(r)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setHovered((cur) => (cur?.sub.id === r.sub.id ? null : r))}
            whileHover={{ scale: 1.6 }}
            transition={{ duration: 0.18 }}
            className="absolute"
            style={{
              left: `${(r.daysFromNow / WINDOW) * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: r.daysFromNow <= 3 ? '#E50914' : '#fff',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              boxShadow:
                r.daysFromNow <= 3
                  ? '0 0 12px rgba(229,9,20,0.5)'
                  : '0 0 0 transparent',
            }}
            aria-label={`${r.sub.merchant} in ${r.daysFromNow} days`}
          />
        ))}
      </div>

      {/* axis labels */}
      <div className="flex justify-between" style={{ marginTop: '-8px' }}>
        {[0, 7, WINDOW].map((d) => (
          <span
            key={d}
            style={{
              fontFamily: 'var(--font-dm-mono)',
              color: '#3a3a3a',
              fontSize: '10px',
            }}
          >
            {d === 0 ? 'today' : `+${d}d`}
          </span>
        ))}
      </div>
    </motion.div>
  )
}
