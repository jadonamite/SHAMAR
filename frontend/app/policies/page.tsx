'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import TopNav from '@/components/app/TopNav'

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

const ACTION_COLORS: Record<PolicyAction, string> = {
  cancel: '#E50914',
  pause: '#D97706',
  remind: '#3B82F6',
  alert: '#A78BFA',
}

const TRIGGER_DESCRIPTIONS: Record<PolicyTrigger, string> = {
  trial_cancel: 'Cancel subscriptions that look like trials after a set number of days',
  spend_alert: 'Alert when total monthly spend exceeds a threshold',
  inactivity_pause: 'Pause subscriptions with no recent charges',
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
    return { trial_days: Number(draft.trial_days) || 7, ...(draft.merchant ? { merchant: draft.merchant } : {}) }
  }
  if (draft.trigger === 'spend_alert') {
    return { spend_threshold: Number(draft.spend_threshold) || 100, currency: 'USD' }
  }
  if (draft.trigger === 'inactivity_pause') {
    return { inactive_days: Number(draft.inactive_days) || 30, ...(draft.merchant ? { merchant: draft.merchant } : {}) }
  }
  return {}
}

export default function PoliciesPage() {
  const { ready, authenticated, user, login } = usePrivy()
  const router = useRouter()

  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<DraftPolicy>(BLANK)
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [evalResults, setEvalResults] = useState<EvalResult[] | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) { router.replace('/dashboard'); return }
    if (!user?.id) return
    load()
  }, [ready, authenticated, user?.id])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/policies', { headers: { 'x-user-id': user!.id } })
      if (res.ok) setPolicies((await res.json()).policies ?? [])
    } catch {} finally {
      setLoading(false)
    }
  }

  async function createPolicy() {
    if (!draft.name || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user!.id },
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
    } catch {} finally {
      setSaving(false)
    }
  }

  async function togglePolicy(id: string, enabled: boolean) {
    setPolicies((prev) => prev.map((p) => p.id === id ? { ...p, enabled } : p))
    try {
      await fetch(`/api/policies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user!.id },
        body: JSON.stringify({ enabled }),
      })
    } catch {}
  }

  async function deletePolicy(id: string) {
    setPolicies((prev) => prev.filter((p) => p.id !== id))
    try {
      await fetch(`/api/policies/${id}`, { method: 'DELETE', headers: { 'x-user-id': user!.id } })
    } catch {}
  }

  async function evaluate() {
    if (evaluating) return
    setEvaluating(true)
    setEvalResults(null)
    try {
      const res = await fetch('/api/policies/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user!.id },
        body: JSON.stringify({ apply: false }),
      })
      if (res.ok) {
        const data = await res.json()
        setEvalResults(data.results ?? [])
      }
    } catch {} finally {
      setEvaluating(false)
    }
  }

  async function applyPolicies() {
    if (applying || !evalResults) return
    setApplying(true)
    try {
      await fetch('/api/policies/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user!.id },
        body: JSON.stringify({ apply: true }),
      })
      setEvalResults(null)
      await load()
    } catch {} finally {
      setApplying(false)
    }
  }

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
        title="Policies"
        actions={
          <>
            {policies.length > 0 && (
              <motion.button
                onClick={evaluate}
                disabled={evaluating}
                whileHover={{ scale: evaluating ? 1 : 1.02 }}
                whileTap={{ scale: evaluating ? 1 : 0.98 }}
                className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest cursor-pointer"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  background: 'transparent',
                  color: evaluating ? '#525252' : '#A3A3A3',
                  border: `1px solid ${evaluating ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '2px',
                }}
              >
                {evaluating ? 'Evaluating...' : 'Evaluate'}
              </motion.button>
            )}
            <motion.button
              onClick={() => { setShowNew(true); setDraft(BLANK) }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest cursor-pointer"
              style={{
                fontFamily: 'var(--font-geist-sans)',
                background: '#E50914',
                color: '#fff',
                borderRadius: '2px',
              }}
            >
              + New Policy
            </motion.button>
          </>
        }
      />

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-4">

        {/* Eval results */}
        <AnimatePresence>
          {evalResults !== null && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3 p-5"
              style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Evaluation — {evalResults.length} {evalResults.length === 1 ? 'match' : 'matches'}
                </span>
                {evalResults.length > 0 && (
                  <motion.button
                    onClick={applyPolicies}
                    disabled={applying}
                    whileHover={{ scale: applying ? 1 : 1.02 }}
                    whileTap={{ scale: applying ? 1 : 0.98 }}
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                    style={{
                      fontFamily: 'var(--font-geist-sans)',
                      background: '#E50914',
                      color: '#fff',
                      borderRadius: '2px',
                    }}
                  >
                    {applying ? '...' : 'Apply All'}
                  </motion.button>
                )}
              </div>
              {evalResults.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '12px' }}>
                  No policies matched any subscriptions.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {evalResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3', fontSize: '12px' }}>
                          {r.merchant ?? 'Global'} — <span style={{ color: ACTION_COLORS[r.action as PolicyAction] }}>{r.action}</span>
                        </span>
                        <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '10px' }}>{r.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* New policy form */}
        <AnimatePresence>
          {showNew && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4 p-5"
              style={{ background: '#141414', border: '1px solid rgba(229,9,20,0.2)', borderRadius: '2px' }}
            >
              <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#E50914', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                New Policy
              </span>

              <div className="flex flex-col gap-1">
                <label style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Name</label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Cancel free trials"
                  className="w-full px-3 py-2 text-sm outline-none"
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    background: '#0D0D0D',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                    color: '#fff',
                  }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Trigger</label>
                <div className="flex flex-col gap-2">
                  {(['trial_cancel', 'spend_alert', 'inactivity_pause'] as PolicyTrigger[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setDraft((d) => ({ ...d, trigger: t }))}
                      className="flex items-start gap-3 p-3 text-left cursor-pointer"
                      style={{
                        background: draft.trigger === t ? 'rgba(229,9,20,0.06)' : 'transparent',
                        border: `1px solid ${draft.trigger === t ? 'rgba(229,9,20,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: '2px',
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: 'var(--font-geist-sans)', color: draft.trigger === t ? '#fff' : '#A3A3A3', fontSize: '12px', fontWeight: 600 }}>
                          {TRIGGER_LABELS[t]}
                        </div>
                        <div style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', marginTop: '2px' }}>
                          {TRIGGER_DESCRIPTIONS[t]}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trigger-specific params */}
              {draft.trigger === 'trial_cancel' && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <label style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Days</label>
                    <input
                      type="number" min={1} value={draft.trial_days}
                      onChange={(e) => setDraft((d) => ({ ...d, trial_days: e.target.value }))}
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{ fontFamily: 'var(--font-dm-mono)', background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', color: '#fff' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Merchant (optional)</label>
                    <input
                      value={draft.merchant}
                      onChange={(e) => setDraft((d) => ({ ...d, merchant: e.target.value }))}
                      placeholder="All"
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{ fontFamily: 'var(--font-geist-sans)', background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', color: '#fff' }}
                    />
                  </div>
                </div>
              )}

              {draft.trigger === 'spend_alert' && (
                <div className="flex flex-col gap-1 w-40">
                  <label style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Monthly threshold ($)</label>
                  <input
                    type="number" min={1} value={draft.spend_threshold}
                    onChange={(e) => setDraft((d) => ({ ...d, spend_threshold: e.target.value }))}
                    className="w-full px-3 py-2 text-sm outline-none"
                    style={{ fontFamily: 'var(--font-dm-mono)', background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', color: '#fff' }}
                  />
                </div>
              )}

              {draft.trigger === 'inactivity_pause' && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <label style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Inactive days</label>
                    <input
                      type="number" min={1} value={draft.inactive_days}
                      onChange={(e) => setDraft((d) => ({ ...d, inactive_days: e.target.value }))}
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{ fontFamily: 'var(--font-dm-mono)', background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', color: '#fff' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Merchant (optional)</label>
                    <input
                      value={draft.merchant}
                      onChange={(e) => setDraft((d) => ({ ...d, merchant: e.target.value }))}
                      placeholder="All"
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{ fontFamily: 'var(--font-geist-sans)', background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', color: '#fff' }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Action</label>
                <div className="flex gap-2 flex-wrap">
                  {(['cancel', 'pause', 'remind', 'alert'] as PolicyAction[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setDraft((d) => ({ ...d, action: a }))}
                      className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest cursor-pointer"
                      style={{
                        fontFamily: 'var(--font-geist-sans)',
                        background: draft.action === a ? `${ACTION_COLORS[a]}15` : 'transparent',
                        color: draft.action === a ? ACTION_COLORS[a] : '#525252',
                        border: `1px solid ${draft.action === a ? `${ACTION_COLORS[a]}60` : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: '2px',
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <motion.button
                  onClick={createPolicy}
                  disabled={saving || !draft.name}
                  whileHover={{ scale: saving || !draft.name ? 1 : 1.02 }}
                  whileTap={{ scale: saving || !draft.name ? 1 : 0.98 }}
                  className="px-5 py-2 text-xs font-semibold uppercase tracking-widest cursor-pointer"
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    background: saving || !draft.name ? 'rgba(255,255,255,0.04)' : '#E50914',
                    color: saving || !draft.name ? '#525252' : '#fff',
                    borderRadius: '2px',
                  }}
                >
                  {saving ? 'Saving...' : 'Create Policy'}
                </motion.button>
                <button
                  onClick={() => { setShowNew(false); setDraft(BLANK) }}
                  className="px-4 py-2 text-xs cursor-pointer"
                  style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', background: 'transparent', border: 'none' }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Policy list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '12px' }}>Loading...</span>
          </div>
        ) : policies.length === 0 && !showNew ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '13px' }}>No policies yet.</p>
            <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#3a3a3a', fontSize: '12px' }}>
              Create a policy to let SAM act automatically on your subscriptions.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {policies.map((policy, i) => (
              <motion.div
                key={policy.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start justify-between px-4 py-4"
                style={{
                  background: '#141414',
                  border: `1px solid ${policy.enabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}`,
                  borderRadius: '2px',
                  opacity: policy.enabled ? 1 : 0.5,
                }}
              >
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                      {policy.name}
                    </span>
                    <span
                      className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                      style={{
                        fontFamily: 'var(--font-geist-sans)',
                        color: ACTION_COLORS[policy.action],
                        border: `1px solid ${ACTION_COLORS[policy.action]}40`,
                        borderRadius: '2px',
                      }}
                    >
                      {policy.action}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}>
                    {TRIGGER_LABELS[policy.trigger]}
                  </span>
                  {policy.last_triggered_at && (
                    <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#3a3a3a', fontSize: '10px' }}>
                      Last triggered {new Date(policy.last_triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => togglePolicy(policy.id, !policy.enabled)}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                    style={{
                      fontFamily: 'var(--font-geist-sans)',
                      background: 'transparent',
                      color: policy.enabled ? '#16A34A' : '#525252',
                      border: `1px solid ${policy.enabled ? 'rgba(22,163,74,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '2px',
                    }}
                  >
                    {policy.enabled ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => deletePolicy(policy.id)}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                    style={{
                      fontFamily: 'var(--font-geist-sans)',
                      background: 'transparent',
                      color: '#3a3a3a',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '2px',
                    }}
                  >
                    Del
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </main>
  )
}
