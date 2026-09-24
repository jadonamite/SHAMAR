'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Subscription } from './SubscriptionRow'
import { aggregateByCurrency, formatAggregate } from '@/lib/format'

interface Insight {
  id: string
  tag: string
  title: string
  detail: string
  tone: 'warn' | 'info' | 'alert'
}

const CATEGORY_MAP: Record<string, string[]> = {
  Productivity: [
    'Notion AI',
    'Linear',
    'Airtable',
    'Zapier',
    'Loom',
    'Grammarly',
  ],
  Entertainment: [
    'Netflix',
    'Spotify',
    'Hulu',
    'Disney+',
    'YouTube Premium',
    'Paramount+',
    'Amazon Prime',
  ],
  Developer: [
    'GitHub',
    'GitHub Copilot',
    'Vercel',
    'Supabase',
    'PlanetScale',
    'DigitalOcean',
    'AWS',
  ],
  Design: ['Figma', 'Adobe', 'Canva', 'Midjourney', 'CapCut'],
  AI: ['OpenAI', 'Anthropic', 'ChatGPT Plus', 'Midjourney', 'Google AI Pro', 'Claude Pro'],
  Cloud: ['Dropbox', 'iCloud', 'Google Cloud', 'AWS'],
  Communication: ['Slack', 'Zoom'],
}

function getCategory(merchant: string): string {
  for (const [cat, merchants] of Object.entries(CATEGORY_MAP)) {
    if (merchants.some((m) => merchant.toLowerCase().includes(m.toLowerCase()))) {
      return cat
    }
  }
  return 'Other'
}

function monthly(s: Subscription) {
  if (s.cadence === 'yearly') return s.amount / 12
  if (s.cadence === 'weekly') return s.amount * 4.33
  if (s.cadence === 'daily') return s.amount * 30
  return s.amount
}

function computeInsights(subs: Subscription[]): Insight[] {
  const active = subs.filter((s) => s.status === 'active')
  if (active.length === 0) return []

  const insights: Insight[] = []

  // 1. Duplicate categories — 2+ subs in same category
  const byCategory: Record<string, Subscription[]> = {}
  for (const s of active) {
    const cat = getCategory(s.merchant)
    if (cat === 'Other') continue
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(s)
  }
  const currencyOf = (s: Subscription) => s.currency ?? 'USD'

  for (const [cat, items] of Object.entries(byCategory)) {
    if (items.length >= 2) {
      const total = formatAggregate(
        aggregateByCurrency(items, monthly, currencyOf)
      )
      const names = items.map((s) => s.merchant).join(' + ')
      insights.push({
        id: `dup-${cat}`,
        tag: 'STACK OVERLAP',
        title: `${items.length} ${cat.toLowerCase()} subscriptions running concurrently`,
        detail: `${names} totalling ${total}/mo. Potential for consolidation.`,
        tone: 'warn',
      })
    }
  }

  // 2. High-risk (confidence >= 60)
  const highRisk = active.filter((s) => (s.confidence ?? 0) >= 60)
  if (highRisk.length > 0) {
    const total = formatAggregate(
      aggregateByCurrency(highRisk, monthly, currencyOf)
    )
    const names = highRisk.map((s) => s.merchant).join(', ')
    insights.push({
      id: 'high-risk',
      tag: 'CANCELLATION CANDIDATES',
      title: `${highRisk.length} service${highRisk.length === 1 ? '' : 's'} recommended for review`,
      detail: `${names} — ${total}/mo eligible for automated cancellation.`,
      tone: 'alert',
    })
  }

  // 3. Yearly vs monthly breakdown
  const yearly = active.filter((s) => s.cadence === 'yearly')
  if (yearly.length > 0) {
    const total = formatAggregate(
      aggregateByCurrency(
        yearly,
        (s) => s.amount,
        currencyOf
      )
    )
    insights.push({
      id: 'yearly',
      tag: 'ANNUAL COMMITMENT',
      title: `${yearly.length} annual subscription${yearly.length === 1 ? '' : 's'} active`,
      detail: `${total} committed across yearly renewals.`,
      tone: 'info',
    })
  }

  return insights
}

export default function InsightsCarousel({ subs }: { subs: Subscription[] }) {
  const insights = useMemo(() => computeInsights(subs), [subs])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (insights.length <= 1 || paused) return
    const id = setInterval(
      () => setIndex((i) => (i + 1) % insights.length),
      6000
    )
    return () => clearInterval(id)
  }, [insights.length, paused])

  if (insights.length === 0) return null

  const current = insights[index % insights.length]

  return (
    <div
      className="flex flex-col gap-2.5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between">
        <span className="type-eyebrow text-label-3 uppercase tracking-wider font-semibold">
          AI Intelligence
        </span>
        {insights.length > 1 && (
          <div className="flex gap-1.5 items-center">
            {insights.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1 rounded-full transition-all cursor-pointer ${
                  i === index ? 'w-5 bg-accent' : 'w-2 bg-separator'
                }`}
                aria-label={`Insight ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className={`p-5 sm:p-6 rounded-[var(--radius-card)] bg-surface border shadow-xs border-l-4 ${
            current.tone === 'alert'
              ? 'border-separator/80 border-l-accent'
              : current.tone === 'warn'
                ? 'border-separator/80 border-l-warning'
                : 'border-separator/80 border-l-label'
          }`}
        >
          <div className="flex flex-col gap-1.5">
            <span className="type-eyebrow text-[11px] font-semibold text-label-3 uppercase tracking-wider">
              {current.tag}
            </span>
            <h4 className="type-headline font-semibold text-label">
              {current.title}
            </h4>
            <p className="type-caption text-label-2 leading-relaxed">
              {current.detail}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
