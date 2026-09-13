'use client'

import { motion } from 'framer-motion'

interface OnboardingProgressProps {
  wallet: boolean
  gmail: boolean
  firstScan: boolean
  policies: boolean
}

const STEPS = [
  { key: 'wallet',    label: 'WALLET',     description: 'Identity connected' },
  { key: 'gmail',     label: 'GMAIL',      description: 'Inbox access granted' },
  { key: 'firstScan', label: 'FIRST SCAN', description: 'Subscriptions detected' },
  { key: 'policies',  label: 'POLICIES',   description: 'Automation rules set' },
] as const

export default function OnboardingProgress(props: OnboardingProgressProps) {
  const completed = (k: typeof STEPS[number]['key']) => props[k]
  const allDone = STEPS.every((s) => completed(s.key))
  if (allDone) return null

  // Find first incomplete step
  const activeIndex = STEPS.findIndex((s) => !completed(s.key))

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6"
      style={{
        background: '#0f0f0f',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '3px',
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <span
          style={{
            fontFamily: 'var(--font-geist-sans)',
            color: '#525252',
            fontSize: '10px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Setup Progress
        </span>
        <span
          style={{
            fontFamily: 'var(--font-dm-mono)',
            color: '#E50914',
            fontSize: '11px',
            letterSpacing: '0.04em',
          }}
        >
          {STEPS.filter((s) => completed(s.key)).length}/{STEPS.length}
        </span>
      </div>

      <div className="flex items-start justify-between gap-2 relative">
        {/* connector line */}
        <div
          className="absolute top-[7px] left-0 right-0 h-px"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />

        {STEPS.map((step, i) => {
          const done = completed(step.key)
          const active = !done && i === activeIndex
          const dotColor = done ? '#E50914' : active ? '#E50914' : '#2a2a2a'

          return (
            <div key={step.key} className="flex flex-col items-center gap-2 relative flex-1 z-10">
              <motion.div
                animate={
                  active
                    ? { boxShadow: ['0 0 0 0 rgba(229,9,20,0.4)', '0 0 0 6px rgba(229,9,20,0)'] }
                    : {}
                }
                transition={active ? { duration: 1.6, repeat: Infinity, ease: 'easeOut' } : {}}
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: done ? '#E50914' : '#0f0f0f',
                  border: `2px solid ${dotColor}`,
                  position: 'relative',
                }}
              >
                {done && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    style={{ position: 'absolute', top: '1px', left: '1px' }}
                  >
                    <path
                      d="M1.5 4 L3 5.5 L6.5 2"
                      stroke="#fff"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                )}
              </motion.div>

              <div className="flex flex-col items-center gap-0.5 text-center">
                <span
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    color: done ? '#fff' : active ? '#E50914' : '#525252',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                    fontWeight: 600,
                  }}
                >
                  {step.label}
                </span>
                <span
                  className="hidden sm:inline"
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    color: '#3a3a3a',
                    fontSize: '10px',
                  }}
                >
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
