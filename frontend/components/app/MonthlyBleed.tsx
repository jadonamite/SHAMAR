'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { formatMoney, primaryCurrency, type CurrencyMap } from '@/lib/format'

interface MonthlyBleedProps {
  byCurrency: CurrencyMap
}

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frame: number
    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

export default function MonthlyBleed({ byCurrency }: MonthlyBleedProps) {
  const primary = primaryCurrency(byCurrency) ?? 'USD'
  const primaryAmount = byCurrency[primary] ?? 0
  const display = useCountUp(primaryAmount)

  const extras = Object.entries(byCurrency).filter(
    ([c, v]) => c !== primary && v > 0
  )
  const yearlyPrimary = primaryAmount * 12

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[clamp(2.5rem,4.5vw,3.75rem)] font-[600] leading-none tracking-[-0.035em] text-label tabular">
          {formatMoney(display, primary)}
        </span>
        <span className="type-title-3 font-semibold text-label-3">/ month</span>
      </div>

      {extras.length > 0 && (
        <span className="type-footnote text-label-3 font-medium tabular">
          + {extras.map(([c, v]) => formatMoney(v, c)).join(' + ')} / month
        </span>
      )}

      <p className="type-callout text-label-2">
        You&rsquo;ll spend{' '}
        <span className="font-semibold text-accent-text tabular">
          {formatMoney(yearlyPrimary, primary)}
        </span>{' '}
        this year if nothing changes.
      </p>
    </motion.div>
  )
}
