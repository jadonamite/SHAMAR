'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import Link from 'next/link'
import BrandLogo from '@/components/ui/BrandLogo'
import ConfidenceScore from '@/components/app/ConfidenceScore'
import EmailTierNotice from '@/components/app/EmailTierNotice'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'
import { apiFetch } from '@/lib/api'
import { normalizeSubscription } from '@/lib/normalize'
import { formatMoney } from '@/lib/format'
import type { Subscription } from '@/components/app/SubscriptionRow'

type Signal = {
  id: string
  type: string
  value: string
  weight: number
}

type Recommendation = {
  id: string
  action: 'cancel' | 'pause' | 'remind' | 'keep'
  confidence: number
  evidence: string[]
  status: string
}

type DetailData = {
  subscription: Subscription & { currency: string; detected_at: string }
  signals: Signal[]
  insight: string | null
  recommendation: Recommendation | null
}

const ACTION_STYLES = {
  cancel: 'text-accent border-accent/30 bg-accent-soft',
  pause: 'text-warning border-warning/30 bg-warning/10',
  remind: 'text-label border-separator bg-surface-2',
  keep: 'text-success border-success/30 bg-success/10',
}

const CADENCE_LABELS: Record<string, string> = {
  daily: '/day',
  weekly: '/wk',
  monthly: '/mo',
  yearly: '/yr',
}

const STATUS_BADGES: Record<string, { label: string; badgeClass: string }> = {
  active: {
    label: 'Active',
    badgeClass: 'text-success bg-success/10 border-success/30',
  },
  paused: {
    label: 'Paused',
    badgeClass: 'text-warning bg-warning/10 border-warning/30',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'text-label-3 bg-surface-2 border-separator',
  },
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { ready, authenticated, user } = usePrivy()

  const devUser =
    typeof window !== 'undefined'
      ? localStorage.getItem('shamar_dev_user')
      : null
  const effectiveUserId = user?.id || devUser
  const isUserAuthenticated = authenticated || Boolean(devUser)

  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)
  const [reminderSending, setReminderSending] = useState(false)
  const [reminderError, setReminderError] = useState<string | null>(null)
  const [dispatchedCancel, setDispatchedCancel] = useState(false)
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!isUserAuthenticated) {
      router.replace('/dashboard')
      return
    }
    if (!effectiveUserId || !id) return
    load()
  }, [ready, isUserAuthenticated, effectiveUserId, id])

  async function load() {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/subscriptions/${id}`, {
        userId: effectiveUserId!,
      })
      if (!res.ok) {
        router.replace('/subscriptions')
        return
      }
      const json = await res.json()
      setData({
        subscription: normalizeSubscription(json.subscription),
        signals: json.signals ?? [],
        insight: json.insight ?? null,
        recommendation: json.subscription.recommendations?.[0] ?? null,
      })
    } catch {
      // server offline
    } finally {
      setLoading(false)
    }
  }

  async function runAnalysis() {
    if (!effectiveUserId || analyzing) return
    setAnalyzing(true)
    try {
      const res = await apiFetch(`/api/intelligence/analyze/${id}`, {
        method: 'POST',
        userId: effectiveUserId,
      })
      if (res.ok) {
        const json = await res.json()
        setData((prev) =>
          prev
            ? {
                ...prev,
                signals:
                  json.signals?.map(
                    (s: { type: string; label: string; value: number }) => ({
                      id: s.type,
                      type: s.type,
                      value: s.label,
                      weight: s.value,
                    })
                  ) ?? prev.signals,
                insight: json.insight ?? prev.insight,
                recommendation: json.recommendation ?? prev.recommendation,
                subscription: {
                  ...prev.subscription,
                  confidence: json.confidence,
                  action: json.action,
                },
              }
            : prev
        )
      }
    } catch {
      // offline
    } finally {
      setAnalyzing(false)
    }
  }

  async function scheduleReminder(daysFromNow: number) {
    if (!effectiveUserId || reminderSending) return
    setReminderSending(true)
    setReminderError(null)
    const remindAt = new Date(
      Date.now() + daysFromNow * 86_400_000
    ).toISOString()
    const email = user?.email?.address ?? user?.google?.email ?? null
    try {
      const res = await apiFetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        userId: effectiveUserId,
        body: JSON.stringify({
          subscription_id: id,
          remind_at: remindAt,
          type: 'review',
          user_email: email,
        }),
      })
      if (res.ok) {
        setReminderSent(true)
        setTimeout(() => setReminderSent(false), 4000)
      } else {
        const body = await res.json()
        setReminderError(body.error ?? 'Failed to set reminder')
      }
    } catch {
      setReminderError('Server offline')
    } finally {
      setReminderSending(false)
    }
  }

  async function cancelSubscription() {
    if (!effectiveUserId || statusChanging || !data) return
    setStatusChanging(true)
    setCancelFeedback(null)

    try {
      // Run through unified execute pipeline
      const execRes = await apiFetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        userId: effectiveUserId,
        body: JSON.stringify({
          subscription_id: id,
          action: 'cancel',
          triggered_by: 'user',
        }),
      })

      if (execRes.ok) {
        const execJson = await execRes.json()
        setDispatchedCancel(true)
        setCancelFeedback(
          execJson.message ?? 'Cancellation dispatched via email rail.'
        )
        setData((prev) =>
          prev
            ? {
                ...prev,
                subscription: { ...prev.subscription, status: 'cancelled' },
              }
            : prev
        )
      } else {
        // Fall back to direct patch if execute is offline or dry-run
        const patchRes = await apiFetch(`/api/subscriptions/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          userId: effectiveUserId,
          body: JSON.stringify({ status: 'cancelled' }),
        })
        if (patchRes.ok) {
          setDispatchedCancel(true)
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  subscription: { ...prev.subscription, status: 'cancelled' },
                }
              : prev
          )
        }
      }
    } catch {
      setCancelFeedback('Action could not be dispatched right now.')
    } finally {
      setStatusChanging(false)
    }
  }

  async function changeStatus(status: 'active' | 'paused') {
    if (!effectiveUserId || statusChanging || !data) return
    setStatusChanging(true)
    try {
      const res = await apiFetch(`/api/subscriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        userId: effectiveUserId,
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setData((prev) =>
          prev
            ? { ...prev, subscription: { ...prev.subscription, status } }
            : prev
        )
      }
    } catch {
      // offline
    } finally {
      setStatusChanging(false)
    }
  }

  if (!ready || loading) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="size-2 rounded-full bg-accent animate-pulse" />
      </main>
    )
  }

  if (!isUserAuthenticated) {
    return (
      <main className="min-h-screen bg-canvas text-label flex flex-col justify-between">
        <TopNav title="Subscription" />
        <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-20 text-center flex flex-col items-center justify-center">
          <p className="type-callout text-label-2 mb-4">
            Please connect your wallet to view subscription details.
          </p>
          <Link
            href="/dashboard"
            className="touch-target inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 type-headline text-accent-contrast"
          >
            Go to Dashboard
          </Link>
        </div>
        <AppFooter />
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-canvas text-label flex flex-col justify-between">
        <TopNav title="Subscription" />
        <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-20 text-center flex flex-col items-center justify-center">
          <p className="type-callout text-label-2 mb-4">
            Subscription not found or inaccessible.
          </p>
          <Link
            href="/subscriptions"
            className="touch-target inline-flex min-h-[44px] items-center rounded-full border border-separator bg-surface px-6 type-headline text-label shadow-2xs"
          >
            Back to Subscriptions
          </Link>
        </div>
        <AppFooter />
      </main>
    )
  }

  const { subscription: sub, signals, insight, recommendation } = data
  const statusBadge = STATUS_BADGES[sub.status] ?? STATUS_BADGES.active
  const confidence = sub.confidence ?? recommendation?.confidence
  const action = sub.action ?? recommendation?.action
  const signalLabels = signals.map((s) => s.value)

  return (
    <main className="min-h-screen bg-canvas flex flex-col justify-between">
      <TopNav
        title={sub.merchant}
        rightMeta={
          <span
            className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${statusBadge.badgeClass}`}
          >
            {statusBadge.label}
          </span>
        }
      />

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 pt-4">
        <Link
          href="/subscriptions"
          className="type-footnote inline-flex min-h-[44px] items-center gap-1.5 font-medium text-label-2 hover:text-label hover:underline"
        >
          ← Back to subscriptions
        </Link>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Identity block */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-start gap-4 sm:gap-5 rounded-[var(--radius-card)] bg-surface p-6 border border-separator/80 shadow-xs"
        >
          <div className="size-14 shrink-0 rounded-2xl bg-surface-2 p-1 border border-separator/60 flex items-center justify-center">
            <BrandLogo
              merchant={sub.merchant}
              domain={(sub as any).domain}
              logoUrl={(sub as any).logo_url}
              size={44}
              label={sub.merchant}
            />
          </div>

          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h1 className="type-title-1 font-[600] text-label tracking-tight truncate">
                {sub.merchant}
              </h1>
              <span
                className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${statusBadge.badgeClass}`}
              >
                {statusBadge.label}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="type-headline font-bold text-label tabular text-xl">
                {formatMoney(sub.amount, sub.currency)}
              </span>
              <span className="type-caption text-label-3">
                {CADENCE_LABELS[sub.cadence] ?? `/${sub.cadence}`}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-label-3">
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-medium uppercase tracking-wider text-[10px] text-label-2 border border-separator">
                {sub.source}
              </span>
              <span>Detected {formatDate(sub.detected_at)}</span>
              {sub.last_charged && (
                <span>· Last charged {formatDate(sub.last_charged)}</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Honest Email Notice (R28 / Section 4) */}
        {(dispatchedCancel || sub.status === 'cancelled') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <EmailTierNotice merchant={sub.merchant} />
          </motion.div>
        )}

        {/* Intelligence block */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6 border border-separator/80 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="type-eyebrow font-semibold text-label">
              Intelligence & Blast Radius
            </span>
            <motion.button
              type="button"
              onClick={runAnalysis}
              disabled={analyzing}
              whileHover={{ scale: analyzing ? 1 : 1.02 }}
              whileTap={{ scale: analyzing ? 1 : 0.98 }}
              className="touch-target inline-flex min-h-[44px] items-center rounded-full border border-separator bg-surface px-4 type-footnote font-semibold text-label shadow-2xs hover:bg-surface-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              {analyzing
                ? 'Evaluating…'
                : confidence !== undefined
                  ? 'Re-evaluate'
                  : 'Run evaluation'}
            </motion.button>
          </div>

          {confidence !== undefined ? (
            <ConfidenceScore
              score={confidence}
              signals={signalLabels}
              action={action}
            />
          ) : (
            <p className="type-callout text-label-2">
              No evaluation yet. Run an analysis to score this subscription and
              inspect what you’d lose if cancelled.
            </p>
          )}
        </motion.div>

        {/* AI Insight */}
        {insight && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-6 border border-separator/80 shadow-xs"
          >
            <span className="type-eyebrow font-semibold text-label-2">
              Agent Judgment
            </span>
            <p className="type-callout text-label leading-relaxed font-normal">
              {insight}
            </p>
          </motion.div>
        )}

        {/* Recommendation */}
        {recommendation && action && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6 border border-separator/80 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="type-eyebrow font-semibold text-label">
                Recommended Action
              </span>
              <span
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border ${ACTION_STYLES[action] ?? ''}`}
              >
                {action}
              </span>
            </div>

            {recommendation.evidence.length > 0 && (
              <ul className="flex flex-col gap-2 pt-1">
                {recommendation.evidence.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 type-footnote text-label-2"
                  >
                    <span className="size-1.5 rounded-full bg-accent shrink-0 mt-2" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {/* Reminder scheduling */}
        {sub.status !== 'cancelled' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-6 border border-separator/80 shadow-xs"
          >
            <span className="type-eyebrow font-semibold text-label">
              Set Autonomous Reminder
            </span>
            {reminderSent ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="type-footnote text-success font-semibold"
              >
                Reminder scheduled. SHAMAR will notify you before the next
                billing cycle.
              </motion.p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {[
                  { label: 'Tomorrow', days: 1 },
                  { label: '3 days', days: 3 },
                  { label: '1 week', days: 7 },
                  { label: '1 month', days: 30 },
                ].map(({ label, days }) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => scheduleReminder(days)}
                    disabled={reminderSending}
                    className="touch-target inline-flex min-h-[44px] items-center rounded-full border border-separator bg-surface-2 px-4 type-footnote font-semibold text-label hover:bg-surface disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {reminderError && (
              <p className="type-caption text-accent font-medium">
                {reminderError}
              </p>
            )}
          </motion.div>
        )}

        {/* Status Actions */}
        {sub.status !== 'cancelled' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 flex-wrap pt-2"
          >
            {sub.status === 'active' && (
              <>
                <button
                  type="button"
                  onClick={() => changeStatus('paused')}
                  disabled={statusChanging}
                  className="touch-target inline-flex min-h-[48px] items-center justify-center rounded-full border border-separator bg-surface px-6 type-headline font-semibold text-label shadow-2xs hover:bg-surface-2 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={cancelSubscription}
                  disabled={statusChanging}
                  className="touch-target inline-flex min-h-[48px] items-center justify-center rounded-full bg-accent px-6 type-headline font-semibold text-on-accent shadow-xs hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {statusChanging ? 'Dispatching…' : 'Cancel subscription'}
                </button>
              </>
            )}
            {sub.status === 'paused' && (
              <button
                type="button"
                onClick={() => changeStatus('active')}
                disabled={statusChanging}
                className="touch-target inline-flex min-h-[48px] items-center justify-center rounded-full bg-success px-6 type-headline font-semibold text-white shadow-xs hover:bg-success/90 active:scale-[0.97] disabled:opacity-50 transition-all cursor-pointer"
              >
                Resume
              </button>
            )}
          </motion.div>
        )}

        {cancelFeedback && (
          <p className="type-caption text-label-2 font-medium">
            {cancelFeedback}
          </p>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
