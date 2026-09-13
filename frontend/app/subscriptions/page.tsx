'use client'

import { useEffect, useState, useMemo } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import SubscriptionRow, { type Subscription } from '@/components/app/SubscriptionRow'
import ConnectGmail from '@/components/app/ConnectGmail'
import { useToast } from '@/components/providers/ToastProvider'
import Link from 'next/link'
import TopNav from '@/components/app/TopNav'
import { normalizeSubscription } from '@/lib/normalize'
import { aggregateByCurrency, formatAggregate } from '@/lib/format'

// ... (unchanged imports and types)

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

export default function SubscriptionsPage() {
  // ... (unchanged state and effects)

  const filtered = useMemo(() => filterAndSortSubscriptions(subs, filter, sort), [subs, filter, sort])
  const groups = groupByCategory(filtered)
  const activeSubs = subs.filter((s) => s.status === 'active')
  const totalMonthlyStr = formatAggregate(
    aggregateByCurrency(
      activeSubs,
      (s) => {
        if (s.cadence === 'yearly') return s.amount / 12
        if (s.cadence === 'weekly') return s.amount * 4.33
        if (s.cadence === 'daily') return s.amount * 30
        return s.amount
      },
      (s) => s.currency ?? 'USD',
    ),
  )

  // ... (unchanged rendering)
}