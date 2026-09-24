'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import BrandLogo from '@/components/ui/BrandLogo'
import { apiFetch } from '@/lib/api'

interface GmailSetupCardProps {
  gmailConnected: boolean
  scanning: boolean
  onScan: () => void
  lastScan?: string | null
}

export default function GmailSetupCard({
  gmailConnected,
  scanning,
  onScan,
  lastScan,
}: GmailSetupCardProps) {
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
        window.location.href = `/api/gmail/auth?user_id=${effectiveUserId}`
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Could not start Google connection. Try again.')
        setConnecting(false)
      }
    } catch {
      window.location.href = `/api/gmail/auth?user_id=${effectiveUserId}`
    }
  }

  return (
    <div className="rounded-[var(--radius-section)] bg-surface p-6 sm:p-8 border border-separator/80 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-separator/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-[var(--radius-tile)] bg-surface-2 border border-separator/60 flex items-center justify-center shrink-0">
            <BrandLogo name="gmail" size={26} />
          </div>
          <div>
            <h3 className="type-title-2 font-[600] text-label">
              Gmail Subscription Scanner
            </h3>
            <p className="type-caption text-label-2 mt-0.5">
              Read-only scan strictly scoped to receipts and billing keywords.
            </p>
          </div>
        </div>

        {lastScan && (
          <span className="type-caption font-mono text-label-3">
            Last scan:{' '}
            {new Date(lastScan).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-[var(--radius-control)] bg-accent-soft border border-accent/20 text-accent type-caption">
          {error}
        </div>
      )}

      {/* 2-Step Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1: Set up Gmail */}
        <div
          className={`flex flex-col justify-between gap-4 p-5 rounded-[var(--radius-card)] border transition-all ${
            gmailConnected
              ? 'bg-surface border-separator/80'
              : 'bg-surface-2/60 border-separator'
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="type-eyebrow text-[11px] font-semibold text-label-3 uppercase tracking-wider">
                Step 1
              </span>
              {gmailConnected && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/10 text-success text-xs font-semibold">
                  <span className="size-1.5 rounded-full bg-success" />
                  Connected
                </span>
              )}
            </div>
            <h4 className="type-headline font-semibold text-label">
              Set up your Gmail account
            </h4>
            <p className="type-caption text-label-2 leading-relaxed">
              {gmailConnected
                ? 'Read-only authorization active. No emails are ever read, altered, or sent.'
                : 'Grant read-only access to search for purchase receipts and invoices.'}
            </p>
          </div>

          <div>
            {!gmailConnected ? (
              <motion.button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="touch-target flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-accent px-5 type-footnote font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
              >
                <span>{connecting ? 'Connecting…' : 'Set up Gmail account'}</span>
                <span>→</span>
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="type-caption text-label-3 hover:text-label font-medium underline underline-offset-4 cursor-pointer transition-colors"
              >
                Reconnect or switch account
              </button>
            )}
          </div>
        </div>

        {/* Step 2: Scan Gmail Receipts */}
        <div
          className={`flex flex-col justify-between gap-4 p-5 rounded-[var(--radius-card)] border transition-all ${
            !gmailConnected
              ? 'bg-surface-2/30 border-separator/50 opacity-60'
              : 'bg-surface border-separator/80'
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="type-eyebrow text-[11px] font-semibold text-label-3 uppercase tracking-wider">
                Step 2
              </span>
              {scanning && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                  <span className="size-1.5 rounded-full bg-accent animate-ping" />
                  Scanning…
                </span>
              )}
            </div>
            <h4 className="type-headline font-semibold text-label">
              Scan Gmail receipts
            </h4>
            <p className="type-caption text-label-2 leading-relaxed">
              Discovers all recurring subscriptions, amounts, and cadence from
              past invoices.
            </p>
          </div>

          <div>
            <motion.button
              type="button"
              onClick={onScan}
              disabled={!gmailConnected || scanning}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="touch-target flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-inverse text-on-inverse px-5 type-footnote font-semibold shadow-xs hover:bg-inverse/90 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <span>{scanning ? 'Scanning receipts…' : 'Scan Gmail receipts'}</span>
              <span>→</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
