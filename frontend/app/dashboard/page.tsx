'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import ConnectGmail from '@/components/app/ConnectGmail'
import SubscriptionRow, { type Subscription } from '@/components/app/SubscriptionRow'
import AgentStatusBar from '@/components/app/AgentStatusBar'
import MonthlyBleed from '@/components/app/MonthlyBleed'
import OnboardingProgress from '@/components/app/OnboardingProgress'
import InsightsCarousel from '@/components/app/InsightsCarousel'
import RenewalsTimeline from '@/components/app/RenewalsTimeline'
import AgentActivity from '@/components/app/AgentActivity'
import TopNav from '@/components/app/TopNav'
import { useToast } from '@/components/providers/ToastProvider'
import { normalizeSubscription } from '@/lib/normalize'
import { aggregateByCurrency, formatAggregate, type CurrencyMap } from '@/lib/format'
import Link from 'next/link'

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
  const byCurrency = aggregateByCurrency(active, monthlyOf, (s) => s.currency ?? 'USD')
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
  const [scanResult, setScanResult] = useState<{ created: number; updated: number; source: string } | null>(null)
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
      // derive lastScan from most recent detected_at
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
    fetchSubs(user.id).catch(() => {}).finally(() => setLoading(false))
  }, [ready, authenticated, user?.id])

  // Poll every 30s while tab is visible
  useEffect(() => {
    if (!authenticated || !user?.id) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchSubs(user!.id).catch(() => {})
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
        setScanResult({ created: data.created, updated: data.updated, source: 'Gmail' })
        showToast(`Gmail scan complete — ${data.created} subscription${data.created !== 1 ? 's' : ''} found`, 'success')
        const subsRes = await fetch('/api/subscriptions', { headers: { 'x-user-id': user.id } })
        if (subsRes.ok) setSubs(((await subsRes.json()).subscriptions ?? []).map(normalizeSubscription))
      } else {
        showToast(data.error ?? `Gmail scan failed (${res.status})`, 'error')
      }
    } catch {
      showToast('Could not reach server', 'error')
    } finally {
      setScanning(false)
    }
  }

  async function debugScan() {
    if (!user?.id || debugScanning) return
    setDebugScanning(true)
    setDebugOutput('Running scan… (up to 60s)')
    try {
      await fetch('/api/gmail/scan-lock', { method: 'DELETE', headers: { 'x-user-id': user.id } }).catch(() => {})
      const t0 = Date.now()
      const res = await fetch('/api/gmail/scan?debug=1', {
        method: 'POST',
        headers: { 'x-user-id': user.id },
      })
      const data = await res.json()
      const wall = Date.now() - t0
      setDebugOutput(JSON.stringify({ http_status: res.status, wall_ms: wall, ...data }, null, 2))
    } catch (e) {
      setDebugOutput(`Network error: ${(e as Error).message}`)
    } finally {
      setDebugScanning(false)
    }
  }

  async function triggerWalletScan() {
    const address = user?.wallet?.address
    if (!address || walletScanning) return
    setWalletScanning(true)
    setScanResult(null)
    try {
      const res = await fetch('/api/wallet/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user!.id },
        body: JSON.stringify({ address }),
      })
      const data = await res.json()
      if (res.ok) {
        setScanResult({ created: data.created, updated: data.updated, source: 'Wallet' })
        showToast(`Wallet scan complete — ${data.created} subscription${data.created !== 1 ? 's' : ''} found`, 'success')
        const subsRes = await fetch('/api/subscriptions', { headers: { 'x-user-id': user!.id } })
        if (subsRes.ok) setSubs(((await subsRes.json()).subscriptions ?? []).map(normalizeSubscription))
      } else {
        showToast(data.error ?? `Wallet scan failed (${res.status})`, 'error')
      }
    } catch {
      showToast('Could not reach server', 'error')
    } finally {
      setWalletScanning(false)
    }
  }

  async function handleStatusChange(id: string, status: 'active' | 'paused' | 'cancelled') {
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
      <main className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-1 h-1 bg-sam-red rounded-full animate-pulse" />
      </main>
    )
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-6 px-6">
        <h1
          className="text-3xl font-bold text-white text-center"
          style={{ fontFamily: 'var(--font-syne)', letterSpacing: '-0.03em' }}
        >
          SAM
        </h1>
        <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3' }} className="text-sm text-center">
          Connect your wallet to get started
        </p>
        <motion.button
          onClick={login}
          whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
          whileTap={{ scale: 0.98 }}
          className="px-8 py-3 text-sm font-semibold uppercase tracking-widest cursor-pointer"
          style={{
            fontFamily: 'var(--font-geist-sans)',
            background: '#E50914',
            color: '#fff',
            borderRadius: '2px',
            letterSpacing: '0.08em',
          }}
        >
          Connect Wallet
        </motion.button>
      </main>
    )
  }

  const stats = calcStats(subs)
  const activeSubs = subs.filter((s) => s.status === 'active').slice(0, 5)

  return (
    <main className="min-h-screen bg-void">
      <TopNav
        gmailConnected={gmailConnected}
        scanning={scanning}
        walletScanning={walletScanning}
        debugScanning={debugScanning}
        onScanGmail={triggerScan}
        onScanWallet={triggerWalletScan}
        onDebugScan={debugScan}
        actions={
          <>
            {user?.wallet?.address && (
              <motion.button
                onClick={triggerWalletScan}
                disabled={walletScanning}
                whileHover={{ scale: walletScanning ? 1 : 1.02 }}
                whileTap={{ scale: walletScanning ? 1 : 0.98 }}
                className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest cursor-pointer"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  background: 'transparent',
                  color: walletScanning ? '#525252' : '#A3A3A3',
                  border: `1px solid ${walletScanning ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '2px',
                  letterSpacing: '0.08em',
                }}
              >
                {walletScanning ? 'Scanning...' : 'Scan Wallet'}
              </motion.button>
            )}
            {gmailConnected && (
              <motion.button
                onClick={triggerScan}
                disabled={scanning}
                whileHover={{ scale: scanning ? 1 : 1.02 }}
                whileTap={{ scale: scanning ? 1 : 0.98 }}
                className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest cursor-pointer"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  background: 'transparent',
                  color: scanning ? '#525252' : '#E50914',
                  border: `1px solid ${scanning ? 'rgba(255,255,255,0.08)' : 'rgba(229,9,20,0.4)'}`,
                  borderRadius: '2px',
                  letterSpacing: '0.08em',
                }}
              >
                {scanning ? 'Scanning...' : 'Scan Gmail'}
              </motion.button>
            )}
            {process.env.NODE_ENV !== 'production' && (
              <motion.button
                onClick={debugScan}
                disabled={debugScanning}
                whileHover={{ scale: debugScanning ? 1 : 1.02 }}
                whileTap={{ scale: debugScanning ? 1 : 0.98 }}
                className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest cursor-pointer"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  background: 'transparent',
                  color: debugScanning ? '#525252' : '#FACC15',
                  border: `1px solid ${debugScanning ? 'rgba(255,255,255,0.08)' : 'rgba(250,204,21,0.4)'}`,
                  borderRadius: '2px',
                  letterSpacing: '0.08em',
                }}
                title="Run a Gmail scan with full diagnostic output"
              >
                {debugScanning ? 'Debugging...' : 'Debug Scan'}
              </motion.button>
            )}
          </>
        }
      />

      {/* Agent status bar */}
      <AgentStatusBar
        scanning={scanning || walletScanning}
        lastScan={lastScan}
        subCount={subs.filter((s) => s.status === 'active').length}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-10">
        {/* Onboarding progress — only when not all steps done */}
        <OnboardingProgress
          wallet={Boolean(user?.wallet?.address)}
          gmail={gmailConnected}
          firstScan={subs.length > 0}
          policies={hasPolicies}
        />

        {/* Monthly bleed hero */}
        {subs.length > 0 && <MonthlyBleed byCurrency={stats.byCurrency} />}

        {/* Stats row */}
        {subs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-3 gap-2 sm:gap-4"
          >
            {[
              { label: 'Active Subscriptions', value: String(stats.count), alert: false },
              { label: 'High Risk',            value: String(stats.highRisk), alert: stats.highRisk > 0 },
              {
                label: 'Yearly Projection',
                value: formatAggregate(
                  Object.fromEntries(
                    Object.entries(stats.byCurrency).map(([c, v]) => [c, v * 12])
                  )
                ),
                alert: false,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 p-4"
                style={{
                  background: '#141414',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '2px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-dm-mono)',
                    color: stat.alert ? '#E50914' : '#fff',
                    fontSize: '24px',
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    color: '#525252',
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* AI insights carousel */}
        {subs.length > 0 && <InsightsCarousel subs={subs} />}

        {/* Renewals timeline */}
        {subs.length > 0 && <RenewalsTimeline subs={subs} />}

        {/* Gmail connect or subscription list */}
        {!gmailConnected ? (
          <ConnectGmail />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '12px' }}>
              Loading...
            </span>
          </div>
        ) : subs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3' }} className="text-sm">
              No subscriptions detected yet.
            </p>
            <motion.button
              onClick={triggerScan}
              disabled={scanning}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-2.5 text-xs font-semibold uppercase tracking-widest cursor-pointer"
              style={{
                fontFamily: 'var(--font-geist-sans)',
                background: '#E50914',
                color: '#fff',
                borderRadius: '2px',
              }}
            >
              {scanning ? 'Scanning...' : 'Scan Now'}
            </motion.button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  color: '#525252',
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Recent Subscriptions
              </span>
              <Link
                href="/subscriptions"
                style={{ fontFamily: 'var(--font-geist-sans)', color: '#E50914', fontSize: '11px' }}
              >
                View all →
              </Link>
            </div>
            <div className="flex flex-col gap-1.5">
              {activeSubs.map((sub, i) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <SubscriptionRow sub={sub} onStatusChange={handleStatusChange} href={`/subscriptions/${sub.id}`} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Agent activity feed */}
        {subs.length > 0 && <AgentActivity userId={user?.id} />}
      </div>

      {/* Debug scan output modal */}
      {debugOutput !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setDebugOutput(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] flex flex-col"
            style={{
              background: '#0A0A0A',
              border: '1px solid rgba(250,204,21,0.3)',
              borderRadius: '4px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span
                className="text-[11px] font-semibold uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-geist-sans)', color: '#FACC15', letterSpacing: '0.12em' }}
              >
                Debug Scan Output
              </span>
              <div className="flex gap-2">
                <button
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
                  className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest cursor-pointer"
                  style={{
                    background: 'transparent',
                    color: '#A3A3A3',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '2px',
                    letterSpacing: '0.1em',
                  }}
                >
                  Copy
                </button>
                <button
                  onClick={() => setDebugOutput(null)}
                  className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest cursor-pointer"
                  style={{
                    background: 'transparent',
                    color: '#A3A3A3',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '2px',
                    letterSpacing: '0.1em',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <pre
              className="px-4 py-3 overflow-auto flex-1 text-[11px] leading-relaxed"
              style={{
                fontFamily: 'var(--font-dm-mono)',
                color: '#D4D4D4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {debugOutput}
            </pre>
          </div>
        </div>
      )}
    </main>
  )
}
