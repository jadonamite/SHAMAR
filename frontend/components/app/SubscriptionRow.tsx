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
}

interface SubscriptionRowProps {
  sub: Subscription
  onStatusChange?: (
    id: string,
    status: 'active' | 'paused' | 'cancelled'
  ) => void
  href?: string
}

const KNOWN_BRANDS: Record<string, BrandName> = {
  netflix: 'netflix',
  spotify: 'spotify',
  claude: 'claude',
  anthropic: 'claude',
  figma: 'figma',
  youtube: 'youtube',
  google: 'gmail',
  gmail: 'gmail',
  chatgpt: 'chatgpt',
  openai: 'chatgpt',
  notion: 'notion',
  duolingo: 'duolingo',
  dropbox: 'dropbox',
  canva: 'canva',
  adobe: 'adobe',
  telegram: 'telegram',
}

function resolveBrand(merchant: string): BrandName | null {
  const clean = merchant.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const [key, brand] of Object.entries(KNOWN_BRANDS)) {
    if (clean.includes(key)) return brand
  }
  return null
}

function FallbackAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 size-10 items-center justify-center rounded-[11px] bg-surface-2 ring-1 ring-black/[0.06] text-label font-bold text-sm select-none"
    >
      {initial}
    </span>
  )
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
  const brand = resolveBrand(sub.merchant || sub.name)

  const isHighRisk = (sub.confidence ?? 0) >= 60

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => href && router.push(href)}
      whileHover={{ y: -1.5, scale: 1.003 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex items-center justify-between gap-4 rounded-[var(--radius-tile)] bg-surface p-3.5 sm:p-4 border border-separator/70 transition-all ${
        hovered
          ? 'shadow-xs border-separator-strong'
          : 'shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
      } ${href ? 'cursor-pointer' : ''}`}
    >
      {/* Left: Avatar + Title info */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {brand ? (
          <BrandLogo name={brand} size={40} label={sub.merchant} />
        ) : (
          <FallbackAvatar name={sub.merchant || sub.name} />
        )}

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="type-headline font-semibold text-label truncate">
              {sub.merchant || sub.name}
            </span>

            {/* Status indicator tag */}
            {sub.status === 'paused' && (
              <span className="type-caption rounded-full bg-warning/15 px-2 py-0.5 font-bold text-warning">
                Paused
              </span>
            )}
            {sub.status === 'cancelled' && (
              <span className="type-caption rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent-text">
                Cancelled
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 type-caption text-label-3">
            <span className="capitalize">{sub.cadence}</span>
            <span>·</span>
            <span className="capitalize">{sub.source}</span>
            {sub.last_charged && (
              <>
                <span>·</span>
                <span>
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

      {/* Middle: Blast Radius Risk Badge */}
      <div className="hidden sm:flex items-center gap-2">
        {sub.confidence != null && (
          <span
            className={`type-caption rounded-full px-2.5 py-1 font-semibold tabular ${
              isHighRisk
                ? 'bg-accent-soft text-accent-text'
                : 'bg-surface-2 text-label-2'
            }`}
          >
            {sub.confidence}% blast radius
          </span>
        )}

        {sub.action && (
          <span className="type-caption uppercase font-bold text-label-3 tracking-wider">
            {sub.action}
          </span>
        )}
      </div>

      {/* Right: Amount & Quick Action Controls */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <span className="type-callout font-[600] tabular text-label block">
            {formatMoney(sub.amount, sub.currency)}
          </span>
          <span className="type-caption text-label-3 block">
            {CADENCE_LABELS[sub.cadence]}
          </span>
        </div>

        {/* Quick actions (visible on hover or focus) */}
        {onStatusChange && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5"
          >
            {sub.status === 'active' && (
              <>
                <button
                  type="button"
                  onClick={() => onStatusChange(sub.id, 'paused')}
                  aria-label="Pause subscription"
                  className="type-caption touch-target min-h-[36px] px-2.5 rounded-full border border-separator/80 bg-surface-2 font-semibold text-warning hover:bg-warning/15 transition-colors"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange(sub.id, 'cancelled')}
                  aria-label="Cancel subscription"
                  className="type-caption touch-target min-h-[36px] px-2.5 rounded-full bg-accent-soft font-semibold text-accent-text hover:bg-accent hover:text-white transition-colors"
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
                className="type-caption touch-target min-h-[36px] px-3 rounded-full bg-success/15 font-semibold text-success hover:bg-success hover:text-white transition-colors"
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
