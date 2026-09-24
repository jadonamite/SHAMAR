'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import BrandLogo from '@/components/ui/BrandLogo'
import { apiFetch } from '@/lib/api'

interface ConnectGmailProps {
  onConnected?: () => void
  compact?: boolean
}

export default function ConnectGmail({ compact = false }: ConnectGmailProps) {
  const { user } = usePrivy()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveUserId =
    user?.id ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('shamar_dev_user')
      : null)

  async function handleConnect() {
    if (!effectiveUserId) return
    setConnecting(true)
    setError(null)
    try {
      const res = await apiFetch('/api/gmail/connect', {
        method: 'POST',
        userId: effectiveUserId,
      })
      if (!res.ok) {
        setError("We couldn't start the Gmail connection. Please try again.")
        setConnecting(false)
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError("We couldn't start the Gmail connection. Please try again.")
        setConnecting(false)
      }
    } catch {
      setError('Network error starting Gmail connection. Please try again.')
      setConnecting(false)
    }
  }

  if (compact) {
    return (
      <motion.button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="touch-target inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 type-footnote font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
      >
        <BrandLogo name="gmail" size={20} />
        <span>{connecting ? 'Connecting…' : 'Connect Gmail'}</span>
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

      {error && <p className="type-caption text-danger text-center">{error}</p>}

      <motion.button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="touch-target flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-accent px-6 type-headline font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
      >
        <span>{connecting ? 'Connecting…' : 'Connect & Scan Receipts'}</span>
        <span>→</span>
      </motion.button>

      <div className="flex flex-col gap-1 text-center">
        <p className="type-caption text-label-3">
          Redirects to Google&rsquo;s official OAuth consent screen
        </p>
        <p className="text-[11px] text-label-3 leading-snug">
          Google verification in progress: if a prompt appears, click{' '}
          <span className="font-semibold text-label-2">Advanced</span> then{' '}
          <span className="font-semibold text-label-2">Go to SHAMAR</span>.
        </p>
      </div>
    </motion.div>
  )
}
