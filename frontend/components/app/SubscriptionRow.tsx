'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { formatMoney } from '@/lib/format'
import BrandLogo, { type BrandName } from '@/components/ui/BrandLogo'

export type Subscription = {
  id: string
  name: string
  merchant: string
  amount: number
  currency?: string
  cadence: 'daily' | 'weekly' | 'monthly' | 'yearly'
  source: 'gmail' | 'wallet'
  status: 'active' | 'paused' | 'cancelled'
  confidence?: number
  action?: 'cancel' | 'pause' | 'remind' | 'keep'
  last_charged?: string | null
  detected_at?: string | null
  domain?: string
  logo_url?: string
}

interface SubscriptionRowProps {
  sub: Subscription
  onStatusChange?: (
    id: string,
    status: 'active' | 'paused' | 'cancelled'
  ) => void
  href?: string
}

const CADENCE_LABELS: Record<string, string> = {
  daily: '/day',
  weekly: '/wk',
  monthly: '/mo',
  yearly: '/yr',
}

export default function SubscriptionRow({
  sub,
  onStatusChange,
  href,
}: SubscriptionRowProps) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()

  const isHighRisk = (sub.confidence ?? 0) >= 60

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => href && router.push(href)}
      whileHover={{ y: -1.5, scale: 1.003 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 rounded-[var(--radius-tile)] bg-surface p-3.5 sm:p-4 border border-separator/70 transition-all ${
        hovered
          ? 'shadow-xs border-separator-strong'
          : 'shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
      } ${href ? 'cursor-pointer' : ''}`}
    >
      {/* Top Line on mobile, Left on desktop */}
      <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0 sm:flex-1">
        {/* Avatar + Merchant Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <BrandLogo
            merchant={sub.merchant || sub.name}
            domain={sub.domain}
            logoUrl={sub.logo_url}
            size={40}
            label={sub.merchant || sub.name}
          />

          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="type-headline font-semibold text-label truncate">
                {sub.merchant || sub.name}
              </span>

              {/* Status indicator tag */}
              {sub.status === 'paused' && (
                <span className="type-caption shrink-0 rounded-full bg-warning/15 px-2 py-0.5 font-bold text-warning text-[10px]">
                  Paused
                </span>
              )}
              {sub.status === 'cancelled' && (
                <span className="type-caption shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent-text text-[10px]">
                  Cancelled
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 type-caption text-label-3 text-xs">
              <span className="capitalize">{sub.cadence}</span>
              <span>·</span>
              <span className="capitalize">{sub.source}</span>
              {sub.last_charged && (
                <>
                  <span>·</span>
                  <span className="whitespace-nowrap">
                    Last:{' '}
                    {new Date(sub.last_charged).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile-only Price display in top right */}
        <div className="text-right sm:hidden shrink-0 pl-2">
          <span className="type-callout font-[600] tabular text-label block">
            {formatMoney(sub.amount, sub.currency)}
          </span>
          <span className="type-caption text-label-3 block">
            {CADENCE_LABELS[sub.cadence]}
          </span>
        </div>
      </div>

      {/* Bottom Line on mobile, Inline on desktop */}
      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2.5 sm:pt-0 border-t border-separator/40 sm:border-0">
        {/* Blast Radius Risk Badge */}
        <div className="flex items-center gap-2">
          {sub.confidence != null && (
            <span
              className={`type-caption rounded-full px-2.5 py-0.5 sm:py-1 font-semibold tabular text-xs ${
                isHighRisk
                  ? 'bg-accent-soft text-accent-text'
                  : 'bg-surface-2 text-label-2'
              }`}
            >
              {sub.confidence}% blast radius
            </span>
          )}

          {sub.action && (
            <span className="type-caption uppercase font-bold text-label-3 tracking-wider text-[11px] hidden sm:inline">
              {sub.action}
            </span>
          )}
        </div>

        {/* Desktop Price display */}
        <div className="text-right hidden sm:block">
          <span className="type-callout font-[600] tabular text-label block">
            {formatMoney(sub.amount, sub.currency)}
          </span>
          <span className="type-caption text-label-3 block">
            {CADENCE_LABELS[sub.cadence]}
          </span>
        </div>

        {/* Quick actions */}
        {onStatusChange && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 shrink-0"
          >
            {sub.status === 'active' && (
              <>
                <button
                  type="button"
                  onClick={() => onStatusChange(sub.id, 'paused')}
                  aria-label="Pause subscription"
                  className="type-caption touch-target min-h-[34px] sm:min-h-[36px] px-3 rounded-full border border-separator/80 bg-surface-2 font-semibold text-warning hover:bg-warning/15 transition-colors cursor-pointer"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange(sub.id, 'cancelled')}
                  aria-label="Cancel subscription"
                  className="type-caption touch-target min-h-[34px] sm:min-h-[36px] px-3 rounded-full bg-accent-soft font-semibold text-accent-text hover:bg-accent hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </>
            )}
            {sub.status === 'paused' && (
              <button
                type="button"
                onClick={() => onStatusChange(sub.id, 'active')}
                aria-label="Resume subscription"
                className="type-caption touch-target min-h-[34px] sm:min-h-[36px] px-3.5 rounded-full bg-success/15 font-semibold text-success hover:bg-success hover:text-white transition-colors cursor-pointer"
              >
                Resume
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
