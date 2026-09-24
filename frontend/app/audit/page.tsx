'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'
import { apiFetch } from '@/lib/api'
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

const TYPE_BADGES: Record<string, { label: string; badgeClass: string }> = {
  cancel: {
    label: 'Cancel',
    badgeClass: 'text-accent bg-accent-soft border-accent/30',
  },
  pause: {
    label: 'Pause',
    badgeClass: 'text-warning bg-warning/10 border-warning/30',
  },
  remind: {
    label: 'Remind',
    badgeClass: 'text-label bg-surface-2 border-separator',
  },
  resume: {
    label: 'Resume',
    badgeClass: 'text-success bg-success/10 border-success/30',
  },
  analyze: {
    label: 'Analyze',
    badgeClass: 'text-label-2 bg-surface-2 border-separator',
  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function AuditPage() {
  const { ready, authenticated, user } = usePrivy()
  const router = useRouter()

  const [actions, setActions] = useState<ActionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reversing, setReversing] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'all' | 'reversible' | 'reversed'>('all')
  const [copiedSig, setCopiedSig] = useState<string | null>(null)

  const devUser =
    typeof window !== 'undefined'
      ? localStorage.getItem('shamar_dev_user')
      : null
  const effectiveUserId = user?.id || devUser
  const isUserAuthenticated = authenticated || Boolean(devUser)

  useEffect(() => {
    if (!ready) return
    if (!isUserAuthenticated) {
      router.replace('/dashboard')
      return
    }
    if (!effectiveUserId) return
    load(effectiveUserId)
  }, [ready, isUserAuthenticated, effectiveUserId])

  async function load(uid: string) {
    setLoading(true)
    try {
      const res = await apiFetch('/api/actions', { userId: uid })
      if (res.ok) {
        setActions(((await res.json()).actions ?? []).map(normalizeAction))
      }
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  async function reverse(action: ActionRecord) {
    if (reversing[action.id]) return
    setReversing((prev) => ({ ...prev, [action.id]: true }))
    try {
      const res = await apiFetch(`/api/actions/${action.id}/reverse`, {
        method: 'PATCH',
        userId: effectiveUserId ?? undefined,
      })
      if (res.ok) {
        setActions((prev) =>
          prev.map((a) =>
            a.id === action.id
              ? { ...a, reversed_at: new Date().toISOString() }
              : a
          )
        )
      }
    } catch {
      // offline
    } finally {
      setReversing((prev) => ({ ...prev, [action.id]: false }))
    }
  }

  const filtered = actions.filter((a) => {
    if (filter === 'reversible') return a.reversible && !a.reversed_at
    if (filter === 'reversed') return !!a.reversed_at
    return true
  })

  const reversibleCount = actions.filter(
    (a) => a.reversible && !a.reversed_at
  ).length

  if (!ready || !authenticated) return null

  return (
    <main className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav
        title="Audit Log"
        rightMeta={
          reversibleCount > 0 ? (
            <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-warning/10 border border-warning/30 text-warning">
              {reversibleCount} reversible
            </span>
          ) : null
        }
      />

      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="type-title-1 font-[600] text-label tracking-tight">
              Action Audit Log
            </h1>
            <p className="type-callout text-label-2">
              Cryptographically signed EIP-191 attestations for every agent
              action.
            </p>
          </div>

          {actions.length > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 border border-separator/80">
              {(['all', 'reversible', 'reversed'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`min-h-[32px] px-3.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer capitalize ${
                    filter === f
                      ? 'bg-surface text-label shadow-2xs border border-separator'
                      : 'text-label-3 hover:text-label'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center text-label-3 type-footnote">
            Loading cryptographic attestations…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center rounded-[var(--radius-card)] bg-surface border border-separator p-8">
            <p className="type-callout text-label font-medium">
              {actions.length === 0
                ? 'No agent actions recorded yet.'
                : 'No actions match this filter.'}
            </p>
            {actions.length === 0 && (
              <p className="type-caption text-label-3">
                When SHAMAR executes a cancellation, pause, or renewal notice,
                it generates a signed attestation displayed here.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {filtered.map((action, i) => {
                const badge = TYPE_BADGES[action.type] ?? {
                  label: action.type,
                  badgeClass: 'text-label-2 bg-surface-2 border-separator',
                }
                const isReversed = !!action.reversed_at
                const canUndo = action.reversible && !isReversed

                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: isReversed ? 0.6 : 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={`p-4 sm:p-5 flex items-center justify-between gap-4 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-xs flex-wrap sm:flex-nowrap ${
                      isReversed ? 'bg-surface/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0 flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/subscriptions/${action.subscription_id}`}
                            className="type-headline font-semibold text-label hover:underline truncate"
                          >
                            {action.merchant}
                          </Link>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${badge.badgeClass}`}
                          >
                            {badge.label}
                          </span>
                          {isReversed && (
                            <span className="type-caption text-[11px] font-medium text-label-3 bg-surface-2 px-2 py-0.5 rounded-full border border-separator">
                              reversed
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-label-3 flex-wrap">
                          <span className="font-semibold text-label-2 tabular">
                            {formatMoney(action.amount, action.currency)}
                          </span>
                          <span>·</span>
                          <span className="capitalize">
                            {action.triggered_by}
                          </span>
                          {action.signature && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-[11px] text-label-3">
                                EIP-191: {action.signature.slice(0, 14)}…
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (action.signature) {
                                    await navigator.clipboard.writeText(
                                      action.signature
                                    )
                                    setCopiedSig(action.id)
                                    setTimeout(() => setCopiedSig(null), 2000)
                                  }
                                }}
                                className="type-caption text-[11px] text-accent hover:underline font-medium cursor-pointer"
                              >
                                {copiedSig === action.id ? 'Copied!' : 'Copy'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                      <span className="type-caption font-mono text-label-3">
                        {formatDate(action.executed_at)}
                      </span>

                      {canUndo && (
                        <button
                          type="button"
                          onClick={() => reverse(action)}
                          disabled={reversing[action.id]}
                          className="touch-target inline-flex min-h-[44px] items-center rounded-full border border-separator bg-surface px-4 type-footnote font-semibold text-accent hover:bg-accent-soft active:scale-[0.97] transition-all cursor-pointer"
                        >
                          {reversing[action.id] ? 'Undoing…' : 'Undo'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
