'use client'

import { useEffect, useState, useMemo } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import SubscriptionRow, { type Subscription } from '@/components/app/SubscriptionRow'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'
import { normalizeSubscription } from '@/lib/normalize'
import { aggregateByCurrency, formatAggregate } from '@/lib/format'

type Filter = 'all' | 'monthly' | 'yearly' | 'high-risk'
type Sort = 'spend' | 'risk' | 'detected'

function filterAndSortSubscriptions(subs: Subscription[], filter: Filter, sort: Sort) {
  let list = subs.filter((s) => s.status === 'active')
  if (filter === 'monthly') list = list.filter((s) => s.cadence === 'monthly')
  if (filter === 'yearly') list = list.filter((s) => s.cadence === 'yearly')
  if (filter === 'high-risk') list = list.filter((s) => (s.confidence ?? 0) >= 60)
  return [...list].sort((a, b) => {
    if (sort === 'risk') return (b.confidence ?? 0) - (a.confidence ?? 0)
    if (sort === 'detected') return (b.id > a.id ? 1 : -1)
    // spend
    const toMonthly = (s: Subscription) =>
      s.cadence === 'yearly' ? s.amount / 12 : s.cadence === 'weekly' ? s.amount * 4.33 : s.amount
    return toMonthly(b) - toMonthly(a)
  })
}

function groupByCategory(subs: Subscription[]): Record<string, Subscription[]> {
  const groups: Record<string, Subscription[]> = {}
  for (const sub of subs) {
    const key = 'Subscriptions'
    if (!groups[key]) groups[key] = []
    groups[key].push(sub)
  }
  return groups
}

export default function SubscriptionsPage() {
  const { ready, authenticated, user } = usePrivy()
  const router = useRouter()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('spend')

  useEffect(() => {
    if (!ready) return
    if (!authenticated) { router.replace('/dashboard'); return }
    if (!user?.id) return
    fetch('/api/subscriptions', { headers: { 'x-user-id': user.id } })
      .then((r) => r.json())
      .then((d) => setSubs(((d.subscriptions ?? []) as Subscription[]).map(normalizeSubscription)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ready, authenticated, user?.id, router])

  const filtered = useMemo(() => filterAndSortSubscriptions(subs, filter, sort), [subs, filter, sort])
  const groups = groupByCategory(filtered)
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
      (s: Subscription) => s.currency ?? 'USD',
    ),
  )

  if (!ready) return null
  if (!authenticated) return null

  return (
    <div className="min-h-screen bg-void text-white flex flex-col">
      <TopNav title="Subscriptions" />
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-sans)' }}>
              Subscriptions
            </h1>
            <p className="text-muted text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              {activeSubs.length} active · {totalMonthlyStr}/mo
            </p>
          </div>
          <div className="flex gap-2">
            {(['all', 'monthly', 'yearly', 'high-risk'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded uppercase font-medium tracking-wider ${
                  filter === f ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-neutral-500 font-mono text-xs">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-neutral-500 text-sm">No subscriptions found.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((sub) => (
              <SubscriptionRow key={sub.id} sub={sub} />
            ))}
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}