'use client'

import { motion } from 'framer-motion'

interface AgentStatusBarProps {
  scanning?: boolean
  lastScan?: Date | string | null
  subCount?: number
}

function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return 'never'
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function AgentStatusBar({ scanning, lastScan, subCount = 0 }: AgentStatusBarProps) {
  const status = scanning ? 'SCANNING' : 'ACTIVE'
  const dotColor = scanning ? '#E50914' : '#16A34A'

  return (
    <div
      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2.5 border-b overflow-x-auto whitespace-nowrap"
      style={{
        borderColor: 'rgba(255,255,255,0.04)',
        background: 'rgba(20,20,20,0.4)',
        scrollbarWidth: 'none',
      }}
    >
      {/* Status dot */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <motion.span
          animate={scanning ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
          transition={scanning ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 8px ${dotColor}`,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-dm-mono)',
            color: scanning ? '#E50914' : '#A3A3A3',
            fontSize: '10px',
            letterSpacing: '0.18em',
          }}
        >
          {status}
        </span>
      </div>

      <Divider />

      <Field label="SUBS">{subCount}</Field>

      <Divider />

      <Field label="LAST SCAN">{formatRelative(lastScan)}</Field>

      <Divider />

      <Field label="AGENT">SAM v0.1</Field>
    </div>
  )
}

function Divider() {
  return <span style={{ color: '#2a2a2a', fontSize: '10px' }}>·</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span
        style={{
          fontFamily: 'var(--font-geist-sans)',
          color: '#3a3a3a',
          fontSize: '9px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#A3A3A3', fontSize: '11px' }}>
        {children}
      </span>
    </div>
  )
}
