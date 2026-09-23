'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import AgentStateBadge, { type AgentStateKind } from './AgentStateBadge'

interface AgentStatusBarProps {
  scanning?: boolean
  lastScan?: Date | string | null
  subCount?: number
  userId?: string
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

export default function AgentStatusBar({
  scanning,
  lastScan,
  subCount = 0,
  userId,
}: AgentStatusBarProps) {
  const [controlState, setControlState] = useState<{
    halted: boolean
    reason: string
  } | null>(null)
  const [authState, setAuthState] = useState<{
    granted: boolean
    reason: string
  } | null>(null)

  useEffect(() => {
    // Check Telegram control state
    fetch('/api/execute/control')
      .then((r) => r.json())
      .then((d) => setControlState(d))
      .catch(() => {})

    // Check policy status if user is present
    if (userId) {
      fetch('/api/agent/status', { headers: { 'x-user-id': userId } })
        .then((r) => r.json())
        .then((d) => {
          setAuthState({
            granted: Boolean(d.onchainAuthorized || d.user?.policy_granted),
            reason: d.onchainAuthorized
              ? 'shamar.cancel authorized on Base'
              : d.user?.policy_granted
                ? 'Local grant active'
                : 'Not authorized',
          })
        })
        .catch(() => {})
    }
  }, [userId])

  const agentStateKind: AgentStateKind = controlState?.halted
    ? 'halted'
    : authState
      ? authState.granted
        ? 'authorized'
        : 'blocked'
      : scanning
        ? 'checking'
        : 'authorized'

  return (
    <div
      className="flex items-center justify-between px-4 sm:px-6 py-2 border-b overflow-x-auto whitespace-nowrap transition-colors"
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--bg-surface)',
        scrollbarWidth: 'none',
      }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Status dot */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.span
            animate={scanning ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={
              scanning
                ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                : {}
            }
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: scanning ? '#E50914' : '#16A34A',
              boxShadow: scanning ? '0 0 8px #E50914' : '0 0 8px #16A34A',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              color: scanning ? '#E50914' : 'var(--text-secondary)',
              fontSize: '10px',
              letterSpacing: '0.18em',
            }}
          >
            {scanning ? 'SCANNING' : 'ONLINE'}
          </span>
        </div>

        <Divider />

        <Field label="SUBS">{subCount}</Field>

        <Divider />

        <Field label="LAST SCAN">{formatRelative(lastScan)}</Field>

        <Divider />

        <Field label="POLICY">
          <span className="text-[10px] text-green-500 font-mono">
            SHAMARPolicy (Base)
          </span>
        </Field>
      </div>

      {/* R23 Agent State at a glance */}
      <div className="flex items-center gap-2 shrink-0 pl-3">
        <AgentStateBadge
          state={agentStateKind}
          reason={
            controlState?.halted
              ? 'Halted via Telegram /stop'
              : authState?.reason
          }
          compact
        />
      </div>
    </div>
  )
}

function Divider() {
  return (
    <span style={{ color: 'var(--border-strong)', fontSize: '10px' }}>·</span>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-muted)',
          fontSize: '9px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          fontSize: '11px',
        }}
      >
        {children}
      </span>
    </div>
  )
}
