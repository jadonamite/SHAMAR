'use client'

import { motion } from 'framer-motion'

interface SubscriptionSkeletonProps {
  scanning?: boolean
  count?: number
}

export default function SubscriptionSkeleton({
  scanning = true,
  count = 3,
}: SubscriptionSkeletonProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-section)] bg-surface p-6 sm:p-8 border border-separator/70 shadow-xs">
      {/* Skeleton Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-separator/50 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-accent animate-pulse" />
          <h3 className="type-title-2 font-[600] text-label">
            {scanning ? 'Scanning Receipts…' : 'Loading Subscriptions…'}
          </h3>
        </div>
        <span className="type-caption font-mono text-label-3">
          Analyzing past 12 months for recurring charges
        </span>
      </div>

      {/* Shimmering Skeleton Rows */}
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06 }}
            className="flex items-center justify-between gap-4 rounded-[var(--radius-tile)] bg-surface-2/60 p-3.5 sm:p-4 border border-separator/50"
          >
            {/* Left: Avatar + Title info */}
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="size-10 rounded-[11px] shimmer shrink-0" />
              <div className="flex flex-col gap-2 min-w-0 flex-1 max-w-xs">
                <div
                  className="h-4 rounded shimmer"
                  style={{ width: i === 0 ? '55%' : i === 1 ? '45%' : '65%' }}
                />
                <div
                  className="h-3 rounded shimmer"
                  style={{ width: i === 0 ? '35%' : i === 1 ? '30%' : '40%' }}
                />
              </div>
            </div>

            {/* Middle: Blast radius badge placeholder */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-6 w-24 rounded-full shimmer" />
            </div>

            {/* Right: Amount & cadence placeholder */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="h-4 w-16 rounded shimmer" />
              <div className="h-3 w-10 rounded shimmer" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
