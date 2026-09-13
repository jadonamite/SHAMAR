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
  Productivity: ['Notion AI', 'Linear', 'Airtable', 'Zapier', 'Loom', 'Grammarly'],
  Entertainment: ['Netflix', 'Spotify', 'Hulu', 'Disney+', 'YouTube Premium', 'Paramount+', 'Amazon Prime'],
  Developer: ['GitHub', 'GitHub Copilot', 'Vercel', 'Supabase', 'PlanetScale', 'DigitalOcean', 'AWS'],
  Design: ['Figma', 'Adobe', 'Canva', 'Midjourney'],
  AI: ['OpenAI', 'Anthropic', 'ChatGPT Plus', 'Midjourney'],
  Cloud: ['Dropbox', 'iCloud', 'Google Cloud', 'AWS'],
  Communication: ['Slack', 'Zoom'],
}

function getCategory(merchant: string): string {
  for (const [cat, merchants] of Object.entries(CATEGORY_MAP)) {
    if (merchants.includes(merchant)) return cat
  }
  return 'Other'
}

function monthly(s: Subscription) {
  if (s.cadence === 'yearly') return s.amount / 12
  if (s.cadence === 'weekly') return s.amount * 4.33
  if (s.cadence === 'daily')  return s.amount * 30
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
      const total = formatAggregate(aggregateByCurrency(items, monthly, currencyOf))
      const names = items.map((s) => s.merchant).join(' + ')
      insights.push({
        id: `dup-${cat}`,
        tag: 'DUPLICATE STACK',
        title: `${items.length} ${cat.toLowerCase()} tools running in parallel`,
        detail: `${names} — ${total}/mo combined. Likely overlapping value.`,
        tone: 'warn',
      })
    }
  }

  // 2. High-risk (confidence >= 60)
  const highRisk = active.filter((s) => (s.confidence ?? 0) >= 60)
  if (highRisk.length > 0) {
    const total = formatAggregate(aggregateByCurrency(highRisk, monthly, currencyOf))
    insights.push({
      id: 'high-risk',
      tag: 'AT RISK',
      title: `${highRisk.length} subscription${highRisk.length === 1 ? '' : 's'} flagged for review`,
      detail: `${total}/mo across services with weak engagement signals.`,
      tone: 'alert',
    })
  }

  // 3. Top spend category — pick by the largest single-currency bucket so the
  // percentage stays meaningful even when totals span multiple currencies.
  const catTotals = Object.entries(byCategory).map(([cat, items]) => {
    const map = aggregateByCurrency(items, monthly, currencyOf)
    const peak = Math.max(0, ...Object.values(map))
    return { cat, items, map, peak }
  })
  catTotals.sort((a, b) => b.peak - a.peak)
  if (catTotals.length > 0 && catTotals[0].peak > 0) {
    const top = catTotals[0]
    const grandByCurrency = aggregateByCurrency(active, monthly, currencyOf)
    const totalStr = formatAggregate(top.map)
    // Percentage uses the dominant currency in the top category against the
    // same currency's grand total, falling back to absolute share if absent.
    const dominantCurrency = Object.entries(top.map).sort((a, b) => b[1] - a[1])[0][0]
    const grandSame = grandByCurrency[dominantCurrency] ?? 0
    const pct = grandSame > 0 ? Math.round((top.map[dominantCurrency] / grandSame) * 100) : null
    insights.push({
      id: 'top-spend',
      tag: 'SPEND BREAKDOWN',
      title: `${top.cat} is your largest recurring cost`,
      detail: pct != null
        ? `${totalStr}/mo — ${pct}% of total ${dominantCurrency} spend.`
        : `${totalStr}/mo across this category.`,
      tone: 'info',
    })
  }

  // 4. Yearly cadence — often overlooked
  const yearly = active.filter((s) => s.cadence === 'yearly')
  if (yearly.length > 0) {
    const total = formatAggregate(aggregateByCurrency(yearly, (s) => s.amount, currencyOf))
    insights.push({
      id: 'yearly',
      tag: 'YEARLY BILLING',
      title: `${yearly.length} annual subscription${yearly.length === 1 ? '' : 's'} active`,
      detail: `${total} renews each year — easy to forget until charged.`,
      tone: 'info',
    })
  }

  return insights
}

const TONE_COLORS = {
  warn:  { border: 'rgba(217,119,6,0.3)',  tag: '#D97706' },
  alert: { border: 'rgba(229,9,20,0.35)',  tag: '#E50914' },
  info:  { border: 'rgba(255,255,255,0.1)', tag: '#A3A3A3' },
}

export default function InsightsCarousel({ subs }: { subs: Subscription[] }) {
  const insights = useMemo(() => computeInsights(subs), [subs])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (insights.length <= 1 || paused) return
    const id = setInterval(() => setIndex((i) => (i + 1) % insights.length), 6000)
    return () => clearInterval(id)
  }, [insights.length, paused])

  if (insights.length === 0) return null

  const current = insights[index % insights.length]
  const c = TONE_COLORS[current.tone]

  return (
    <div
      className="flex flex-col gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between">
        <span
          style={{
            fontFamily: 'var(--font-geist-sans)',
            color: '#525252',
            fontSize: '10px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Intelligence
        </span>
        {insights.length > 1 && (
          <div className="flex gap-1.5">
            {insights.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                style={{
                  width: i === index ? '16px' : '4px',
                  height: '2px',
                  background: i === index ? '#E50914' : '#2a2a2a',
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
                aria-label={`Insight ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{    opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="p-5"
          style={{
            background: '#0f0f0f',
            border: `1px solid ${c.border}`,
            borderRadius: '3px',
            borderLeft: `2px solid ${c.tag}`,
          }}
        >
          <div className="flex flex-col gap-2">
            <span
              style={{
                fontFamily: 'var(--font-geist-sans)',
                color: c.tag,
                fontSize: '10px',
                letterSpacing: '0.16em',
                fontWeight: 600,
              }}
            >
              {current.tag}
            </span>
            <h3
              style={{
                fontFamily: 'var(--font-syne)',
                color: '#fff',
                fontSize: '18px',
                letterSpacing: '-0.02em',
                lineHeight: 1.3,
                fontWeight: 600,
              }}
            >
              {current.title}
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-geist-sans)',
                color: '#A3A3A3',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {current.detail}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
