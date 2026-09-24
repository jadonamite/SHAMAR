'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import BrandLogo from '@/components/ui/BrandLogo'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'
import { apiFetch } from '@/lib/api'
import { normalizeRec } from '@/lib/normalize'
import { aggregateByCurrency, formatAggregate, formatMoney } from '@/lib/format'

type Rec = {
  id: string
  action: 'cancel' | 'pause' | 'remind' | 'keep'
  confidence: number
  evidence: string[]
  status: string
  created_at: string
  subscription_id: string
  merchant: string
  name: string
  amount: number
  currency: string
  cadence: string
  source: string
  last_charged: string | null
}

const ACTION_TAGS: Record<string, { label: string; badgeClass: string }> = {
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
    badgeClass: 'text-label-2 bg-surface-2 border-separator',
  },
  keep: {
    label: 'Keep',
    badgeClass: 'text-success bg-success/10 border-success/30',
  },
}

function monthlyEquiv(amount: number, cadence?: string): number {
  if (cadence === 'yearly') return amount / 12
  if (cadence === 'weekly') return amount * 4.33
  if (cadence === 'daily') return amount * 30
  return amount
}

function calculateSavings(recs: Rec[]) {
  const savingsCandidates = recs.filter(
    (r) => r.action === 'cancel' || r.action === 'pause'
  )
  const savingsByCurrency = aggregateByCurrency(
    savingsCandidates,
    (r) => monthlyEquiv(r.amount, r.cadence),
    (r) => r.currency ?? 'USD'
  )
  const totalSavings = Object.values(savingsByCurrency).reduce(
    (s, v) => s + v,
    0
  )
  const totalSavingsStr = formatAggregate(savingsByCurrency)
  return { savingsCandidates, savingsByCurrency, totalSavings, totalSavingsStr }
}

export default function RecommendationsPage() {
  const { ready, authenticated, user } = usePrivy()
  const router = useRouter()
  const [recs, setRecs] = useState<Rec[]>([])
  const [loading, setLoading] = useState(true)

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

    apiFetch('/api/recommendations', { userId: effectiveUserId })
      .then((r) => r.json())
      .then((d) =>
        setRecs(((d.recommendations ?? []) as Rec[]).map(normalizeRec))
      )
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ready, isUserAuthenticated, effectiveUserId, router])

  const { totalSavings, totalSavingsStr } = calculateSavings(recs)

  if (!ready || !isUserAuthenticated) {
    return (
      <div className="min-h-screen bg-canvas text-label flex flex-col justify-between">
        <TopNav title="Recommendations" />
        <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-20 text-center flex flex-col items-center justify-center">
          <p className="type-callout text-label-2 mb-4">
            Please connect your wallet to view recommendations.
          </p>
          <Link
            href="/dashboard"
            className="touch-target inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 type-headline text-accent-contrast"
          >
            Go to Dashboard
          </Link>
        </div>
        <AppFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav title="Recommendations" />

      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="type-title-1 font-[600] text-label tracking-tight">
              Recommendations
            </h1>
            <p className="type-callout text-label-2">
              Autonomous evaluations and blast-radius safe decisions.
            </p>
          </div>
          <span className="type-caption font-semibold px-3 py-1 rounded-full bg-surface-2 border border-separator text-label-2">
            {recs.length} actionable insight{recs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {totalSavings > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between px-6 py-4 rounded-[var(--radius-card)] bg-accent-soft border border-accent/25 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
              <span className="type-footnote font-semibold text-accent-text">
                Potential monthly savings identified
              </span>
            </div>
            <span className="type-headline font-bold text-accent-text tabular text-lg">
              {totalSavingsStr}
            </span>
          </motion.div>
        )}

        {loading ? (
          <div className="py-20 text-center text-label-3 type-footnote">
            Evaluating recommendations…
          </div>
        ) : recs.length === 0 ? (
          <div className="py-20 text-center text-label-2 type-callout rounded-[var(--radius-card)] bg-surface border border-separator p-8">
            No recommendations pending. Your subscriptions are balanced.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recs.map((rec) => {
              const tag = ACTION_TAGS[rec.action] ?? ACTION_TAGS.remind
              return (
                <motion.div
                  key={rec.id}
                  whileHover={{ y: -1 }}
                  className="p-5 flex items-center justify-between gap-4 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-xs hover:border-separator transition-all flex-wrap sm:flex-nowrap"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-12 rounded-xl bg-surface-2 border border-separator/60 p-1 flex items-center justify-center shrink-0">
                      <BrandLogo
                        merchant={rec.merchant}
                        size={36}
                        label={rec.merchant}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="type-headline font-semibold text-label truncate">
                          {rec.merchant}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${tag.badgeClass}`}
                        >
                          {tag.label}
                        </span>
                      </div>

                      <p className="type-caption text-label-3 mt-0.5">
                        <span className="font-semibold text-label-2 tabular">
                          {formatMoney(rec.amount, rec.currency)}/{rec.cadence}
                        </span>
                        {rec.confidence
                          ? ` · ${rec.confidence}% confidence`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                    <Link
                      href={`/subscriptions/${rec.subscription_id}`}
                      className="touch-target inline-flex min-h-[44px] items-center rounded-full border border-separator bg-surface px-4 type-footnote font-semibold text-label shadow-2xs hover:bg-surface-2 transition-colors"
                    >
                      Inspect & Act
                    </Link>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <AppFooter />
    </div>
  )
}
