'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import Link from 'next/link'
import ConfidenceScore from '@/components/app/ConfidenceScore'
import TopNav from '@/components/app/TopNav'
import { normalizeSubscription } from '@/lib/normalize'
import { formatMoney } from '@/lib/format'
import type { Subscription } from '@/components/app/SubscriptionRow'

type Signal = {
  id: string
  type: string
  value: string
  weight: number,
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

const ACTION_COLORS = {
  cancel: '#E50914',
  pause: '#D97706',
  remind: '#3B82F6',
  keep: '#16A34A',
}

const CADENCE_LABELS: Record<string, string> = {
  daily: '/day',
  weekly: '/wk',
  monthly: '/mo',
  yearly: '/yr',
}

const STATUS_STYLES: Record<string, { color: string; border: string }> = {
  active: { color: '#16A34A', border: 'rgba(22,163,74,0.3)' },
  paused: { color: '#D97706', border: 'rgba(217,119,6,0.3)' },
  cancelled: { color: '#525252', border: 'rgba(255,255,255,0.1)' },
}

const formatAmount = formatMoney

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { ready, authenticated, user } = usePrivy()

  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)
  const [reminderSending, setReminderSending] = useState(false)
  const [reminderError, setReminderError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) { router.replace('/dashboard'); return }
    if (!user?.id || !id) return
    load()
  }, [ready, authenticated, user?.id, id])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        headers: { 'x-user-id': user!.id },
      })
      if (!res.ok) { router.replace('/subscriptions'); return }
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

  /**
   * runAnalysis
   * @returns {*}
   */
  async function runAnalysis() {
    if (!user?.id || analyzing) return
    setAnalyzing(true)
    try {
      const res = await fetch(`/api/intelligence/analyze/${id}`, {
        method: 'POST',
        headers: { 'x-user-id': user.id },
      })
      if (res.ok) {
        const json = await res.json()
        setData((prev) =>
          prev
            ? {
                ...prev,
                signals: json.signals?.map((s: { type: string; label: string; value: number }) => ({
                  id: s.type,
                  type: s.type,
                  value: s.label,
                  weight: s.value,
                })) ?? prev.signals,
                insight: json.insight ?? prev.insight,
                recommendation: json.recommendation ?? prev.recommendation,
                subscription: { ...prev.subscription, confidence: json.confidence, action: json.action },
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
    if (!user?.id || reminderSending) return
    setReminderSending(true)
    setReminderError(null)
    const remindAt = new Date(Date.now() + daysFromNow * 86_400_000).toISOString()
    const email = user.email?.address ?? user.google?.email ?? null
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
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

  async function changeStatus(status: 'active' | 'paused' | 'cancelled') {
    if (!user?.id || statusChanging || !data) return
    setStatusChanging(true)
    try {
      const res = await fetch(`/api/subscriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setData((prev) => prev ? { ...prev, subscription: { ...prev.subscription, status } } : prev)
      }
    } catch {
      // offline
    } finally {
      setStatusChanging(false)
    }
  }

  if (!ready || loading) {
    return (
      <main className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-1 h-1 bg-sam-red rounded-full animate-pulse" />
      </main>
    )
  }

  if (!data) return null

  const { subscription: sub, signals, insight, recommendation } = data
  const statusStyle = STATUS_STYLES[sub.status]
  const confidence = sub.confidence ?? recommendation?.confidence
  const action = sub.action ?? recommendation?.action
  const signalLabels = signals.map((s) => s.value)

  return (
    <main className="min-h-screen bg-void">
      <TopNav
        title={sub.merchant}
        rightMeta={
          <span
            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{
              fontFamily: 'var(--font-geist-sans)',
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
              borderRadius: '2px',
            }}
          >
            {sub.status}
          </span>
        }
      />
      <div className="max-w-2xl mx-auto px-6 pt-4">
        <Link
          href="/subscriptions"
          style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '12px' }}
        >
          ← Subscriptions
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Identity block */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-start gap-5"
        >
          <div
            className="w-14 h-14 flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(229,9,20,0.12)',
              border: '1px solid rgba(229,9,20,0.2)',
              borderRadius: '2px',
            }}
          >
            <span style={{ fontFamily: 'var(--font-syne)', color: '#E50914', fontSize: '22px', fontWeight: 700 }}>
              {sub.merchant.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <h1
              style={{ fontFamily: 'var(--font-syne)', color: '#fff', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}
            >
              {sub.merchant}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#fff', fontSize: '20px', letterSpacing: '-0.02em' }}>
                {formatAmount(sub.amount, sub.currency)}
              </span>
              <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '14px' }}>
                {CADENCE_LABELS[sub.cadence]}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span
                className="px-2 py-0.5 text-[10px] uppercase tracking-widest"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  color: sub.source === 'gmail' ? '#3B82F6' : '#A78BFA',
                  border: `1px solid ${sub.source === 'gmail' ? 'rgba(59,130,246,0.3)' : 'rgba(167,139,250,0.3)'}`,
                  borderRadius: '2px',
                }}
              >
                {sub.source}
              </span>
              <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}>
                Detected {formatDate(sub.detected_at)}
              </span>
              {sub.last_charged && (
                <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}>
                  Last charged {formatDate(sub.last_charged)}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

        {/* Intelligence block */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col gap-4 p-5"
          style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}
        >
          <div className="flex items-center justify-between">
            <span
              style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Intelligence
            </span>
            <motion.button
              onClick={runAnalysis}
              disabled={analyzing}
              whileHover={{ scale: analyzing ? 1 : 1.02 }}
              whileTap={{ scale: analyzing ? 1 : 0.98 }}
              className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest cursor-pointer"
              style={{
                fontFamily: 'var(--font-geist-sans)',
                background: 'transparent',
                color: analyzing ? '#525252' : '#E50914',
                border: `1px solid ${analyzing ? 'rgba(255,255,255,0.06)' : 'rgba(229,9,20,0.4)'}`,
                borderRadius: '2px',
              }}
            >
              {analyzing ? 'Analyzing...' : confidence !== undefined ? 'Re-analyze' : 'Run Analysis'}
            </motion.button>
          </div>

          {confidence !== undefined ? (
            <ConfidenceScore score={confidence} signals={signalLabels} action={action} />
          ) : (
            <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '13px' }}>
              No analysis yet. Run analysis to score this subscription.
            </p>
          )}
        </motion.div>

        {/* AI Insight */}
        {insight && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col gap-3 p-5"
            style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}
          >
            <span
              style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              AI Insight
            </span>
            <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3', fontSize: '13px', lineHeight: 1.6 }}>
              {insight}
            </p>
          </motion.div>
        )}

        {/* Recommendation */}
        {recommendation && action && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="flex flex-col gap-4 p-5"
            style={{
              background: '#141414',
              border: `1px solid ${ACTION_COLORS[action]}30`,
              borderRadius: '2px',
            }}
          >
            <div className="flex items-center justify-between">
              <span
                style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                Recommendation
              </span>
              <span
                className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  color: ACTION_COLORS[action],
                  border: `1px solid ${ACTION_COLORS[action]}60`,
                  borderRadius: '2px',
                }}
              >
                {action}
              </span>
            </div>
            {recommendation.evidence.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {recommendation.evidence.map((e, i) => (
                  <li key={i} className="flex items-center gap-2" style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3', fontSize: '12px' }}>
                    <span style={{ color: ACTION_COLORS[action], fontSize: '6px' }}>●</span>
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {/* Reminder */}
        {sub.status !== 'cancelled' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-col gap-3 p-5"
            style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}
          >
            <span
              style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Set Reminder
            </span>
            {reminderSent ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ fontFamily: 'var(--font-geist-sans)', color: '#16A34A', fontSize: '12px' }}
              >
                Reminder scheduled.
              </motion.p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: 'Tomorrow', days: 1 },
                  { label: '3 days', days: 3 },
                  { label: '1 week', days: 7 },
                  { label: '1 month', days: 30 },
                ].map(({ label, days }) => (
                  <button
                    key={days}
                    onClick={() => scheduleReminder(days)}
                    disabled={reminderSending}
                    className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest cursor-pointer"
                    style={{
                      fontFamily: 'var(--font-geist-sans)',
                      background: 'transparent',
                      color: reminderSending ? '#525252' : '#3B82F6',
                      border: `1px solid ${reminderSending ? 'rgba(255,255,255,0.06)' : 'rgba(59,130,246,0.3)'}`,
                      borderRadius: '2px',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {reminderError && (
              <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#E50914', fontSize: '11px' }}>
                {reminderError}
              </p>
            )}
          </motion.div>
        )}

        {/* Status actions */}
        {sub.status !== 'cancelled' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3"
          >
            {sub.status === 'active' && (
              <>
                <button
                  onClick={() => changeStatus('paused')}
                  disabled={statusChanging}
                  className="px-5 py-2.5 text-xs font-semibold uppercase tracking-widest cursor-pointer"
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    background: 'transparent',
                    color: statusChanging ? '#525252' : '#D97706',
                    border: `1px solid ${statusChanging ? 'rgba(255,255,255,0.06)' : 'rgba(217,119,6,0.4)'}`,
                    borderRadius: '2px',
                  }}
                >
                  Pause
                </button>
                <button
                  onClick={() => changeStatus('cancelled')}
                  disabled={statusChanging}
                  className="px-5 py-2.5 text-xs font-semibold uppercase tracking-widest cursor-pointer"
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    background: 'transparent',
                    color: statusChanging ? '#525252' : '#E50914',
                    border: `1px solid ${statusChanging ? 'rgba(255,255,255,0.06)' : 'rgba(229,9,20,0.4)'}`,
                    borderRadius: '2px',
                  }}
                >
                  Cancel Subscription
                </button>
              </>
            )}
            {sub.status === 'paused' && (
              <button
                onClick={() => changeStatus('active')}
                disabled={statusChanging}
                className="px-5 py-2.5 text-xs font-semibold uppercase tracking-widest cursor-pointer"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  background: 'transparent',
                  color: statusChanging ? '#525252' : '#16A34A',
                  border: `1px solid ${statusChanging ? 'rgba(255,255,255,0.06)' : 'rgba(22,163,74,0.4)'}`,
                  borderRadius: '2px',
                }}
              >
                Resume
              </button>
            )}
          </motion.div>
        )}
      </div>
    </main>
  )
}
