'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import TopNav from '@/components/app/TopNav'
import { normalizeRec } from '@/lib/normalize'
import { aggregateByCurrency, formatAggregate, formatMoney } from '@/lib/format'

// ... (unchanged imports and constants)

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
  // ... (unchanged state and effects)

  const { savingsCandidates, savingsByCurrency, totalSavings, totalSavingsStr } = calculateSavings(recs)

  // ... (unchanged rendering logic)

  {/* Potential savings banner */}
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

  // ... (unchanged rendering logic)
}
