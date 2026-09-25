'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import GmailSetupCard from '@/components/app/GmailSetupCard'
import SubscriptionSkeleton from '@/components/app/SubscriptionSkeleton'
import SubscriptionRow, {
  type Subscription,
} from '@/components/app/SubscriptionRow'
import AgentStatusBar from '@/components/app/AgentStatusBar'
import MonthlyBleed from '@/components/app/MonthlyBleed'
import OnboardingProgress from '@/components/app/OnboardingProgress'
import InsightsCarousel from '@/components/app/InsightsCarousel'
import RenewalsTimeline from '@/components/app/RenewalsTimeline'
import AgentActivity from '@/components/app/AgentActivity'
import TelegramAlertsCard from '@/components/app/TelegramAlertsCard'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'
import Logo from '@/components/ui/Logo'
import { useToast } from '@/components/providers/ToastProvider'
import { normalizeSubscription } from '@/lib/normalize'
import {
  aggregateByCurrency,
  formatAggregate,
  type CurrencyMap,
} from '@/lib/format'

import { apiFetch } from '@/lib/api'

function monthlyOf(s: Subscription): number {
  if (s.cadence === 'yearly') return s.amount / 12
  if (s.cadence === 'weekly') return s.amount * 4.33
  if (s.cadence === 'daily') return s.amount * 30
  return s.amount
}

export default function Dashboard() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  )
}

type SummaryStats = {
  byCurrency: CurrencyMap
  count: number
  highRisk: number
}

function calcStats(subs: Subscription[]): SummaryStats {
  const active = subs.filter((s) => s.status === 'active')
  const byCurrency = aggregateByCurrency(
    active,
    monthlyOf,
    (s) => s.currency ?? 'USD'
  )
  const highRisk = active.filter((s) => (s.confidence ?? 0) >= 60).length
  return { byCurrency, count: active.length, highRisk }
}

function DashboardInner() {
  const { ready, authenticated, user, login } = usePrivy()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()

  const [gmailConnected, setGmailConnected] = useState(false)
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [showGmailSetup, setShowGmailSetup] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [hasPolicies, setHasPolicies] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [walletScanning, setWalletScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{
    created: number
    updated: number
    source: string
  } | null>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [readyTimeout, setReadyTimeout] = useState(false)
  const effectiveUserId = user?.id ?? null
  const isUserAuthenticated = authenticated

  useEffect(() => {
    const t = setTimeout(() => setReadyTimeout(true), 2500)
    return () => clearTimeout(t)
  }, [])

  async function fetchSubs(uid: string) {
    try {
      const [statusRes, subsRes, polRes, tgRes] = await Promise.all([
        apiFetch('/api/gmail/status').catch(() => null),
        apiFetch('/api/subscriptions').catch(() => null),
        apiFetch('/api/policies').catch(() => null),
        apiFetch('/api/telegram/status').catch(() => null),
      ])

      if (statusRes?.ok) {
        try {
          const statusData = await statusRes.json()
          setGmailConnected(statusData.connected ?? false)
        } catch {}
      }

      if (tgRes?.ok) {
        try {
          const tgData = await tgRes.json()
          setTelegramLinked(tgData.linked ?? false)
        } catch {}
      }

      if (subsRes?.ok) {
        try {
          const raw = ((await subsRes.json()).subscriptions ??
            []) as Subscription[]
          const list = raw.map(normalizeSubscription)
          setSubs(list)
          const latest = list
            .map((s) => s.detected_at)
            .filter(Boolean)
            .sort()
            .pop()
          if (latest) setLastScan(latest as string)
        } catch {}
      }

      if (polRes?.ok) {
        try {
          const pols = (await polRes.json()).policies ?? []
          setHasPolicies(pols.length > 0)
        } catch {}
      }
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (!ready || !isUserAuthenticated || !effectiveUserId) {
      if (ready && !isUserAuthenticated) setLoading(false)
      return
    }
    setLoading(true)
    fetchSubs(effectiveUserId)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ready, isUserAuthenticated, effectiveUserId])

  // Poll every 30s while tab is visible
  useEffect(() => {
    if (!isUserAuthenticated || !effectiveUserId) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible')
        fetchSubs(effectiveUserId).catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [isUserAuthenticated, effectiveUserId])

  // Handle OAuth redirect params
  useEffect(() => {
    if (searchParams.get('connected') === 'gmail') {
      setGmailConnected(true)
      router.replace('/dashboard')
      triggerScan()
      return
    }

    const errorParam = searchParams.get('error')
    const detailParam = searchParams.get('detail')
    if (errorParam) {
      router.replace('/dashboard')
      if (errorParam === 'access_denied') {
        showToast(
          'Google access was not granted. On the Google warning screen, click "Advanced" then "Go to SHAMAR" to allow receipt scanning.',
          'error'
        )
      } else if (errorParam === 'no_refresh_token') {
        showToast(
          'Google did not return an offline access token. Please disconnect and connect again.',
          'error'
        )
      } else if (errorParam === 'oauth_expired') {
        showToast(
          'Google sign-in session expired. Please try connecting again.',
          'error'
        )
      } else if (detailParam) {
        showToast(`Google sign-in failed: ${detailParam}`, 'error')
      } else {
        showToast(
          'Google connection could not be completed. Please try again.',
          'error'
        )
      }
    }
  }, [searchParams, router, showToast])

  async function triggerScan(opts?: { reset?: boolean; clear?: boolean }) {
    if (!effectiveUserId || scanning) return
    setScanning(true)
    setScanResult(null)
    try {
      const params = new URLSearchParams()
      if (opts?.reset ?? true) params.set('reset', '1')
      if (opts?.clear) params.set('clear', '1')
      const queryString = params.toString() ? `?${params.toString()}` : ''
      const res = await apiFetch(`/api/gmail/scan${queryString}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        setScanResult({
          created: data.created,
          updated: data.updated,
          source: 'Gmail',
        })
        setLastScan(new Date().toISOString())
        showToast(
          `Scan complete: ${data.created} found, ${data.updated} updated`,
          'success'
        )
        await fetchSubs(effectiveUserId)
      } else {
        showToast(data.error ?? 'Scan failed', 'error')
      }
    } catch {
      showToast('Scan request failed', 'error')
    } finally {
      setScanning(false)
    }
  }

  async function triggerWalletScan() {
    if (!effectiveUserId || walletScanning) return
    setWalletScanning(true)
    setScanResult(null)
    try {
      const res = await apiFetch('/api/wallet/scan', {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        setScanResult({
          created: data.created,
          updated: data.updated,
          source: 'Wallet',
        })
        setLastScan(new Date().toISOString())
        showToast(
          `Wallet scan complete: ${data.created} found, ${data.updated} updated`,
          'success'
        )
        await fetchSubs(effectiveUserId)
      } else {
        showToast(data.error ?? 'Wallet scan failed', 'error')
      }
    } catch {
      showToast('Wallet scan request failed', 'error')
    } finally {
      setWalletScanning(false)
    }
  }

  async function handleStatusChange(
    id: string,
    status: 'active' | 'paused' | 'cancelled'
  ) {
    if (!effectiveUserId) return
    try {
      await apiFetch(`/api/subscriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
    } catch {
      // offline
    }
  }

  if (!ready && !readyTimeout) {
    return (
      <main className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-3">
        <Logo variant="mark" size={40} />
        <span className="type-caption text-label-3 animate-pulse">
          Loading dashboard…
        </span>
      </main>
    )
  }

  if (!isUserAuthenticated) {
    return (
      <main className="min-h-screen bg-canvas flex flex-col justify-between p-4 sm:p-6 md:p-8">
        <header className="mx-auto w-full max-w-7xl flex items-center justify-between py-2">
          <Logo variant="lockup" size={24} />
        </header>

        <div className="mx-auto w-full max-w-md my-auto flex flex-col items-center gap-6 rounded-[var(--radius-section)] bg-surface p-8 sm:p-10 border border-separator/80 shadow-md text-center">
          <Logo variant="mark" size={48} />
          <div className="flex flex-col gap-2">
            <h1 className="type-title-1 font-[600] text-label tracking-tight">
              Sign in to SHAMAR
            </h1>
            <p className="type-callout text-label-2">
              Connect your wallet or email to manage, monitor, and protect your
              subscriptions.
            </p>
          </div>

          <motion.button
            type="button"
            onClick={login}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="touch-target flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent px-6 type-headline font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Connect Wallet
          </motion.button>
        </div>

        <AppFooter />
      </main>
    )
  }

  const stats = calcStats(subs)
  const activeSubs = subs.filter((s) => s.status === 'active').slice(0, 6)

  return (
    <main className="min-h-screen bg-canvas flex flex-col justify-between">
      <TopNav
        gmailConnected={gmailConnected}
        scanning={scanning}
        walletScanning={walletScanning}
        onScanGmail={() => triggerScan({ reset: true, clear: true })}
        onScanWallet={triggerWalletScan}
        actions={
          <div className="flex items-center gap-2">
            {gmailConnected && (
              <button
                type="button"
                onClick={() => triggerScan({ reset: true, clear: true })}
                disabled={scanning}
                className="touch-target min-h-[38px] px-4 rounded-full bg-accent text-on-accent type-footnote font-semibold shadow-xs hover:bg-accent-hover transition-colors disabled:opacity-40"
              >
                {scanning ? 'Scanning Receipts…' : 'Scan Receipts'}
              </button>
            )}
          </div>
        }
      />

      {/* Status Bar */}
      <AgentStatusBar
        scanning={scanning || walletScanning}
        lastScan={lastScan}
        subCount={subs.filter((s) => s.status === 'active').length}
        userId={effectiveUserId ?? undefined}
      />

      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 md:px-8 py-8 flex flex-col gap-8">
        {/* Onboarding progress when incomplete */}
        <OnboardingProgress
          wallet={Boolean(user?.wallet?.address)}
          gmail={gmailConnected}
          firstScan={subs.length > 0}
          telegram={telegramLinked}
        />

        {/* Dashboard Hero Bento */}
        {subs.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Primary monthly bleed card */}
            <div className="lg:col-span-2 rounded-[var(--radius-section)] bg-surface p-5 sm:p-6 border border-separator/70 shadow-xs flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between border-b border-separator/50 pb-4">
                <p className="type-eyebrow inline-flex items-center gap-2 text-label font-semibold">
                  <span className="size-2 rounded-full bg-accent" />
                  Monthly Outflow
                </p>
                <span className="type-caption font-semibold text-label-3">
                  Updated{' '}
                  {lastScan
                    ? new Date(lastScan).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'recently'}
                </span>
              </div>

              <MonthlyBleed byCurrency={stats.byCurrency} />
            </div>

            {/* Quick Stats Bento */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-3">
              <div className="rounded-[var(--radius-card)] bg-surface px-4 py-3 border border-separator/70 shadow-2xs flex flex-col justify-between gap-1">
                <span className="type-caption text-label-3 uppercase tracking-wider font-semibold text-[11px] sm:text-xs">
                  Active Subs
                </span>
                <p className="type-display text-2xl font-[600] text-label tabular">
                  {stats.count}
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] bg-surface px-4 py-3 border border-separator/70 shadow-2xs flex flex-col justify-between gap-1">
                <span className="type-caption text-label-3 uppercase tracking-wider font-semibold text-[11px] sm:text-xs">
                  Blast Radius
                </span>
                <p
                  className={`type-display text-2xl font-[600] tabular ${stats.highRisk > 0 ? 'text-accent-text' : 'text-label'}`}
                >
                  {stats.highRisk}
                </p>
                <p className="type-caption text-label-2 text-[11px] sm:text-xs truncate">
                  {stats.highRisk > 0
                    ? 'High impact protected'
                    : 'Safe to manage'}
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1 lg:col-span-1 rounded-[var(--radius-card)] bg-surface px-4 py-3 border border-separator/70 shadow-2xs flex flex-col justify-between gap-1">
                <span className="type-caption text-label-3 uppercase tracking-wider font-semibold text-[11px] sm:text-xs">
                  Yearly Projection
                </span>
                <p className="type-display text-xl font-[600] text-label tabular">
                  {formatAggregate(
                    Object.fromEntries(
                      Object.entries(stats.byCurrency).map(([c, v]) => [
                        c,
                        v * 12,
                      ])
                    )
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Gmail Setup & Discovery 2-Step Card */}
        {!gmailConnected || showGmailSetup ? (
          <GmailSetupCard
            gmailConnected={gmailConnected}
            scanning={scanning}
            onScan={() => triggerScan({ reset: true, clear: true })}
            lastScan={lastScan}
          />
        ) : (
          <div className="-my-4 flex items-center gap-2 type-footnote text-label-2">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            <span>Gmail connected</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => setShowGmailSetup(true)}
              className="touch-target inline-flex items-center font-semibold text-label underline underline-offset-4 hover:text-accent-text"
            >
              Manage Gmail
            </button>
          </div>
        )}

        {/* Subscriptions List or Optimistic Shimmer Skeleton */}
        {scanning || loading ? (
          <SubscriptionSkeleton
            scanning={scanning}
            count={subs.length > 0 ? subs.length : 3}
          />
        ) : subs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center rounded-[var(--radius-card)] bg-surface p-8 border border-separator/70 shadow-xs">
            <p className="type-callout text-label-2">
              No subscriptions detected in your receipts yet.
            </p>
            <button
              type="button"
              onClick={() => triggerScan({ reset: true, clear: true })}
              disabled={scanning}
              className="touch-target rounded-full bg-accent px-6 py-2.5 type-footnote font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors"
            >
              Scan Receipts Now
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-[var(--radius-section)] bg-surface p-6 sm:p-8 border border-separator/70 shadow-xs">
            <div className="flex items-center justify-between border-b border-separator/50 pb-4">
              <div className="flex items-center gap-2">
                <h3 className="type-title-2 font-[600] text-label">
                  Subscriptions
                </h3>
                <span className="type-caption rounded-full bg-surface-2 px-2.5 py-0.5 font-bold text-label-2">
                  {subs.filter((s) => s.status === 'active').length}
                </span>
              </div>

              <Link
                href="/subscriptions"
                className="type-footnote font-semibold text-accent-text hover:underline"
              >
                View all ({subs.length}) →
              </Link>
            </div>

            <div className="flex flex-col gap-2.5">
              {activeSubs.map((sub) => (
                <SubscriptionRow
                  key={sub.id}
                  sub={sub}
                  onStatusChange={handleStatusChange}
                  href={`/subscriptions/${sub.id}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Telegram Renewal Alerts & One-Tap Control */}
        <TelegramAlertsCard
          userId={effectiveUserId ?? undefined}
          hideWhenUnlinked
          onStatusChange={setTelegramLinked}
        />

        {/* Next 14 Days Upcoming Renewals Timeline */}
        {subs.length > 0 && <RenewalsTimeline subs={subs} />}

        {/* AI Insights Carousel */}
        {subs.length > 0 &&
          (showInsights ? (
            <InsightsCarousel subs={subs} />
          ) : (
            <button
              type="button"
              onClick={() => setShowInsights(true)}
              className="touch-target -my-4 inline-flex items-center self-start type-footnote font-semibold text-label underline underline-offset-4 hover:text-accent-text"
            >
              Show insights
            </button>
          ))}

        {/* The Black Slab: Agent Activity Dispatch Ledger */}
        {subs.length > 0 && (
          <AgentActivity userId={effectiveUserId ?? undefined} />
        )}

        {/* Account & Agent Settings Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-[var(--radius-card)] bg-surface border border-separator/80 text-label">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-accent" />
            <div>
              <p className="type-footnote font-semibold text-label">
                Agent Governance & Account Controls
              </p>
              <p className="type-caption text-label-3">
                Configure Base session keys, link Telegram alerts, or permanently reset and delete account data.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/agent"
              className="touch-target px-4 py-1.5 rounded-full border border-separator bg-surface-2 hover:bg-surface text-label type-caption font-semibold transition-colors"
            >
              Open Agent Page →
            </Link>
            <Link
              href="/agent#danger-zone"
              className="touch-target px-4 py-1.5 rounded-full border border-danger/30 text-danger hover:bg-danger/10 type-caption font-semibold transition-colors"
            >
              Delete Account
            </Link>
          </div>
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
