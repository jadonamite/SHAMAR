'use client'

import { motion } from 'framer-motion'

interface OnboardingProgressProps {
  wallet: boolean
  gmail: boolean
  firstScan: boolean
  telegram: boolean
}

const STEPS = [
  { key: 'wallet', label: 'ACCOUNT', description: 'Session active' },
  { key: 'gmail', label: 'RECEIPTS', description: 'Gmail connected' },
  {
    key: 'firstScan',
    label: 'DISCOVERY',
    description: 'Subscriptions scanned',
  },
  { key: 'telegram', label: 'TELEGRAM', description: 'Renewal alerts linked' },
] as const

export default function OnboardingProgress(props: OnboardingProgressProps) {
  const completed = (k: (typeof STEPS)[number]['key']) => props[k]
  const allDone = STEPS.every((s) => completed(s.key))
  if (allDone) return null

  const activeIndex = STEPS.findIndex((s) => !completed(s.key))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-5 sm:p-6 rounded-[var(--radius-section)] bg-surface border border-separator/70 shadow-xs"
    >
      <div className="flex items-center justify-between mb-5">
        <span className="type-eyebrow text-label-2 font-semibold">
          Getting Started
        </span>
        <span className="type-caption font-mono font-bold text-accent tabular">
          {STEPS.filter((s) => completed(s.key)).length}/{STEPS.length}
        </span>
      </div>

      <div className="flex items-start justify-between gap-2 relative">
        {/* connector line */}
        <div className="absolute top-[8px] left-[10%] right-[10%] h-[2px] bg-separator/60 -z-0" />

        {STEPS.map((step, i) => {
          const done = completed(step.key)
          const active = !done && i === activeIndex

          return (
            <div
              key={step.key}
              className="flex flex-col items-center gap-2 relative flex-1 z-10"
            >
              <motion.div
                animate={
                  active
                    ? {
                        boxShadow: [
                          '0 0 0 0 rgba(229,9,20,0.3)',
                          '0 0 0 5px rgba(229,9,20,0)',
                        ],
                      }
                    : {}
                }
                transition={
                  active
                    ? { duration: 1.6, repeat: Infinity, ease: 'easeOut' }
                    : {}
                }
                className={`size-4 rounded-full flex items-center justify-center transition-colors ${
                  done
                    ? 'bg-accent text-white ring-2 ring-surface'
                    : active
                      ? 'bg-surface border-2 border-accent ring-2 ring-surface'
                      : 'bg-surface border-2 border-separator ring-2 ring-surface'
                }`}
              >
                {done && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    className="stroke-white"
                  >
                    <path
                      d="M1.5 4 L3 5.5 L6.5 2"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                )}
              </motion.div>

              <div className="flex flex-col items-center gap-0.5 text-center">
                <span
                  className={`type-caption font-bold uppercase tracking-wider text-[10px] ${
                    done
                      ? 'text-label'
                      : active
                        ? 'text-accent'
                        : 'text-label-3'
                  }`}
                >
                  {step.label}
                </span>
                <span className="hidden sm:inline type-caption text-[11px] text-label-2">
                  {step.description}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
