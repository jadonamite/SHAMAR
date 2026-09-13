'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import TopNav from '@/components/app/TopNav'
import { normalizeAction } from '@/lib/normalize'
import { formatMoney } from '@/lib/format'

type ActionRecord = {
  id: string
  type: string
  triggered_by: 'user' | 'policy'
  executed_at: string
  reversible: boolean
  reversed_at: string | null
  signature: string | null
  agent_address: string | null
  merchant: string
  amount: number
  currency: string
  cadence: string
  subscription_id: string
  status: string
}

const TYPE_COLORS: Record<string, string> = {
  cancel: '#E50914',
  pause: '#D97706',
  remind: '#3B82F6',
  resume: '#16A34A',
  analyze: '#A78BFA',
}

function formatAmount(amount: number, currency = 'USD') {
  return formatMoney(Number(amount), currency)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AuditPage() {
  const { ready, authenticated, user, login } = usePrivy()
  const router = useRouter()

  const [actions, setActions] = useState<ActionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reversing, setReversing] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'all' | 'reversible' | 'reversed'>('all')

  useEffect(() => {
    if (!ready) return
    if (!authenticated) { router.replace('/dashboard'); return }
    if (!user?.id) return
    load()
  }, [ready, authenticated, user?.id])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/actions', { headers: { 'x-user-id': user!.id } })
      if (res.ok) setActions(((await res.json()).actions ?? []).map(normalizeAction))
    } catch {} finally {
      setLoading(false)
    }
  }

  async function reverse(action: ActionRecord) {
    if (reversing[action.id]) return
    setReversing((prev) => ({ ...prev, [action.id]: true }))
    try {
      const res = await fetch(`/api/actions/${action.id}/reverse`, {
        method: 'PATCH',
        headers: { 'x-user-id': user!.id },
      })
      if (res.ok) {
        setActions((prev) =>
          prev.map((a) => a.id === action.id ? { ...a, reversed_at: new Date().toISOString() } : a)
        )
      }
    } catch {} finally {
      setReversing((prev) => ({ ...prev, [action.id]: false }))
    }
  }

  const filtered = actions.filter((a) => {
    if (filter === 'reversible') return a.reversible && !a.reversed_at
    if (filter === 'reversed') return !!a.reversed_at
    return true
  })

  const reversibleCount = actions.filter((a) => a.reversible && !a.reversed_at).length

  if (!ready) return null

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-void flex items-center justify-center">
        <motion.button onClick={login} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="px-8 py-3 text-sm font-semibold uppercase tracking-widest cursor-pointer"
          style={{ fontFamily: 'var(--font-geist-sans)', background: '#E50914', color: '#fff', borderRadius: '2px' }}>
          Connect Wallet
        </motion.button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-void">
      <TopNav
        title="Audit Log"
        rightMeta={
          reversibleCount > 0 ? (
            <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#D97706', fontSize: '11px' }}>
              {reversibleCount} reversible
            </span>
          ) : null
        }
      />

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Filters */}
        {actions.length > 0 && (
          <div className="flex gap-2">
            {(['all', 'reversible', 'reversed'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1 text-[11px] font-semibold uppercase tracking-widest cursor-pointer"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  background: filter === f ? '#E50914' : 'transparent',
                  color: filter === f ? '#fff' : '#525252',
                  border: `1px solid ${filter === f ? '#E50914' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '2px',
                  transition: 'all 0.15s',
                }}>
                {f}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '12px' }}>Loading...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '13px' }}>
              {actions.length === 0 ? 'No actions logged yet.' : 'No actions match this filter.'}
            </p>
            {actions.length === 0 && (
              <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#3a3a3a', fontSize: '12px' }}>
                Actions appear here when you approve recommendations.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {filtered.map((action, i) => {
                const color = TYPE_COLORS[action.type] ?? '#525252'
                const isReversed = !!action.reversed_at
                const canUndo = action.reversible && !isReversed

                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between px-4 py-3.5"
                    style={{
                      background: '#141414',
                      border: `1px solid ${isReversed ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '2px',
                      opacity: isReversed ? 0.5 : 1,
                    }}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Action type dot */}
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />

                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/subscriptions/${action.subscription_id}`}
                            style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3', fontSize: '13px', textDecoration: 'none' }}
                          >
                            {action.merchant}
                          </Link>
                          <span
                            className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                            style={{ fontFamily: 'var(--font-geist-sans)', color, border: `1px solid ${color}40`, borderRadius: '2px' }}
                          >
                            {action.type}
                          </span>
                          {isReversed && (
                            <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#3a3a3a', fontSize: '10px' }}>reversed</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}>
                            {formatAmount(action.amount, action.currency)}
                          </span>
                          <span style={{ color: '#3a3a3a', fontSize: '10px' }}>·</span>
                          <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#3a3a3a', fontSize: '10px' }}>
                            {action.triggered_by}
                          </span>
                          {action.signature && (
                            <>
                              <span style={{ color: '#3a3a3a', fontSize: '10px' }}>·</span>
                              <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#3a3a3a', fontSize: '10px' }}>
                                {action.signature.slice(0, 16)}…
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}>
                        {formatDate(action.executed_at)}
                      </span>
                      {canUndo && (
                        <motion.button
                          onClick={() => reverse(action)}
                          disabled={reversing[action.id]}
                          whileHover={{ scale: reversing[action.id] ? 1 : 1.02 }}
                          whileTap={{ scale: reversing[action.id] ? 1 : 0.98 }}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                          style={{
                            fontFamily: 'var(--font-geist-sans)',
                            background: 'transparent',
                            color: reversing[action.id] ? '#525252' : '#16A34A',
                            border: `1px solid ${reversing[action.id] ? 'rgba(255,255,255,0.06)' : 'rgba(22,163,74,0.4)'}`,
                            borderRadius: '2px',
                          }}
                        >
                          {reversing[action.id] ? '...' : 'Undo'}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  )
}
