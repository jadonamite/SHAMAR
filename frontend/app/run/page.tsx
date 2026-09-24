'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import AgentStateBadge, {
  type AgentStateKind,
} from '@/components/app/AgentStateBadge'
import EmailTierNotice from '@/components/app/EmailTierNotice'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'
import { apiFetch } from '@/lib/api'

type BlastRadius = {
  data_loss: string
  access_loss: string
  repurchase: string
  irreversible: boolean
  notes: string[]
}

type Decision = {
  subscription_id: string
  merchant: string
  action: 'cancel' | 'pause' | 'remind' | 'keep'
  confidence: number
  rationale: string
  blast_radius: BlastRadius
  savings_usd_monthly: number
  reasoned_by: 'model' | 'fallback'
}

type Dispatch = {
  subscription_id: string
  merchant: string
  status: string
  recipient: string | null
  reason: string
  reversible: boolean
  signature?: string
}

type CalendarWrite = {
  merchant: string
  date: string
  status: string
  reason?: string
}

type RunResult = {
  mode: string
  authorization: {
    granted: boolean
    checked: boolean
    reason: string
    wallet: string | null
    contract: string
  }
  control: { halted: boolean; source: string; reason: string }
  calendar_connected: boolean
  calendar_writes: CalendarWrite[]
  reasoned: number
  fell_back: number
  proposed_cancellations: number
  dispatched: number
  blocked: number
  duplicates_prevented: number
  monthly_savings_usd: number
  elapsed_ms: number
  decisions: Decision[]
  dispatches: Dispatch[]
}

const ACTION_BADGES: Record<string, { badgeClass: string; label: string }> = {
  cancel: {
    badgeClass: 'text-accent bg-accent-soft border-accent/30',
    label: 'Cancel',
  },
  pause: {
    badgeClass: 'text-warning bg-warning/10 border-warning/30',
    label: 'Pause',
  },
  remind: {
    badgeClass: 'text-label bg-surface-2 border-separator',
    label: 'Remind',
  },
  keep: {
    badgeClass: 'text-success bg-success/10 border-success/30',
    label: 'Keep',
  },
}

function IntegrationBadge({
  name,
  live,
  detail,
}: {
  name: string
  live: boolean
  detail?: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono tracking-wide border transition-colors ${
        live
          ? 'bg-success/10 border-success/30 text-success'
          : 'bg-surface-2 border-separator text-label-3'
      }`}
      title={detail}
    >
      <span
        className={`size-1.5 rounded-full ${
          live ? 'bg-success' : 'bg-label-3'
        }`}
      />
      <span>{name}</span>
    </div>
  )
}

function TelemetryStat({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string
  value: string | number
  sublabel?: string
  accent?: string
}) {
  return (
    <div className="flex-1 min-w-[120px] p-4 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-2xs">
      <div className="type-eyebrow text-[10px] text-label-3 mb-1 font-semibold">
        {label}
      </div>
      <div
        className={`text-2xl font-bold tabular-nums font-mono ${
          accent ?? 'text-label'
        }`}
      >
        {value}
      </div>
      {sublabel && (
        <div className="text-[10px] text-label-3 font-mono mt-0.5">
          {sublabel}
        </div>
      )}
    </div>
  )
}

export default function RunPage() {
  const { ready, authenticated, user, login } = usePrivy()
  const [devUser, setDevUser] = useState<string | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [halt, setHalt] = useState<{ halted: boolean; reason: string } | null>(
    null
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shamar_dev_user')
      if (saved) setDevUser(saved)
    }
  }, [])

  const effectiveUserId = user?.id || devUser
  const isUserAuthenticated = authenticated || Boolean(devUser)

  const refreshHalt = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await apiFetch('/api/execute/control', {
        userId: effectiveUserId,
      })
      if (res.ok) {
        setHalt(await res.json())
      }
    } catch {
      setHalt(null)
    }
  }, [effectiveUserId])

  useEffect(() => {
    if (!isUserAuthenticated || !effectiveUserId) return
    refreshHalt()
    const t = setInterval(refreshHalt, 5000)
    return () => clearInterval(t)
  }, [isUserAuthenticated, effectiveUserId, refreshHalt])

  async function run(apply: boolean) {
    if (!effectiveUserId) return
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        userId: effectiveUserId,
        body: JSON.stringify({ apply }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      refreshHalt()
    }
  }

  const r = result

  // Derive agent state for R23 badge
  const agentStateKind: AgentStateKind = halt?.halted
    ? 'halted'
    : r
      ? r.authorization.granted
        ? 'authorized'
        : 'blocked'
      : 'checking'

  if (!ready) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="size-2 rounded-full bg-accent animate-pulse" />
      </main>
    )
  }

  if (!isUserAuthenticated) {
    return (
      <main className="min-h-screen bg-canvas text-label flex flex-col justify-between">
        <TopNav title="Operational Run" />
        <div className="flex-1 max-w-md w-full mx-auto px-4 py-20 flex flex-col items-center justify-center text-center gap-6">
          <div className="rounded-[var(--radius-card)] bg-surface p-8 border border-separator/80 shadow-xs flex flex-col items-center gap-4 w-full">
            <h1 className="type-title-1 font-[600] text-label">
              Sign in to Run Pipeline
            </h1>
            <p className="type-callout text-label-2">
              Connect your wallet or account to run autonomous evaluations and
              live dispatches.
            </p>
            <button
              type="button"
              onClick={login}
              className="touch-target flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent px-6 type-headline font-semibold text-white shadow-xs hover:bg-accent-hover transition-colors cursor-pointer"
            >
              Connect Wallet
            </button>
          </div>
        </div>
        <AppFooter />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav title="Operational Run" />

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 md:px-10 space-y-8">
        {/* Navigation & Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-separator/80">
          <div>
            <span className="type-eyebrow text-accent font-semibold">
              Judge Inspection Console
            </span>
            <h1 className="type-title-1 font-[600] text-label tracking-tight mt-1">
              SHAMAR Operational Run
            </h1>
            <p className="type-callout text-label-2 mt-1">
              Autonomous pipeline: Evidence → Judgment → Guardrails →
              Authorization → Dispatch.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <AgentStateBadge
              state={agentStateKind}
              reason={
                halt?.halted
                  ? 'Halted via Telegram /stop'
                  : r?.authorization.reason
              }
              source={r?.authorization.contract ? 'onchain' : 'local'}
            />
          </div>
        </header>

        {/* Live Integrations Strip */}
        <section aria-label="System integrations">
          <div className="type-eyebrow text-label-3 mb-2">Integrations</div>
          <div className="flex flex-wrap gap-2.5">
            <IntegrationBadge
              name="Gmail (Receipts)"
              live={Boolean(r)}
              detail="Read-only billing scan"
            />
            <IntegrationBadge
              name="Google Calendar"
              live={Boolean(r?.calendar_connected)}
              detail="Renewal and verification events"
            />
            <IntegrationBadge
              name="Resend"
              live={Boolean(r && r.dispatched > 0)}
              detail="Cancellation email dispatch"
            />
            <IntegrationBadge
              name="Telegram Bot"
              live={Boolean(halt && halt.reason !== 'Telegram not configured')}
              detail={
                halt?.halted
                  ? 'Agent currently halted'
                  : 'Listening for /stop and /resume'
              }
            />
            <IntegrationBadge
              name="Base Mainnet"
              live={Boolean(r?.authorization.contract)}
              detail="SHAMARPolicy smart contract grant"
            />
          </div>
        </section>

        {/* User Identity and Execution Controls */}
        <section className="p-6 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="type-headline font-semibold text-label">
                Decision Pipeline Runner
              </h2>
              <p className="type-caption text-label-2 mt-0.5">
                Evaluates subscriptions, checks Base policy authorizations,
                verifies Telegram halt state, and dispatches actions.
              </p>
            </div>
            <span className="type-caption font-mono text-label-3">
              Mode: {result ? result.mode : 'Idle'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface-2 border border-separator text-xs font-mono text-label-2 w-full sm:w-auto">
              <span className="size-2 rounded-full bg-success" />
              <span>
                Session:{' '}
                <span className="font-semibold text-label">
                  {user?.email?.address ??
                    (user?.wallet?.address
                      ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}`
                      : effectiveUserId)}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => run(false)}
                disabled={busy}
                className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 rounded-full border border-separator bg-surface text-xs font-semibold uppercase tracking-wider text-label hover:bg-surface-2 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {busy ? 'Running…' : 'Simulate (Dry Run)'}
              </button>

              <button
                type="button"
                onClick={() => run(true)}
                disabled={busy || Boolean(halt?.halted)}
                className="flex-1 sm:flex-none min-h-[44px] px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider text-white bg-accent hover:bg-accent-hover shadow-xs transition-all disabled:opacity-40 cursor-pointer"
              >
                Execute Live
              </button>
            </div>
          </div>
        </section>

        {/* Telegram Emergency Halt Alert */}
        {halt?.halted && (
          <div
            role="alert"
            className="p-4 rounded-[var(--radius-card)] border border-accent/40 bg-accent-soft text-sm text-accent-text font-medium"
          >
            <div className="flex items-center gap-2 font-semibold">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
              Emergency halt active from Telegram
            </div>
            <p className="type-caption text-label-2 mt-1">
              Dispatch is strictly blocked until you send{' '}
              <code className="bg-surface px-1.5 py-0.5 rounded font-mono text-accent">
                /resume
              </code>{' '}
              to the Telegram bot.
            </p>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-[var(--radius-card)] border border-accent/30 bg-accent-soft text-sm font-mono text-accent"
          >
            {error}
          </div>
        )}

        {/* Execution Results */}
        {r && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Telemetry Grid */}
            <section
              aria-label="Execution telemetry"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3"
            >
              <TelemetryStat label="Reasoned" value={r.reasoned} />
              <TelemetryStat
                label="Model / Fallback"
                value={`${r.reasoned - r.fell_back} / ${r.fell_back}`}
                accent={r.fell_back === r.reasoned ? 'text-warning' : undefined}
                sublabel={
                  r.fell_back > 0
                    ? 'Deterministic rules used'
                    : 'All model reasoned'
                }
              />
              <TelemetryStat
                label="Cancellations"
                value={r.proposed_cancellations}
                accent="text-accent"
              />
              <TelemetryStat
                label="Dispatched"
                value={r.dispatched}
                accent={r.dispatched ? 'text-success' : undefined}
              />
              <TelemetryStat
                label="Blocked"
                value={r.blocked}
                accent={r.blocked ? 'text-warning' : undefined}
              />
              <TelemetryStat
                label="Saved / mo"
                value={`$${r.monthly_savings_usd.toFixed(2)}`}
                accent="text-success"
              />
              <TelemetryStat
                label="Latency"
                value={`${(r.elapsed_ms / 1000).toFixed(1)}s`}
              />
            </section>

            {/* Authorization & Control Strip */}
            <section className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="p-5 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="type-eyebrow text-label-3">
                    On-chain Authorization (SHAMARPolicy)
                  </span>
                  <span
                    className={`size-2 rounded-full ${
                      r.authorization.granted ? 'bg-success' : 'bg-accent'
                    }`}
                  />
                </div>
                <div className="font-semibold text-label">
                  {r.authorization.granted
                    ? 'shamar.cancel scope granted'
                    : 'Authorization denied'}
                </div>
                <p className="type-caption text-label-2 mt-1 leading-relaxed">
                  {r.authorization.reason}
                </p>
                {r.authorization.contract && (
                  <div className="mt-3 pt-3 border-t border-separator/60 text-[11px] font-mono text-label-3 space-y-0.5">
                    <div>
                      Contract: {r.authorization.contract.slice(0, 10)}…
                      {r.authorization.contract.slice(-6)}
                    </div>
                    <div>
                      Signer:{' '}
                      {r.authorization.wallet
                        ? `${r.authorization.wallet.slice(0, 10)}…`
                        : 'None'}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="type-eyebrow text-label-3">
                    Control Channel (Telegram)
                  </span>
                  <span
                    className={`size-2 rounded-full ${
                      r.control.halted ? 'bg-accent' : 'bg-success'
                    }`}
                  />
                </div>
                <div className="font-semibold text-label">
                  {r.control.halted ? 'Agent Halted' : 'Active / Unhalted'}
                </div>
                <p className="type-caption text-label-2 mt-1 leading-relaxed">
                  {r.control.reason}
                </p>
                <div className="mt-3 pt-3 border-t border-separator/60 text-[11px] font-mono text-label-3 space-y-0.5">
                  <div>Source: {r.control.source}</div>
                  <div>Emergency command: Send /stop or /resume</div>
                </div>
              </div>
            </section>

            {/* Dispatches Ledger */}
            {r.dispatches.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="type-eyebrow font-semibold text-label">
                    Dispatch Ledger ({r.dispatches.length})
                  </h2>
                  <span className="type-caption font-mono text-label-3">
                    Signed by Agent Key (EIP-191)
                  </span>
                </div>

                <div className="space-y-3">
                  {r.dispatches.map((d) => (
                    <div
                      key={d.subscription_id}
                      className="p-5 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-label text-base">
                            {d.merchant}
                          </span>
                          <span
                            className={`text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-bold font-mono border ${
                              d.status === 'sent'
                                ? 'bg-success/10 border-success/30 text-success'
                                : 'bg-accent-soft border-accent/30 text-accent'
                            }`}
                          >
                            {d.status.replace(/_/g, ' ')}
                          </span>
                          {!d.reversible && d.status === 'sent' && (
                            <span className="text-[10px] uppercase tracking-wider text-warning font-mono font-semibold">
                              One-way door
                            </span>
                          )}
                        </div>

                        {d.signature && (
                          <span
                            className="text-[10px] font-mono text-label-3"
                            title={`EIP-191 signature: ${d.signature}`}
                          >
                            Sig: {d.signature.slice(0, 14)}…
                            {d.signature.slice(-6)}
                          </span>
                        )}
                      </div>

                      <p className="type-caption text-label-2">{d.reason}</p>

                      {/* Honest Email Tier Weakness callout when dispatched */}
                      {d.status === 'sent' && (
                        <EmailTierNotice
                          merchant={d.merchant}
                          recipient={d.recipient}
                          calendarEventCreated={r.calendar_connected}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Decisions & Blast Radius */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="type-eyebrow font-semibold text-label">
                  Decisions and Blast Radius ({r.decisions.length})
                </h2>
                <span className="type-caption font-mono text-label-3">
                  Guardrails applied
                </span>
              </div>

              <div className="space-y-3">
                {r.decisions.map((d) => {
                  const downgraded = d.blast_radius.notes.some((n) =>
                    n.toLowerCase().includes('downgraded')
                  )
                  const badge = ACTION_BADGES[d.action] ?? ACTION_BADGES.keep

                  return (
                    <div
                      key={d.subscription_id}
                      className={`p-5 rounded-[var(--radius-card)] bg-surface border transition-colors space-y-3 shadow-xs ${
                        downgraded
                          ? 'border-accent/40 bg-accent-soft/20'
                          : 'border-separator/80'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-bold font-mono border ${badge.badgeClass}`}
                          >
                            {d.action}
                          </span>
                          <span className="font-semibold text-label text-base">
                            {d.merchant}
                          </span>
                          <span className="text-label-3 text-xs tabular-nums font-mono">
                            {d.confidence}% confidence
                          </span>
                          {d.savings_usd_monthly > 0 && (
                            <span className="text-success text-xs font-mono tabular-nums font-semibold">
                              +${d.savings_usd_monthly.toFixed(2)}/mo
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {d.blast_radius.irreversible && (
                            <span className="text-[10px] uppercase tracking-wider text-warning font-mono px-2 py-0.5 border border-warning/30 rounded-full font-semibold">
                              Irreversible
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-wider text-label-3 font-mono">
                            {d.reasoned_by === 'model'
                              ? 'AI reasoning'
                              : 'Fallback rule'}
                          </span>
                        </div>
                      </div>

                      <p className="type-callout text-label leading-relaxed">
                        {d.rationale}
                      </p>

                      {/* Blast Radius Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-separator/60 text-xs font-mono">
                        <div>
                          <span className="text-label-3 block text-[10px] uppercase font-semibold">
                            Data Loss
                          </span>
                          <span className="text-label-2 font-medium">
                            {d.blast_radius.data_loss}
                          </span>
                        </div>
                        <div>
                          <span className="text-label-3 block text-[10px] uppercase font-semibold">
                            Access Impact
                          </span>
                          <span className="text-label-2 font-medium">
                            {d.blast_radius.access_loss}
                          </span>
                        </div>
                        <div>
                          <span className="text-label-3 block text-[10px] uppercase font-semibold">
                            Repurchase Cost
                          </span>
                          <span className="text-label-2 font-medium">
                            {d.blast_radius.repurchase}
                          </span>
                        </div>
                        <div>
                          <span className="text-label-3 block text-[10px] uppercase font-semibold">
                            Door Type
                          </span>
                          <span className="text-label-2 font-medium">
                            {d.blast_radius.irreversible
                              ? 'One-way'
                              : 'Two-way'}
                          </span>
                        </div>
                      </div>

                      {/* Guardrail notes */}
                      {d.blast_radius.notes.length > 0 && (
                        <div className="pt-2">
                          <ul className="space-y-1">
                            {d.blast_radius.notes.map((note, idx) => {
                              const isDowngrade = note
                                .toLowerCase()
                                .includes('downgraded')
                              return (
                                <li
                                  key={idx}
                                  className={`text-xs font-mono flex items-center gap-1.5 ${
                                    isDowngrade
                                      ? 'text-accent font-semibold'
                                      : 'text-label-3'
                                  }`}
                                >
                                  <span>·</span>
                                  <span>{note}</span>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      <AppFooter />
    </main>
  )
}
