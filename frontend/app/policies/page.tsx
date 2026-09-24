'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'
import { apiFetch } from '@/lib/api'

type PolicyTrigger = 'trial_cancel' | 'spend_alert' | 'inactivity_pause'
type PolicyAction = 'cancel' | 'pause' | 'remind' | 'alert'

type Policy = {
  id: string
  name: string
  trigger: PolicyTrigger
  conditions: Record<string, unknown>
  action: PolicyAction
  enabled: boolean
  created_at: string
  last_triggered_at: string | null
}

type EvalResult = {
  policy_id: string
  policy_name: string
  trigger: string
  action: string
  subscription_id: string | null
  merchant: string | null
  reason: string
}

const TRIGGER_LABELS: Record<PolicyTrigger, string> = {
  trial_cancel: 'Trial Auto-Cancel',
  spend_alert: 'Spend Threshold Alert',
  inactivity_pause: 'Inactivity Pause',
}

const TRIGGER_DESCRIPTIONS: Record<PolicyTrigger, string> = {
  trial_cancel:
    'Cancel subscriptions that look like trials after a set number of days',
  spend_alert: 'Alert when total monthly spend exceeds a threshold',
  inactivity_pause: 'Pause subscriptions with no recent charges',
}

const ACTION_STYLES: Record<
  PolicyAction,
  { label: string; badgeClass: string }
> = {
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
  alert: {
    label: 'Alert',
    badgeClass: 'text-accent-text bg-accent-soft border-accent/20',
  },
}

type DraftPolicy = {
  name: string
  trigger: PolicyTrigger
  action: PolicyAction
  trial_days: string
  spend_threshold: string
  inactive_days: string
  merchant: string
}

const BLANK: DraftPolicy = {
  name: '',
  trigger: 'trial_cancel',
  action: 'cancel',
  trial_days: '7',
  spend_threshold: '100',
  inactive_days: '30',
  merchant: '',
}

function buildConditions(draft: DraftPolicy) {
  if (draft.trigger === 'trial_cancel') {
    return {
      trial_days: Number(draft.trial_days) || 7,
      ...(draft.merchant ? { merchant: draft.merchant } : {}),
    }
  }
  if (draft.trigger === 'spend_alert') {
    return {
      spend_threshold: Number(draft.spend_threshold) || 100,
      currency: 'USD',
    }
  }
  if (draft.trigger === 'inactivity_pause') {
    return {
      inactive_days: Number(draft.inactive_days) || 30,
      ...(draft.merchant ? { merchant: draft.merchant } : {}),
    }
  }
  return {}
}

export default function PoliciesPage() {
  const { ready, authenticated, user } = usePrivy()
  const router = useRouter()

  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<DraftPolicy>(BLANK)
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [evalResults, setEvalResults] = useState<EvalResult[] | null>(null)
  const [applying, setApplying] = useState(false)

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

  async function load(uid = effectiveUserId) {
    if (!uid) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/policies', { userId: uid })
      if (res.ok) setPolicies((await res.json()).policies ?? [])
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  async function createPolicy() {
    if (!draft.name || saving || !effectiveUserId) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        userId: effectiveUserId,
        body: JSON.stringify({
          name: draft.name,
          trigger: draft.trigger,
          action: draft.action,
          conditions: buildConditions(draft),
        }),
      })
      if (res.ok) {
        const { policy } = await res.json()
        setPolicies((prev) => [policy, ...prev])
        setShowNew(false)
        setDraft(BLANK)
      }
    } catch {
      // offline
    } finally {
      setSaving(false)
    }
  }

  async function togglePolicy(id: string, enabled: boolean) {
    if (!effectiveUserId) return
    setPolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled } : p))
    )
    try {
      await apiFetch(`/api/policies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        userId: effectiveUserId,
        body: JSON.stringify({ enabled }),
      })
    } catch {}
  }

  async function deletePolicy(id: string) {
    if (!effectiveUserId) return
    setPolicies((prev) => prev.filter((p) => p.id !== id))
    try {
      await apiFetch(`/api/policies/${id}`, {
        method: 'DELETE',
        userId: effectiveUserId,
      })
    } catch {}
  }

  async function evaluate() {
    if (evaluating || !effectiveUserId) return
    setEvaluating(true)
    setEvalResults(null)
    try {
      const res = await apiFetch('/api/policies/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        userId: effectiveUserId,
        body: JSON.stringify({ apply: false }),
      })
      if (res.ok) {
        const data = await res.json()
        setEvalResults(data.results ?? [])
      }
    } catch {
      // offline
    } finally {
      setEvaluating(false)
    }
  }

  async function applyPolicies() {
    if (applying || !evalResults || !effectiveUserId) return
    setApplying(true)
    try {
      await apiFetch('/api/policies/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        userId: effectiveUserId,
        body: JSON.stringify({ apply: true }),
      })
      setEvalResults(null)
      await load(effectiveUserId)
    } catch {
      // offline
    } finally {
      setApplying(false)
    }
  }

  if (!ready || !isUserAuthenticated) return null

  return (
    <main className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav
        title="Policies"
        actions={
          <div className="flex items-center gap-2">
            {policies.length > 0 && (
              <button
                type="button"
                onClick={evaluate}
                disabled={evaluating}
                className="touch-target inline-flex min-h-[44px] items-center rounded-full border border-separator bg-surface px-4 type-footnote font-semibold text-label shadow-2xs hover:bg-surface-2 transition-colors cursor-pointer"
              >
                {evaluating ? 'Evaluating…' : 'Test Dry Run'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowNew(true)
                setDraft(BLANK)
              }}
              className="touch-target inline-flex min-h-[44px] items-center rounded-full bg-accent px-5 type-footnote font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors cursor-pointer"
            >
              + Create Policy
            </button>
          </div>
        }
      />

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="type-title-1 font-[600] text-label tracking-tight">
            Automation Rules
          </h1>
          <p className="type-callout text-label-2">
            Deterministic policies that govern autonomous cancellations, pauses,
            and alerts.
          </p>
        </div>

        {/* Dry run evaluation results */}
        <AnimatePresence>
          {evalResults !== null && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-6 border border-separator shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="type-eyebrow font-semibold text-label">
                  Evaluation: {evalResults.length}{' '}
                  {evalResults.length === 1 ? 'match' : 'matches'}
                </span>
                {evalResults.length > 0 && (
                  <button
                    type="button"
                    onClick={applyPolicies}
                    disabled={applying}
                    className="touch-target inline-flex min-h-[44px] items-center rounded-full bg-accent px-4 type-footnote font-semibold text-white shadow-xs hover:bg-accent-hover transition-colors cursor-pointer"
                  >
                    {applying ? 'Applying…' : 'Execute Matches'}
                  </button>
                )}
              </div>

              {evalResults.length === 0 ? (
                <p className="type-caption text-label-2">
                  No subscriptions currently trigger active policy conditions.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-separator/60 pt-1">
                  {evalResults.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between py-2.5"
                    >
                      <div>
                        <p className="type-footnote font-semibold text-label">
                          {r.merchant ?? 'Global'} ·{' '}
                          <span className="capitalize text-accent">
                            {r.action}
                          </span>
                        </p>
                        <p className="type-caption text-label-3">{r.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Policy Form */}
        <AnimatePresence>
          {showNew && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-6 border border-separator shadow-sm"
            >
              <span className="type-eyebrow font-semibold text-accent">
                New Automation Rule
              </span>

              <div className="flex flex-col gap-1.5">
                <label className="type-eyebrow text-label-3">Policy Name</label>
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="e.g. Cancel trial after 7 days"
                  className="w-full rounded-xl bg-surface-2 border border-separator px-3.5 py-2.5 text-sm text-label placeholder:text-label-3 outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="type-eyebrow text-label-3">
                  Trigger Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      'trial_cancel',
                      'spend_alert',
                      'inactivity_pause',
                    ] as PolicyTrigger[]
                  ).map((t) => {
                    const isSelected = draft.trigger === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, trigger: t }))}
                        className={`flex flex-col items-start p-3 text-left rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-accent-soft border-accent/40 shadow-xs'
                            : 'bg-surface-2/60 border-separator/60 hover:bg-surface-2'
                        }`}
                      >
                        <span
                          className={`type-footnote font-semibold ${
                            isSelected ? 'text-accent-text' : 'text-label'
                          }`}
                        >
                          {TRIGGER_LABELS[t]}
                        </span>
                        <span className="type-caption text-[11px] text-label-3 mt-1">
                          {TRIGGER_DESCRIPTIONS[t]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Trigger parameters */}
              {draft.trigger === 'trial_cancel' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="type-eyebrow text-label-3">
                      Days threshold
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={draft.trial_days}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, trial_days: e.target.value }))
                      }
                      className="w-full rounded-xl bg-surface-2 border border-separator px-3.5 py-2.5 text-sm text-label font-mono outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="type-eyebrow text-label-3">
                      Merchant (optional)
                    </label>
                    <input
                      value={draft.merchant}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, merchant: e.target.value }))
                      }
                      placeholder="All merchants"
                      className="w-full rounded-xl bg-surface-2 border border-separator px-3.5 py-2.5 text-sm text-label outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              {draft.trigger === 'spend_alert' && (
                <div className="flex flex-col gap-1.5 max-w-xs">
                  <label className="type-eyebrow text-label-3">
                    Monthly Spend Ceiling ($)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={draft.spend_threshold}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        spend_threshold: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl bg-surface-2 border border-separator px-3.5 py-2.5 text-sm text-label font-mono outline-none focus:border-accent"
                  />
                </div>
              )}

              {draft.trigger === 'inactivity_pause' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="type-eyebrow text-label-3">
                      Inactive days
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={draft.inactive_days}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          inactive_days: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl bg-surface-2 border border-separator px-3.5 py-2.5 text-sm text-label font-mono outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="type-eyebrow text-label-3">
                      Merchant (optional)
                    </label>
                    <input
                      value={draft.merchant}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, merchant: e.target.value }))
                      }
                      placeholder="All merchants"
                      className="w-full rounded-xl bg-surface-2 border border-separator px-3.5 py-2.5 text-sm text-label outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="type-eyebrow text-label-3">
                  Action to take
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(
                    ['cancel', 'pause', 'remind', 'alert'] as PolicyAction[]
                  ).map((a) => {
                    const isSelected = draft.action === a
                    const style = ACTION_STYLES[a]
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, action: a }))}
                        className={`touch-target inline-flex min-h-[44px] items-center rounded-full px-4 type-footnote font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? `${style.badgeClass} ring-1 ring-accent`
                            : 'bg-surface-2 border-separator text-label-3 hover:text-label'
                        }`}
                      >
                        {style.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={createPolicy}
                  disabled={saving || !draft.name}
                  className="touch-target inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-6 type-headline font-semibold text-white shadow-xs hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving ? 'Creating…' : 'Save Rule'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNew(false)
                    setDraft(BLANK)
                  }}
                  className="touch-target inline-flex min-h-[44px] items-center justify-center rounded-full border border-separator bg-surface px-5 type-footnote font-semibold text-label hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Policies list */}
        {loading ? (
          <div className="py-20 text-center text-label-3 type-footnote">
            Loading policies…
          </div>
        ) : policies.length === 0 && !showNew ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center rounded-[var(--radius-card)] bg-surface border border-separator p-8">
            <p className="type-callout text-label font-medium">
              No automation policies defined yet.
            </p>
            <p className="type-caption text-label-3">
              Define rules to automatically manage free trials, high-spend
              charges, and forgotten subscriptions.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {policies.map((policy, i) => {
                const actionBadge =
                  ACTION_STYLES[policy.action] ?? ACTION_STYLES.remind
                return (
                  <motion.div
                    key={policy.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: policy.enabled ? 1 : 0.5, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-5 flex items-center justify-between gap-4 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-xs flex-wrap sm:flex-nowrap"
                  >
                    <div className="min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="type-headline font-semibold text-label truncate">
                          {policy.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${actionBadge.badgeClass}`}
                        >
                          {actionBadge.label}
                        </span>
                      </div>
                      <p className="type-caption text-label-3 font-mono">
                        Trigger: {TRIGGER_LABELS[policy.trigger]}
                        {policy.last_triggered_at && (
                          <span>
                            {' '}
                            · Last fired{' '}
                            {new Date(
                              policy.last_triggered_at
                            ).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 ml-auto sm:ml-0">
                      <button
                        type="button"
                        onClick={() => togglePolicy(policy.id, !policy.enabled)}
                        className={`touch-target inline-flex min-h-[44px] items-center rounded-full px-4 type-footnote font-semibold border transition-all cursor-pointer ${
                          policy.enabled
                            ? 'text-success bg-success/10 border-success/30'
                            : 'text-label-3 bg-surface-2 border-separator'
                        }`}
                      >
                        {policy.enabled ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePolicy(policy.id)}
                        className="touch-target inline-flex min-h-[44px] items-center rounded-full border border-separator bg-surface px-4 type-footnote font-semibold text-label-3 hover:text-accent hover:border-accent/40 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
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
