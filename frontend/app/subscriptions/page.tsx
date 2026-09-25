'use client'

import { useEffect, useState, useMemo } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import SubscriptionRow, {
  type Subscription,
} from '@/components/app/SubscriptionRow'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'
import { normalizeSubscription } from '@/lib/normalize'
import { aggregateByCurrency, formatAggregate } from '@/lib/format'

type Filter = 'all' | 'monthly' | 'yearly' | 'high-risk'
type Sort = 'spend' | 'risk' | 'detected'

function filterAndSortSubscriptions(
  subs: Subscription[],
  filter: Filter,
  sort: Sort
) {
  let list = subs.filter((s) => s.status === 'active')
  if (filter === 'monthly') list = list.filter((s) => s.cadence === 'monthly')
  if (filter === 'yearly') list = list.filter((s) => s.cadence === 'yearly')
  if (filter === 'high-risk')
    list = list.filter((s) => (s.confidence ?? 0) >= 60)
  return [...list].sort((a, b) => {
    if (sort === 'risk') return (b.confidence ?? 0) - (a.confidence ?? 0)
    if (sort === 'detected') return b.id > a.id ? 1 : -1
    // spend
    const toMonthly = (s: Subscription) =>
      s.cadence === 'yearly'
        ? s.amount / 12
        : s.cadence === 'weekly'
          ? s.amount * 4.33
          : s.amount
    return toMonthly(b) - toMonthly(a)
  })
}

import { apiFetch } from '@/lib/api'
import { getCachedDashboardData, setCachedDashboardData } from '@/lib/cache'

export default function SubscriptionsPage() {
  const { ready, authenticated, user } = usePrivy()
  const router = useRouter()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('spend')

  const effectiveUserId = user?.id ?? null
  const isUserAuthenticated = authenticated

  // Instant hydration from cache
  useEffect(() => {
    if (!effectiveUserId) return
    const cached = getCachedDashboardData(effectiveUserId)
    if (cached?.subs && cached.subs.length > 0) {
      setSubs(cached.subs)
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => {
    if (!ready) return
    if (!isUserAuthenticated) {
      router.replace('/dashboard')
      return
    }
    if (!effectiveUserId) return
    const cached = getCachedDashboardData(effectiveUserId)
    if (!cached || cached.subs.length === 0) {
      setLoading(true)
    }
    apiFetch('/api/subscriptions')
      .then((r) => r.json())
      .then((d) => {
        const list = ((d.subscriptions ?? []) as Subscription[]).map(
          normalizeSubscription
        )
        setSubs(list)
        setCachedDashboardData(effectiveUserId, { subs: list })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ready, isUserAuthenticated, effectiveUserId, router])

  const filtered = useMemo(
    () => filterAndSortSubscriptions(subs, filter, sort),
    [subs, filter, sort]
  )
  const activeSubs = subs.filter((s) => s.status === 'active')
  const totalMonthlyStr = formatAggregate(
    aggregateByCurrency(
      activeSubs,
      (s: Subscription) => {
        if (s.cadence === 'yearly') return s.amount / 12
        if (s.cadence === 'weekly') return s.amount * 4.33
        if (s.cadence === 'daily') return s.amount * 30
        return s.amount
      },
      (s: Subscription) => s.currency ?? 'USD'
    )
  )

  const handleStatusChange = async (
    id: string,
    status: 'active' | 'paused' | 'cancelled'
  ) => {
    if (!effectiveUserId) return
    try {
      await apiFetch(`/api/subscriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
    } catch {
      // offline
    }
  }

  if (!ready || !isUserAuthenticated) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="size-2 rounded-full bg-accent animate-pulse" />
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between">
      <TopNav title="Subscriptions" />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 md:px-8 py-8 flex flex-col gap-6">
        {/* Main Bento Card */}
        <div className="flex flex-col gap-6 rounded-[var(--radius-section)] bg-surface p-6 sm:p-8 border border-separator/70 shadow-xs">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-separator/50 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="type-title-1 font-[600] text-label tracking-tight">
                  Subscriptions
                </h1>
                <span className="type-caption rounded-full bg-surface-2 px-2.5 py-0.5 font-bold text-label-2 tabular">
                  {activeSubs.length} active
                </span>
              </div>
              <p className="type-callout text-label-2 mt-0.5">
                Total monthly commitment:{' '}
                <strong className="text-label font-semibold tabular">
                  {totalMonthlyStr} / mo
                </strong>
              </p>
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-surface-2 p-1 ring-1 ring-black/[0.04]">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'yearly', label: 'Yearly' },
                  { id: 'high-risk', label: 'High Risk' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`type-footnote min-h-[34px] px-3.5 py-1 rounded-full font-semibold transition-all ${
                    filter === f.id
                      ? 'bg-surface text-label shadow-xs ring-1 ring-black/[0.06]'
                      : 'text-label-2 hover:text-label'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subscriptions List */}
          {loading ? (
            <div className="py-20 text-center type-footnote font-semibold text-label-3">
              Loading subscriptions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center type-callout text-label-3">
              No subscriptions found matching this filter.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filtered.map((sub) => (
                <SubscriptionRow
                  key={sub.id}
                  sub={sub}
                  onStatusChange={handleStatusChange}
                  href={`/subscriptions/${sub.id}`}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
