'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import ConnectGmail from '@/components/app/ConnectGmail'
import SubscriptionRow, {
  type Subscription,
} from '@/components/app/SubscriptionRow'
import AgentStatusBar from '@/components/app/AgentStatusBar'
import MonthlyBleed from '@/components/app/MonthlyBleed'
import OnboardingProgress from '@/components/app/OnboardingProgress'
import InsightsCarousel from '@/components/app/InsightsCarousel'
import RenewalsTimeline from '@/components/app/RenewalsTimeline'
import AgentActivity from '@/components/app/AgentActivity'
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
  const [debugScanning, setDebugScanning] = useState(false)
  const [debugOutput, setDebugOutput] = useState<string | null>(null)

  async function fetchSubs(uid: string) {
    const [statusRes, subsRes, polRes] = await Promise.all([
      fetch(`/api/gmail/status?user_id=${uid}`),
      fetch('/api/subscriptions', { headers: { 'x-user-id': uid } }),
      fetch('/api/policies', { headers: { 'x-user-id': uid } }),
    ])
    const statusData = await statusRes.json()
    setGmailConnected(statusData.connected ?? false)
    if (subsRes.ok) {
      const raw = ((await subsRes.json()).subscriptions ?? []) as Subscription[]
      const list = raw.map(normalizeSubscription)
      setSubs(list)
      const latest = list
        .map((s) => s.detected_at)
        .filter(Boolean)
        .sort()
        .pop()
      if (latest) setLastScan(latest as string)
    }
    if (polRes.ok) {
      const pols = (await polRes.json()).policies ?? []
      setHasPolicies(pols.length > 0)
    }
  }

  // Initial load
  useEffect(() => {
    if (!ready || !authenticated || !user?.id) return
    setLoading(true)
    fetchSubs(user.id)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ready, authenticated, user?.id])

  // Poll every 30s while tab is visible
  useEffect(() => {
    if (!authenticated || !user?.id) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible')
        fetchSubs(user!.id).catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [authenticated, user?.id])

  // Handle OAuth redirect params
  useEffect(() => {
    if (searchParams.get('connected') === 'gmail') {
      setGmailConnected(true)
      router.replace('/dashboard')
      triggerScan()
    }
  }, [searchParams])

  async function triggerScan() {
    if (!user?.id || scanning) return
    setScanning(true)
    setScanResult(null)
    try {
      const res = await fetch('/api/gmail/scan', {
        method: 'POST',
        headers: { 'x-user-id': user.id },
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
        await fetchSubs(user.id)
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
    if (!user?.id || walletScanning) return
    setWalletScanning(true)
    setScanResult(null)
    try {
      const res = await fetch('/api/wallet/scan', {
        method: 'POST',
        headers: { 'x-user-id': user.id },
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
        await fetchSubs(user.id)
      } else {
        showToast(data.error ?? 'Wallet scan failed', 'error')
      }
    } catch {
      showToast('Wallet scan request failed', 'error')
    } finally {
      setWalletScanning(false)
    }
  }

  async function debugScan() {
    if (!user?.id || debugScanning) return
    setDebugScanning(true)
    setDebugOutput(null)
    try {
      const res = await fetch('/api/gmail/scan/debug', {
        method: 'POST',
        headers: { 'x-user-id': user.id },
      })
      const text = await res.text()
      try {
        const json = JSON.parse(text)
        setDebugOutput(JSON.stringify(json, null, 2))
      } catch {
        setDebugOutput(text)
      }
      await fetchSubs(user.id)
    } catch (e) {
      setDebugOutput(String(e))
    } finally {
      setDebugScanning(false)
    }
  }

  async function handleStatusChange(
    id: string,
    status: 'active' | 'paused' | 'cancelled'
  ) {
    if (!user?.id) return
    try {
      await fetch(`/api/subscriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ status }),
      })
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
    } catch {
      // offline
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="size-2 rounded-full bg-accent animate-pulse" />
      </main>
    )
  }

  if (!authenticated) {
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
            className="touch-target flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent px-6 type-headline font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors"
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
        debugScanning={debugScanning}
        onScanGmail={triggerScan}
        onScanWallet={triggerWalletScan}
        onDebugScan={debugScan}
        actions={
          <div className="flex items-center gap-2">
            {user?.wallet?.address && (
              <button
                type="button"
                onClick={triggerWalletScan}
                disabled={walletScanning}
                className="touch-target min-h-[38px] px-3.5 rounded-full border border-separator bg-surface text-label type-footnote font-semibold hover:bg-surface-2 transition-colors disabled:opacity-40"
              >
                {walletScanning ? 'Scanning…' : 'Scan Wallet'}
              </button>
            )}
            {gmailConnected && (
              <button
                type="button"
                onClick={triggerScan}
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
        userId={user?.id}
      />

      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 md:px-8 py-8 flex flex-col gap-8">
        {/* Onboarding progress when incomplete */}
        <OnboardingProgress
          wallet={Boolean(user?.wallet?.address)}
          gmail={gmailConnected}
          firstScan={subs.length > 0}
          policies={hasPolicies}
        />

        {/* Dashboard Hero Bento */}
        {subs.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Primary monthly bleed card */}
            <div className="lg:col-span-2 rounded-[var(--radius-section)] bg-surface p-6 sm:p-8 border border-separator/70 shadow-xs flex flex-col justify-between gap-6">
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

            {/* Quick Stats Column */}
            <div className="flex flex-col gap-4">
              <div className="flex-1 rounded-[var(--radius-card)] bg-surface p-5 border border-separator/70 shadow-2xs flex flex-col justify-between">
                <span className="type-caption text-label-3 uppercase tracking-wider font-semibold">
                  Active Subscriptions
                </span>
                <p className="type-display text-3xl font-[600] text-label tabular">
                  {stats.count}
                </p>
                <p className="type-caption text-label-2">
                  Recognized recurring services
                </p>
              </div>

              <div className="flex-1 rounded-[var(--radius-card)] bg-surface p-5 border border-separator/70 shadow-2xs flex flex-col justify-between">
                <span className="type-caption text-label-3 uppercase tracking-wider font-semibold">
                  Blast Radius Alerts
                </span>
                <p
                  className={`type-display text-3xl font-[600] tabular ${stats.highRisk > 0 ? 'text-accent-text' : 'text-label'}`}
                >
                  {stats.highRisk}
                </p>
                <p className="type-caption text-label-2">
                  {stats.highRisk > 0
                    ? 'High impact tools protected'
                    : 'Safe to manage'}
                </p>
              </div>

              <div className="flex-1 rounded-[var(--radius-card)] bg-surface p-5 border border-separator/70 shadow-2xs flex flex-col justify-between">
                <span className="type-caption text-label-3 uppercase tracking-wider font-semibold">
                  Yearly Projection
                </span>
                <p className="type-display text-2xl font-[600] text-label tabular">
                  {formatAggregate(
                    Object.fromEntries(
                      Object.entries(stats.byCurrency).map(([c, v]) => [
                        c,
                        v * 12,
                      ])
                    )
                  )}
                </p>
                <p className="type-caption text-label-2">
                  Estimated 12-month commitment
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Insights & Timeline */}
        {subs.length > 0 && <InsightsCarousel subs={subs} />}
        {subs.length > 0 && <RenewalsTimeline subs={subs} />}

        {/* Subscriptions List or Connect Card */}
        {!gmailConnected ? (
          <ConnectGmail />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="type-caption font-semibold text-label-3">
              Scanning your receipts…
            </span>
          </div>
        ) : subs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center rounded-[var(--radius-card)] bg-surface p-8 border border-separator/70 shadow-xs">
            <p className="type-callout text-label-2">
              No subscriptions detected in your receipts yet.
            </p>
            <button
              type="button"
              onClick={triggerScan}
              disabled={scanning}
              className="touch-target rounded-full bg-accent px-6 py-2.5 type-footnote font-semibold text-on-accent shadow-xs hover:bg-accent-hover transition-colors"
            >
              {scanning ? 'Scanning…' : 'Scan Receipts Now'}
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

        {/* The Black Slab: Agent Activity Dispatch Ledger */}
        {subs.length > 0 && <AgentActivity userId={user?.id} />}
      </div>

      {/* Debug scan output modal */}
      {debugOutput !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setDebugOutput(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[var(--radius-card)] bg-surface p-6 shadow-2xl border border-separator"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-separator">
              <span className="type-headline font-semibold text-label">
                Diagnostic Scan Output
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (debugOutput) {
                      try {
                        await navigator.clipboard.writeText(debugOutput)
                        showToast('Copied to clipboard', 'success')
                      } catch {
                        showToast('Copy failed', 'error')
                      }
                    }
                  }}
                  className="type-caption touch-target min-h-[36px] px-3 rounded-full border border-separator bg-surface text-label font-semibold hover:bg-surface-2"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => setDebugOutput(null)}
                  className="type-caption touch-target min-h-[36px] px-3 rounded-full bg-surface-2 text-label font-semibold hover:bg-surface"
                >
                  Close
                </button>
              </div>
            </div>
            <pre className="mt-3 p-3 overflow-auto flex-1 text-xs font-mono rounded-[var(--radius-tile)] bg-surface-2 text-label-2 leading-relaxed">
              {debugOutput}
            </pre>
          </div>
        </div>
      )}

      <AppFooter />
    </main>
  )
}
