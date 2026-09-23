'use client'

import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import BrandLogo from '@/components/ui/BrandLogo'

interface ConnectGmailProps {
  onConnected?: () => void
  compact?: boolean
}

export default function ConnectGmail({ compact = false }: ConnectGmailProps) {
  const { user } = usePrivy()

  function handleConnect() {
    if (!user?.id) return
    window.location.href = `/api/gmail/auth?user_id=${user.id}`
  }

  if (compact) {
    return (
      <motion.button
        type="button"
        onClick={handleConnect}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="touch-target inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 type-footnote font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors"
      >
        <BrandLogo name="gmail" size={20} />
        <span>Connect Gmail</span>
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-[var(--radius-card)] bg-surface p-8 sm:p-10 border border-separator/80 shadow-xs text-center"
    >
      <div className="relative">
        <BrandLogo name="gmail" size={72} />
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-success text-white text-[11px] font-bold ring-2 ring-surface">
          ✓
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="type-title-2 font-[600] text-label tracking-tight">
          Connect your Gmail
        </h3>
        <p className="type-callout text-label-2 leading-relaxed">
          SHAMAR scans your receipts to find recurring charges. Read-only
          access; your personal mail is never read, sent, or altered.
        </p>
      </div>

      <div className="flex flex-col gap-2.5 w-full text-left rounded-[var(--radius-tile)] bg-surface-2 p-4">
        {[
          'Read-only access strictly scoped to billing keywords',
          'Finds 12 months of receipts in under 30 seconds',
          'Zero passwords or credentials ever stored',
        ].map((item) => (
          <div key={item} className="flex items-center gap-2.5">
            <span className="size-1.5 shrink-0 rounded-full bg-accent" />
            <span className="type-caption font-medium text-label-2">
              {item}
            </span>
          </div>
        ))}
      </div>

      <motion.button
        type="button"
        onClick={handleConnect}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="touch-target flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-accent px-6 type-headline font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors"
      >
        <span>Connect & Scan Receipts</span>
        <span>→</span>
      </motion.button>

      <p className="type-caption text-label-3">
        Redirects to Google&rsquo;s official OAuth consent screen
      </p>
    </motion.div>
  )
}
