'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { apiFetch } from '@/lib/api'

interface AgentAction {
  id: string
  type: string
  triggered_by: 'user' | 'policy'
  executed_at: string
  merchant: string
  amount: number
  currency: string
}

interface AgentActivityProps {
  userId: string | undefined
}

function formatRelative(date: string): string {
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function describeAction(a: AgentAction): string {
  const t = a.type.toLowerCase()
  if (t.includes('cancel')) return `Cancelled ${a.merchant}`
  if (t.includes('pause')) return `Paused ${a.merchant}`
  if (t.includes('remind')) return `Set renewal reminder for ${a.merchant}`
  if (t.includes('analyze')) return `Analyzed ${a.merchant}`
  if (t.includes('detect')) return `Discovered ${a.merchant}`
  return `${a.type} · ${a.merchant}`
}

export default function AgentActivity({ userId }: AgentActivityProps) {
  const [actions, setActions] = useState<AgentAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    apiFetch('/api/agent/history')
      .then((r) => (r.ok ? r.json() : { actions: [] }))
      .then((d) => {
        if (!cancelled) setActions(d.actions ?? [])
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading || actions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-inverse p-6 text-on-inverse shadow-md border border-white/10"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-accent animate-pulse" />
          <h4 className="type-eyebrow font-semibold tracking-wider text-white">
            Agent Dispatch Ledger
          </h4>
        </div>
        <span className="type-caption font-mono text-white/50">
          {actions.length} action{actions.length !== 1 ? 's' : ''} recorded
        </span>
      </div>

      <div className="flex flex-col divide-y divide-white/10">
        {actions.slice(0, 5).map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center justify-between gap-3 py-3 text-white/90"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  a.triggered_by === 'policy' ? 'bg-accent' : 'bg-success'
                }`}
              />
              <span className="type-footnote truncate">
                <strong className="text-white font-semibold">SHAMAR</strong>{' '}
                {describeAction(a)}
              </span>
              {a.triggered_by === 'policy' && (
                <span className="type-caption rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-text uppercase tracking-wider">
                  SafePolicy
                </span>
              )}
            </div>

            <span className="type-caption font-mono text-white/50 shrink-0">
              {formatRelative(a.executed_at)}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
