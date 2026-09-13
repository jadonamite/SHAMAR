'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

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
  if (t.includes('pause'))  return `Paused ${a.merchant}`
  if (t.includes('remind')) return `Set reminder for ${a.merchant}`
  if (t.includes('analyze')) return `Analyzed ${a.merchant}`
  if (t.includes('detect')) return `Detected ${a.merchant}`
  return `${a.type} · ${a.merchant}`
}

export default function AgentActivity({ userId }: AgentActivityProps) {
  const [actions, setActions] = useState<AgentAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetch('/api/agent/history', { headers: { 'x-user-id': userId } })
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

  if (loading) return null
  if (actions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span
          style={{
            fontFamily: 'var(--font-geist-sans)',
            color: '#525252',
            fontSize: '10px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Agent Activity
        </span>
        <span
          style={{
            fontFamily: 'var(--font-dm-mono)',
            color: '#3a3a3a',
            fontSize: '10px',
          }}
        >
          {actions.length} action{actions.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-col">
        {actions.slice(0, 5).map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 py-2.5 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.04)' }}
          >
            {/* indicator */}
            <div
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: a.triggered_by === 'policy' ? '#E50914' : '#525252',
                flexShrink: 0,
              }}
            />

            {/* label */}
            <span
              style={{
                fontFamily: 'var(--font-geist-sans)',
                color: '#A3A3A3',
                fontSize: '12px',
                flex: 1,
              }}
            >
              <span style={{ color: '#fff' }}>SAM</span> {describeAction(a)}
              {a.triggered_by === 'policy' && (
                <span
                  style={{
                    fontFamily: 'var(--font-dm-mono)',
                    color: '#E50914',
                    fontSize: '9px',
                    marginLeft: '8px',
                    letterSpacing: '0.1em',
                  }}
                >
                  · POLICY
                </span>
              )}
            </span>

            {/* time */}
            <span
              style={{
                fontFamily: 'var(--font-dm-mono)',
                color: '#525252',
                fontSize: '11px',
                flexShrink: 0,
              }}
            >
              {formatRelative(a.executed_at)}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
