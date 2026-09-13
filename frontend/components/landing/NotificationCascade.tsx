'use client'

import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'
import { brandIcons } from '@/components/ui/BrandIcons'

type Notification = {
  brand: string
  amount: number
  charged: string
  unused: boolean
}

const NOTIFICATIONS: Notification[] = [
  { brand: 'YouTube Premium', amount: 13.99, charged: 'just now', unused: false },
  { brand: 'Netflix', amount: 15.49, charged: '2 min ago', unused: false },
  { brand: 'Spotify', amount: 9.99, charged: '4 min ago', unused: true },
  { brand: 'Notion AI', amount: 20.0, charged: '6 min ago', unused: false },
  { brand: 'Figma Pro', amount: 15.0, charged: '8 min ago', unused: true },
]

const TOTAL_BLEED = NOTIFICATIONS.reduce((s, n) => s + n.amount, 0)
const CLEAN_BLEED = NOTIFICATIONS.filter((n) => !n.unused).reduce((s, n) => s + n.amount, 0)

// Phase machine — each entry: (ms until next phase)
// 0=empty, 1..5=show notif 0..4, 6=scan, 7=clean, 8=hold, 9=reset
const SCHEDULE = [
  400,   // 0 → 1  (delay before first notif)
  650,   // 1 → 2
  650,   // 2 → 3
  650,   // 3 → 4
  650,   // 4 → 5
  900,   // 5 → 6  pause before scan
  1500,  // 6 → 7  scanner sweep
  800,   // 7 → 8  clean transition
  4500,  // 8 → 9  HOLD (long, lets viewer absorb)
  700,   // 9 → 0  reset fade
]

export default function NotificationCascade() {
  const [phase, setPhase] = useState(0)
  const bleedValue = useMotionValue(0)
  const bleedDisplay = useTransform(bleedValue, (v) => `$${v.toFixed(2)}`)

  useEffect(() => {
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

    advance(phase)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drive bleed counter via motion value (smooth tween, no React re-render per frame)
  useEffect(() => {
    let target = 0
    if (phase === 0 || phase === 9) target = 0
    else if (phase <= 5) {
      // Sum of appeared notifications
      target = NOTIFICATIONS.slice(0, phase).reduce((s, n) => s + n.amount, 0)
    } else if (phase === 6) target = TOTAL_BLEED
    else if (phase === 7 || phase === 8) target = CLEAN_BLEED

    const controls = animate(bleedValue, target, {
      duration: phase === 7 ? 0.9 : phase === 0 ? 0.3 : 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    })
    return controls.stop
  }, [phase, bleedValue])

  const visibleCount = phase >= 1 && phase <= 5 ? phase : phase >= 6 ? 5 : 0
  const scanning = phase === 6
  const flagged = phase >= 6 && phase <= 8
  const cleaning = phase >= 7 && phase <= 8
  const resetting = phase === 9 || phase === 0

  return (
    <div className="w-full max-w-[400px] mx-auto lg:mx-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span
          className="uppercase text-muted"
          style={{
            fontFamily: 'var(--font-dm-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
          }}
        >
          Live from your inbox
        </span>
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#E50914' }}
        />
      </div>

      {/* Notification stack */}
      <div className="relative overflow-hidden" style={{ minHeight: '340px' }}>
        {/* Scanner sweep — pure CSS, GPU-accelerated, no React re-render */}
        {scanning && (
          <div
            key={`scan-${phase}`}
            className="absolute left-0 right-0 pointer-events-none z-10 cascade-scanner"
            style={{
              height: '46px',
              background:
                'linear-gradient(180deg, transparent, rgba(229,9,20,0.22), transparent)',
              borderTop: '1px solid rgba(229,9,20,0.5)',
              borderBottom: '1px solid rgba(229,9,20,0.5)',
              willChange: 'transform, opacity',
            }}
          />
        )}

        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {NOTIFICATIONS.map((notif, i) => {
              const visible = i < visibleCount && !resetting
              const isFlagged = flagged && notif.unused
              const isRemoved = cleaning && notif.unused
              if (!visible) return null

              const tilt = (i % 2 === 0 ? -1 : 1) * (0.4 + i * 0.15)
              // Stagger the flag highlight so the beam sweeps unobstructed first.
              // Beam is 1.5s; cards under the beam light up roughly when it reaches them.
              const flagDelay = scanning ? 0.9 + i * 0.08 : 0

              return (
                <motion.div
                  key={notif.brand}
                  initial={{ opacity: 0, x: 40, rotate: 0 }}
                  animate={{
                    opacity: isRemoved ? 0 : 1,
                    x: isRemoved ? 60 : 0,
                    rotate: tilt,
                    scale: isFlagged && !isRemoved ? 1.01 : 1,
                  }}
                  exit={{ opacity: 0, x: 60 }}
                  transition={{
                    duration: isRemoved ? 0.55 : 0.35,
                    ease: [0.25, 0.1, 0.25, 1],
                    scale: { duration: 0.3, delay: flagDelay, ease: 'easeOut' },
                  }}
                  className="relative rounded-sm flex items-center gap-3 px-4 py-3"
                  style={{
                    backgroundColor: '#161616',
                    border: isFlagged
                      ? '1px solid rgba(229,9,20,0.6)'
                      : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: isFlagged
                      ? '0 0 0 1px rgba(229,9,20,0.15), 0 8px 24px rgba(229,9,20,0.08)'
                      : '0 4px 14px rgba(0,0,0,0.4)',
                    willChange: 'transform, opacity',
                  }}
                >
                  <div className="w-9 h-9 rounded-sm overflow-hidden shrink-0">
                    {brandIcons[notif.brand] ?? (
                      <div
                        className="w-full h-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: '#1C1C1C', color: '#E50914' }}
                      >
                        {notif.brand[0]}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-white text-xs font-medium truncate"
                        style={{
                          fontFamily: 'var(--font-geist-sans)',
                          textDecoration: isRemoved ? 'line-through' : 'none',
                        }}
                      >
                        Your {notif.brand} subscription
                      </p>
                      {isFlagged && !isRemoved && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.25, delay: flagDelay, ease: 'easeOut' }}
                          className="uppercase shrink-0"
                          style={{
                            fontFamily: 'var(--font-dm-mono)',
                            fontSize: '8px',
                            letterSpacing: '0.12em',
                            color: '#E50914',
                            border: '1px solid rgba(229,9,20,0.6)',
                            padding: '1px 4px',
                            borderRadius: '2px',
                          }}
                        >
                          Unused
                        </motion.span>
                      )}
                    </div>
                    <p
                      className="text-muted"
                      style={{
                        fontFamily: 'var(--font-dm-mono)',
                        fontSize: '10px',
                      }}
                    >
                      Continues — charged {notif.charged}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="font-medium"
                      style={{
                        fontFamily: 'var(--font-dm-mono)',
                        fontSize: '13px',
                        color: isFlagged ? '#E50914' : '#FFFFFF',
                      }}
                    >
                      ${notif.amount.toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Bleed counter */}
      <div
        className="mt-5 rounded-sm px-4 py-3 flex items-end justify-between"
        style={{
          backgroundColor: '#0F0F0F',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div>
          <p
            className="uppercase text-muted mb-1"
            style={{
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '9px',
              letterSpacing: '0.18em',
            }}
          >
            Monthly bleed
          </p>
          <motion.p
            style={{
              fontFamily: 'var(--font-syne)',
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: cleaning ? '#E50914' : '#FFFFFF',
              transition: 'color 0.6s ease',
            }}
          >
            {bleedDisplay}
          </motion.p>
        </div>
        <AnimatePresence>
          {cleaning && (
            <motion.div
              key="cancelled-note"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-right"
            >
              <p
                style={{
                  fontFamily: 'var(--font-dm-mono)',
                  fontSize: '10px',
                  color: '#E50914',
                  letterSpacing: '0.05em',
                }}
              >
                SAM cancelled 2
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-dm-mono)',
                  fontSize: '10px',
                  color: '#8a8a8a',
                }}
              >
                −${(TOTAL_BLEED - CLEAN_BLEED).toFixed(2)}/mo
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        @keyframes cascadeScannerSweep {
          0% {
            transform: translate3d(0, -46px, 0);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 340px, 0);
            opacity: 0;
          }
        }
        .cascade-scanner {
          top: 0;
          animation: cascadeScannerSweep 1.5s linear forwards;
          transform: translate3d(0, -46px, 0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
      `}</style>
    </div>
  )
}
