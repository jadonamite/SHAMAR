'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import AgentStateBadge, { type AgentStateKind } from './AgentStateBadge'
import { apiFetch } from '@/lib/api'

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
  const [status, setStatus] = useState<{
    state: AgentStateKind
    reason: string
  } | null>(null)

  useEffect(() => {
    if (!userId) return

    apiFetch('/api/agent/status', { userId })
      .then((r) => r.json())
      .then((d) => {
        setStatus({
          state:
            d.state ?? (d.onchainAuthorized ? 'authorized' : 'unauthorized'),
          reason:
            d.reason ??
            (d.onchainAuthorized ? 'Authorized on Base' : 'Not granted'),
        })
      })
      .catch(() => {})
  }, [userId])

  const agentStateKind: AgentStateKind = scanning
    ? 'checking'
    : (status?.state ?? 'unauthorized')

  return (
    <div
      className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-separator/80 bg-surface text-label overflow-x-auto whitespace-nowrap transition-colors"
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        {/* Status dot */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.span
            animate={scanning ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={
              scanning
                ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                : {}
            }
            className={`size-1.5 rounded-full ${
              scanning
                ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]'
                : 'bg-success shadow-[0_0_8px_var(--color-success)]'
            }`}
          />
          <span
            className={`font-mono text-[10px] tracking-[0.18em] font-semibold ${
              scanning ? 'text-accent' : 'text-label-2'
            }`}
          >
            {scanning ? 'SCANNING' : 'ONLINE'}
          </span>
        </div>

        <span className="text-separator text-[10px]">·</span>

        <Field label="SUBS">{subCount}</Field>

        <span className="text-separator text-[10px] hidden sm:inline">·</span>

        <span className="hidden sm:inline-flex">
          <Field label="LAST SCAN">{formatRelative(lastScan)}</Field>
        </span>

        <span className="text-separator text-[10px] hidden sm:inline">·</span>

        <span className="hidden sm:inline-flex">
          <Field label="POLICY">
            <span className="text-[10px] text-success font-mono font-medium">
              Active
            </span>
          </Field>
        </span>
      </div>

      {/* R23 Agent State at a glance */}
      <div className="flex items-center gap-2 shrink-0 pl-3">
        <AgentStateBadge
          state={agentStateKind}
          reason={status?.reason}
          compact
        />
      </div>
    </div>
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
      <span className="type-eyebrow text-[9px] tracking-[0.14em] text-label-3">
        {label}
      </span>
      <span className="font-mono text-[11px] text-label-2 font-medium">
        {children}
      </span>
    </div>
  )
}
