'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrandLogo from '@/components/ui/BrandLogo'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/providers/ToastProvider'

interface TelegramAlertsCardProps {
  userId?: string
  compact?: boolean
  // Draw nothing until linked; TelegramLinkBar handles the unlinked prompt.
  hideWhenUnlinked?: boolean
  onStatusChange?: (linked: boolean) => void
}

type TelegramStatus = {
  configured: boolean
  linked: boolean
  chat_id: string | null
  halted: boolean
  halt_reason: string
  bot_username: string
}

export default function TelegramAlertsCard({
  userId,
  compact = false,
  hideWhenUnlinked = false,
  onStatusChange,
}: TelegramAlertsCardProps) {
  const { showToast } = useToast()
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [linkData, setLinkData] = useState<{
    url: string
    code: string
    botUsername: string
  } | null>(null)
  const [sendingTest, setSendingTest] = useState(false)
  const [togglingHalt, setTogglingHalt] = useState(false)

  async function fetchStatus() {
    if (!userId) {
      setLoading(false)
      return
    }
    try {
      const res = await apiFetch('/api/telegram/status')
      if (res.ok) {
        const data: TelegramStatus = await res.json()
        setStatus(data)
        onStatusChange?.(data.linked)
      }
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [userId])

  // Poll while user is in linking flow
  useEffect(() => {
    if (!linkData || status?.linked) return
    const interval = setInterval(async () => {
      if (!userId) return
      try {
        const res = await apiFetch('/api/telegram/status')
        if (res.ok) {
          const data: TelegramStatus = await res.json()
          if (data.linked) {
            setStatus(data)
            setLinkData(null)
            showToast('Telegram successfully connected!', 'success')
            onStatusChange?.(true)
            clearInterval(interval)
          }
        }
      } catch {}
    }, 2500)

    return () => clearInterval(interval)
  }, [linkData, status?.linked, userId])

  async function handleStartLink() {
    if (!userId || linking) return
    setLinking(true)
    try {
      const res = await apiFetch('/api/telegram/link-code', {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setLinkData(data)
        if (typeof window !== 'undefined' && data.url) {
          window.open(data.url, '_blank', 'noopener,noreferrer')
        }
      } else {
        showToast('Could not start Telegram linking. Try again.', 'error')
      }
    } catch {
      showToast('Network error while linking Telegram.', 'error')
    } finally {
      setLinking(false)
    }
  }

  async function handleSendTestNotice() {
    if (!userId || sendingTest) return
    setSendingTest(true)
    try {
      const res = await apiFetch('/api/telegram/test-notice', {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Interactive test renewal alert sent to Telegram!', 'success')
      } else {
        showToast(data.error || 'Failed to send test alert.', 'error')
      }
    } catch {
      showToast('Network error sending test alert.', 'error')
    } finally {
      setSendingTest(false)
    }
  }

  async function handleToggleHalt() {
    if (!userId || togglingHalt || !status) return
    setTogglingHalt(true)
    const endpoint = status.halted
      ? '/api/telegram/resume'
      : '/api/telegram/halt'
    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
      })
      if (res.ok) {
        const nextHalted = !status.halted
        setStatus((prev) => (prev ? { ...prev, halted: nextHalted } : null))
        showToast(
          nextHalted
            ? 'Cancellations paused. Send /resume anytime.'
            : 'Cancellations resumed.',
          'info'
        )
      }
    } catch {
      showToast('Failed to update halt state.', 'error')
    } finally {
      setTogglingHalt(false)
    }
  }

  async function handleUnlink() {
    if (!userId) return
    try {
      const res = await apiFetch('/api/telegram/unlink', {
        method: 'POST',
      })
      if (res.ok) {
        setStatus((prev) =>
          prev ? { ...prev, linked: false, chat_id: null } : null
        )
        showToast('Telegram unlinked.', 'info')
        onStatusChange?.(false)
      }
    } catch {
      showToast('Failed to unlink Telegram.', 'error')
    }
  }

  if (loading || !status?.configured) return null
  if (hideWhenUnlinked && !status.linked) return null

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 rounded-[var(--radius-card)] bg-surface border border-separator/70 text-left">
        <div className="flex items-center gap-2.5">
          <BrandLogo name="telegram" size={24} />
          <div>
            <p className="type-footnote font-semibold text-label">
              {status.linked ? 'Telegram Alerts Active' : 'Telegram Alerts'}
            </p>
            <p className="type-caption text-label-3">
              {status.linked
                ? status.halted
                  ? 'Paused via /stop'
                  : 'Receiving 120h, 72h & 48h notices'
                : 'Get alerts before each charge'}
            </p>
          </div>
        </div>

        {status.linked ? (
          <button
            type="button"
            onClick={handleSendTestNotice}
            disabled={sendingTest}
            className="touch-target px-3 py-1.5 rounded-full border border-separator bg-surface text-label type-caption font-semibold hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            {sendingTest ? 'Sending…' : 'Test Alert'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartLink}
            disabled={linking}
            className="touch-target px-3 py-1.5 rounded-full bg-accent text-on-accent type-caption font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {linking ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-5 rounded-[var(--radius-section)] bg-surface p-6 sm:p-8 border border-separator/70 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-separator/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <BrandLogo name="telegram" size={36} />
            {status.linked && (
              <span className="absolute -bottom-0.5 -right-0.5 flex size-3 rounded-full bg-success ring-2 ring-surface" />
            )}
          </div>
          <div>
            <h3 className="type-title-2 font-[600] text-label">
              Renewal Alerts & One-Tap Control
            </h3>
            <p className="type-callout text-label-2 text-sm">
              SHAMAR messages you before renewals so you can keep or cancel
              right from your phone.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {status.linked ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                status.halted
                  ? 'bg-warning/10 text-warning border border-warning/30'
                  : 'bg-success/10 text-success border border-success/30'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${status.halted ? 'bg-warning' : 'bg-success'}`}
              />
              {status.halted ? 'Paused' : 'Active Alerts'}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-label-3 border border-separator">
              Not Connected
            </span>
          )}
        </div>
      </div>

      {!status.linked ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
          <div className="flex flex-col gap-2 max-w-lg">
            <p className="type-footnote text-label font-medium">
              Why connect Telegram?
            </p>
            <ul className="flex flex-col gap-1.5 text-xs text-label-2">
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-accent" />
                Alerts sent at 120h, 72h, and 48h before any card is billed
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-accent" />
                Tap <strong>Cancel subscription</strong> or{' '}
                <strong>Keep subscription</strong> in chat
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-accent" />
                Send <strong>stop</strong> anytime to pause all agent actions
                immediately
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
            {!linkData ? (
              <button
                type="button"
                onClick={handleStartLink}
                disabled={linking}
                className="touch-target flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-accent px-6 type-footnote font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
              >
                <BrandLogo name="telegram" size={20} />
                <span>
                  {linking ? 'Opening Telegram…' : 'Connect Telegram Bot'}
                </span>
                <span>→</span>
              </button>
            ) : (
              <div className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-4 border border-separator/80 text-center w-full sm:w-80">
                <p className="type-caption text-label font-semibold">
                  Waiting for you in Telegram…
                </p>
                <p className="type-caption text-label-3 text-[11px] leading-snug">
                  Click the button below or send{' '}
                  <code className="rounded bg-surface px-1 py-0.5 font-mono text-accent font-semibold">
                    /start link_{linkData.code}
                  </code>{' '}
                  to @{linkData.botUsername}
                </p>
                <a
                  href={linkData.url}
                  target="_blank"
                  rel="noreferrer"
                  className="touch-target inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full bg-accent px-4 type-caption font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors"
                >
                  <span>Open @{linkData.botUsername}</span>
                  <span>↗</span>
                </a>
              </div>
            )}
            <span className="text-[11px] text-label-3">
              Opens @{status.bot_username} directly in Telegram
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-1">
          <div className="flex flex-col gap-1 text-left w-full sm:w-auto">
            <p className="type-footnote text-label font-medium flex items-center gap-2">
              <span>Connected to</span>
              <code className="text-accent font-mono font-semibold">
                @{status.bot_username}
              </code>
            </p>
            <p className="type-caption text-label-3">
              Chat ID:{' '}
              <span className="font-mono">{status.chat_id || 'Active'}</span> ·
              Reply with <span className="font-mono text-label-2">status</span>{' '}
              to view your active subscriptions
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto justify-end">
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSendTestNotice}
                disabled={sendingTest}
                className="touch-target min-h-[40px] px-3 sm:px-4 rounded-full border border-separator bg-surface text-label type-footnote font-semibold hover:bg-surface-2 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer text-center"
              >
                {sendingTest ? 'Sending Alert…' : 'Send Test Alert'}
              </button>

              <button
                type="button"
                onClick={handleToggleHalt}
                disabled={togglingHalt}
                className={`touch-target min-h-[40px] px-3 sm:px-4 rounded-full border type-footnote font-semibold transition-colors disabled:opacity-50 cursor-pointer text-center ${
                  status.halted
                    ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
                    : 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
                }`}
              >
                {togglingHalt
                  ? 'Updating…'
                  : status.halted
                    ? 'Resume Agent'
                    : 'Pause Agent'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleUnlink}
              className="touch-target text-label-3 hover:text-danger type-caption px-2 py-1 transition-colors cursor-pointer text-center"
              title="Unlink Telegram"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
