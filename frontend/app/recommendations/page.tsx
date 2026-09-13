'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import TopNav from '@/components/app/TopNav'
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

function monthlyEquiv(amount: number, cadence?: string): number {
  if (cadence === 'yearly') return amount / 12
  if (cadence === 'weekly') return amount * 4.33
  if (cadence === 'daily') return amount * 30
  return amount
}

function calculateSavings(recs: Rec[]) {
  const savingsCandidates = recs.filter((r) => r.action === 'cancel' || r.action === 'pause')
  const savingsByCurrency = aggregateByCurrency(
    savingsCandidates,
    (r) => monthlyEquiv(r.amount, r.cadence),
    (r) => r.currency ?? 'USD',
  )
  const totalSavings = Object.values(savingsByCurrency).reduce((s, v) => s + v, 0)
  const totalSavingsStr = formatAggregate(savingsByCurrency)
  return { savingsCandidates, savingsByCurrency, totalSavings, totalSavingsStr }
}

export default function RecommendationsPage() {
  const { ready, authenticated, user } = usePrivy()
  const router = useRouter()
  const [recs, setRecs] = useState<Rec[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) { router.replace('/dashboard'); return }
    if (!user?.id) return
    fetch('/api/recommendations', { headers: { 'x-user-id': user.id } })
      .then((r) => r.json())
      .then((d) => setRecs(((d.recommendations ?? []) as Rec[]).map(normalizeRec)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ready, authenticated, user?.id, router])

  const { totalSavings, totalSavingsStr } = calculateSavings(recs)

  if (!ready) return null
  if (!authenticated) return null

  return (
    <div className="min-h-screen bg-void text-white flex flex-col">
      <TopNav title="Recommendations" />
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
            Recommendations
          </h1>
          <p className="text-muted text-sm" style={{ fontFamily: 'var(--font-dm-mono)' }}>
            {recs.length} actionable insights
          </p>
        </div>

        {totalSavings > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between px-5 py-4"
            style={{
              background: 'rgba(229,9,20,0.06)',
              border: '1px solid rgba(229,9,20,0.2)',
              borderRadius: '2px',
            }}
          >
            <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3', fontSize: '13px' }}>
              Potential monthly savings
            </span>
            <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#E50914', fontSize: '20px', letterSpacing: '-0.02em' }}>
              {totalSavingsStr}
            </span>
          </motion.div>
        )}

        {loading ? (
          <div className="py-20 text-center text-neutral-500 font-mono text-xs">Loading...</div>
        ) : recs.length === 0 ? (
          <div className="py-20 text-center text-neutral-500 text-sm">No recommendations yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {recs.map((rec) => (
              <div
                key={rec.id}
                className="p-4 flex items-center justify-between rounded border"
                style={{ background: '#141414', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div>
                  <h3 className="font-bold text-white">{rec.merchant}</h3>
                  <p className="text-xs text-neutral-400 font-mono">
                    {formatMoney(rec.amount, rec.currency)}/{rec.cadence} · Action: {rec.action}
                  </p>
                </div>
                <Link
                  href={`/subscriptions/${rec.subscription_id}`}
                  className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded hover:bg-neutral-200"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
