'use client'

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'
import BrandLogo, { type BrandName } from '@/components/ui/BrandLogo'

type Notification = {
  brand: BrandName
  name: string
  amount: number
  charged: string
  forgotten: boolean
}

const NOTIFICATIONS: Notification[] = [
  { brand: 'claude', name: 'Claude Pro', amount: 20.0, charged: 'Renews in 9 days', forgotten: false },
  { brand: 'netflix', name: 'Netflix', amount: 15.49, charged: 'Renews in 5 days', forgotten: false },
  { brand: 'figma', name: 'Figma Professional', amount: 15.0, charged: 'Renews in 36 hours', forgotten: true },
  { brand: 'spotify', name: 'Spotify Premium', amount: 11.99, charged: 'Renews in 12 days', forgotten: false },
  { brand: 'duolingo', name: 'Duolingo Super', amount: 12.99, charged: 'Renews in 36 hours', forgotten: true },
]

const TOTAL = NOTIFICATIONS.reduce((s, n) => s + n.amount, 0)
const KEPT = NOTIFICATIONS.filter((n) => !n.forgotten).reduce((s, n) => s + n.amount, 0)

// Phase machine, each entry is ms until the next phase.
// 0 empty, 1..5 show receipts, 6 scan, 7 cancel, 8 hold, 9 reset
const SCHEDULE = [400, 650, 650, 650, 650, 900, 1500, 800, 4500, 700]
// Five 72px rows and four 10px gaps, so the card never changes height mid-loop.
const ROWS_HEIGHT = 400

export default function NotificationCascade() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState(reduce ? 8 : 0)
  const total = useMotionValue(reduce ? KEPT : 0)
  const totalText = useTransform(total, (v) => `$${v.toFixed(2)}`)

  useEffect(() => {
    if (reduce) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const advance = (current: number) => {
      timer = setTimeout(() => {
        if (cancelled) return
        const next = (current + 1) % SCHEDULE.length
        setPhase(next)
        advance(next)
      }, SCHEDULE[current])
    }
    advance(0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reduce])

  useEffect(() => {
    let target = 0
    if (phase >= 1 && phase <= 5) target = NOTIFICATIONS.slice(0, phase).reduce((s, n) => s + n.amount, 0)
    else if (phase === 6) target = TOTAL
    else if (phase === 7 || phase === 8) target = KEPT
    const controls = animate(total, target, { duration: phase === 7 ? 0.9 : 0.5, ease: [0.25, 0.1, 0.25, 1] })
    return controls.stop
  }, [phase, total])

  const visibleCount = phase >= 1 && phase <= 5 ? phase : phase >= 6 && phase <= 8 ? 5 : 0
  const scanning = phase === 6
  const flagged = phase >= 6 && phase <= 8
  const cleaning = phase >= 7 && phase <= 8

  return (
    <div className="flex w-full flex-col gap-3" aria-hidden>
      <div className="flex items-center justify-between px-2 pt-1">
        <span className="type-caption text-on-inverse/60">Coming up this month</span>
        <motion.span
          animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY }}
          className="size-1.5 rounded-full bg-accent"
        />
      </div>

      <div className="relative" style={{ minHeight: ROWS_HEIGHT }}>
        {scanning && <div key={`scan-${phase}`} className="cascade-scanner pointer-events-none absolute inset-x-0 z-10" />}

        <div className="flex flex-col gap-2.5">
          <AnimatePresence>
            {NOTIFICATIONS.map((n, i) => {
              if (i >= visibleCount) return null
              const isFlagged = flagged && n.forgotten
              const isRemoved = cleaning && n.forgotten
              const flagDelay = scanning ? 0.9 + i * 0.08 : 0
              return (
                <motion.div
                  key={n.name}
                  initial={{ x: '115%' }}
                  animate={{
                    opacity: isRemoved ? 0.5 : 1,
                    x: 0,
                    scale: isFlagged && !isRemoved ? 1.01 : 1,
                  }}
                  exit={{ x: '-115%', transition: { duration: 0.45, ease: [0.7, 0, 0.84, 0] } }}
                  transition={{
                    duration: isRemoved ? 0.55 : 0.6,
                    ease: [0.16, 1, 0.3, 1],
                    scale: { duration: 0.3, delay: flagDelay, ease: 'easeOut' },
                  }}
                  className={`flex items-center gap-3 rounded-[var(--radius-tile)] bg-surface px-3.5 py-3.5 text-label shadow-[var(--shadow-float)] ${
                    isFlagged ? 'ring-2 ring-accent' : ''
                  }`}
                >
                  <BrandLogo name={n.brand} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`type-footnote truncate font-semibold ${isRemoved ? 'line-through' : ''}`}>{n.name}</p>
                      {isFlagged && !isRemoved && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.25, delay: flagDelay }}
                          className="type-caption shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-accent-text"
                        >
                          No reply from you
                        </motion.span>
                      )}
                      {isRemoved && (
                        <span className="type-caption shrink-0 rounded-full bg-accent px-2 py-0.5 text-on-accent">Cancelled</span>
                      )}
                    </div>
                    <p className="type-caption text-label-3">{n.charged}</p>
                  </div>
                  <p className={`type-footnote tabular font-semibold ${isFlagged ? 'text-accent-text' : ''}`}>
                    ${n.amount.toFixed(2)}
                  </p>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-end justify-between rounded-[var(--radius-tile)] bg-inverse-raised px-4 py-3">
        <div>
          <p className="type-caption text-on-inverse/60">You pay each month</p>
          <motion.p className="type-title-2 tabular text-on-inverse">{totalText}</motion.p>
        </div>
        <AnimatePresence>
          {cleaning && (
            <motion.div
              key="saved"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-right"
            >
              <p className="type-footnote font-semibold text-success-on-inverse">
                Saved ${(TOTAL - KEPT).toFixed(2)} a month
              </p>
              <p className="type-caption text-on-inverse/60">2 you ignored, both cancelled</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        @keyframes cascadeScannerSweep {
          0% { transform: translate3d(0, -46px, 0); opacity: 0; }
          8% { opacity: 1; }
          92% { opacity: 1; }
          100% { transform: translate3d(0, 400px, 0); opacity: 0; }
        }
        .cascade-scanner {
          top: 0;
          height: 46px;
          background: linear-gradient(180deg, transparent, rgba(217, 0, 18, 0.22), transparent);
          border-top: 1px solid rgba(217, 0, 18, 0.5);
          border-bottom: 1px solid rgba(217, 0, 18, 0.5);
          animation: cascadeScannerSweep 1.5s linear forwards;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  )
}
