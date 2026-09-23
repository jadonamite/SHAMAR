'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AgentStateBadge from '@/components/app/AgentStateBadge'
import EmailTierNotice from '@/components/app/EmailTierNotice'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001'

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

const ACTION_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  cancel: { bg: 'rgba(229, 9, 20, 0.15)', text: '#E50914', border: 'rgba(229, 9, 20, 0.4)' },
  pause: { bg: 'rgba(217, 119, 6, 0.15)', text: '#D97706', border: 'rgba(217, 119, 6, 0.4)' },
  remind: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.4)' },
  keep: { bg: 'rgba(255, 255, 255, 0.05)', text: '#A3A3A3', border: 'rgba(255, 255, 255, 0.1)' },
}

function IntegrationBadge({ name, live, detail }: { name: string; live: boolean; detail?: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono tracking-wide border transition-colors"
      style={{
        borderColor: live ? 'rgba(22, 163, 74, 0.4)' : 'var(--border-subtle)',
        backgroundColor: live ? 'rgba(22, 163, 74, 0.08)' : 'var(--bg-surface)',
        color: live ? 'var(--text-primary)' : 'var(--text-muted)',
      }}
      title={detail}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: live ? '#16A34A' : '#525252' }}
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
    <div
      className="flex-1 min-w-[120px] p-4 rounded border transition-colors"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1 font-semibold"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold tabular-nums"
        style={{ color: accent ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </div>
      {sublabel && (
        <div className="text-[10px] text-muted font-mono mt-0.5">{sublabel}</div>
      )}
    </div>
  )
}

export default function RunPage() {
  const [userId, setUserId] = useState('did:privy:cmq204il7013g0cjljp9jf4ab')
  const [result, setResult] = useState<RunResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [halt, setHalt] = useState<{ halted: boolean; reason: string } | null>(null)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('user')
    if (q) setUserId(q)
  }, [])

  const refreshHalt = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER}/execute/control`)
      setHalt(await res.json())
    } catch {
      setHalt(null)
    }
  }, [])

  useEffect(() => {
    refreshHalt()
    const t = setInterval(refreshHalt, 4000)
    return () => clearInterval(t)
  }, [refreshHalt])

  async function run(apply: boolean) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${SERVER}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
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
  const agentStateKind = halt?.halted
    ? 'halted'
    : r
    ? r.authorization.granted
      ? 'authorized'
      : 'blocked'
    : 'checking'

  return (
    <main
      className="min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--bg-void)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <TopNav title="Operational Run" />

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 md:px-10 space-y-8">
        {/* Navigation & Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-secondary font-mono">
                Judge Inspection Console
              </span>
            </div>
            <h1
              className="text-3xl font-bold tracking-tight mt-1"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              SHAMAR Operational Run
            </h1>
            <p className="text-secondary text-sm mt-1">
              Autonomous pipeline: Evidence → Judgment → Guardrails → Authorization → Dispatch.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <AgentStateBadge
              state={agentStateKind}
              reason={halt?.halted ? 'Halted via Telegram /stop' : r?.authorization.reason}
              source={r?.authorization.contract ? 'onchain' : 'local'}
            />
          </div>
        </header>

        {/* Live Integrations Strip */}
        <section aria-label="System integrations">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2 font-mono">
            Integrations
          </div>
          <div className="flex flex-wrap gap-2.5">
            <IntegrationBadge name="Gmail (Receipts)" live={Boolean(r)} detail="Read-only billing scan" />
            <IntegrationBadge name="Google Calendar" live={Boolean(r?.calendar_connected)} detail="Renewal and verification events" />
            <IntegrationBadge name="Resend" live={Boolean(r && r.dispatched > 0)} detail="Cancellation email dispatch" />
            <IntegrationBadge
              name="Telegram Bot"
              live={Boolean(halt && halt.reason !== 'Telegram not configured')}
              detail={halt?.halted ? 'Agent currently halted' : 'Listening for /stop and /resume'}
            />
            <IntegrationBadge
              name="Base Mainnet"
              live={Boolean(r?.authorization.contract)}
              detail="SHAMARPolicy smart contract grant"
            />
          </div>
        </section>

        {/* User Identity and Execution Controls */}
        <section
          className="p-5 rounded border space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label
              htmlFor="user-id-input"
              className="text-xs font-semibold uppercase tracking-wider text-muted font-mono"
            >
              Caller Privy DID (User Session)
            </label>
            <span className="text-[11px] text-muted font-mono">
              Parameter: ?user=did:privy:...
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <input
              id="user-id-input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="did:privy:..."
              className="w-full sm:flex-1 px-3 py-2 text-xs font-mono rounded border transition-colors"
              style={{
                backgroundColor: 'var(--bg-void)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
                minHeight: '44px',
              }}
            />

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => run(false)}
                disabled={busy}
                className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 rounded border text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer"
                style={{
                  borderColor: 'var(--border-strong)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {busy ? 'Running…' : 'Dry Run'}
              </button>

              <button
                onClick={() => run(true)}
                disabled={busy || Boolean(halt?.halted)}
                className="flex-1 sm:flex-none min-h-[44px] px-6 py-2.5 rounded text-xs font-semibold uppercase tracking-wider text-white transition-colors disabled:opacity-40 cursor-pointer"
                style={{
                  backgroundColor: '#E50914',
                  fontFamily: 'var(--font-sans)',
                }}
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
            className="p-4 rounded border text-sm"
            style={{
              backgroundColor: 'rgba(229, 9, 20, 0.12)',
              borderColor: 'rgba(229, 9, 20, 0.4)',
              color: '#FFFFFF',
            }}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span className="w-2 h-2 rounded-full bg-sam-red animate-ping" />
              Emergency halt active from Telegram
            </div>
            <p className="text-secondary text-xs mt-1">
              Dispatch is strictly blocked until you send <code>/resume</code> to the Telegram bot.
            </p>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded border text-sm font-mono"
            style={{
              backgroundColor: 'rgba(229, 9, 20, 0.1)',
              borderColor: 'rgba(229, 9, 20, 0.3)',
              color: '#E50914',
            }}
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
                label="Model / fallback"
                value={`${r.reasoned - r.fell_back} / ${r.fell_back}`}
                accent={r.fell_back === r.reasoned ? '#D97706' : undefined}
                sublabel={r.fell_back > 0 ? 'Deterministic rules used' : 'All model reasoned'}
              />
              <TelemetryStat
                label="Cancellations"
                value={r.proposed_cancellations}
                accent="#E50914"
              />
              <TelemetryStat
                label="Dispatched"
                value={r.dispatched}
                accent={r.dispatched ? '#16A34A' : undefined}
              />
              <TelemetryStat
                label="Blocked"
                value={r.blocked}
                accent={r.blocked ? '#D97706' : undefined}
              />
              <TelemetryStat
                label="Saved / mo"
                value={`$${r.monthly_savings_usd.toFixed(2)}`}
                accent="#16A34A"
              />
              <TelemetryStat
                label="Latency"
                value={`${(r.elapsed_ms / 1000).toFixed(1)}s`}
              />
            </section>

            {/* Authorization & Control Strip */}
            <section className="grid md:grid-cols-2 gap-4 text-sm">
              <div
                className="p-5 rounded border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-mono font-semibold">
                    On-chain Authorization (SHAMARPolicy)
                  </span>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: r.authorization.granted ? '#16A34A' : '#E50914' }}
                  />
                </div>
                <div className="font-semibold text-white">
                  {r.authorization.granted ? 'shamar.cancel scope granted' : 'Authorization denied'}
                </div>
                <p className="text-secondary text-xs mt-1 leading-relaxed">
                  {r.authorization.reason}
                </p>
                {r.authorization.contract && (
                  <div className="mt-3 pt-3 border-t text-[11px] font-mono text-muted space-y-0.5" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div>Contract: {r.authorization.contract.slice(0, 10)}…{r.authorization.contract.slice(-6)}</div>
                    <div>Signer: {r.authorization.wallet ? `${r.authorization.wallet.slice(0, 10)}…` : 'None'}</div>
                  </div>
                )}
              </div>

              <div
                className="p-5 rounded border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-mono font-semibold">
                    Control Channel (Telegram)
                  </span>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: r.control.halted ? '#E50914' : '#16A34A' }}
                  />
                </div>
                <div className="font-semibold text-white">
                  {r.control.halted ? 'Agent Halted' : 'Active / Unhalted'}
                </div>
                <p className="text-secondary text-xs mt-1 leading-relaxed">
                  {r.control.reason}
                </p>
                <div className="mt-3 pt-3 border-t text-[11px] font-mono text-muted space-y-0.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div>Source: {r.control.source}</div>
                  <div>Emergency command: Send /stop or /resume</div>
                </div>
              </div>
            </section>

            {/* Dispatches Ledger */}
            {r.dispatches.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2
                    className="text-xs uppercase tracking-[0.14em] text-muted font-mono font-semibold"
                  >
                    Dispatch Ledger ({r.dispatches.length})
                  </h2>
                  <span className="text-[11px] text-muted font-mono">
                    Signed by Agent Key (EIP-191)
                  </span>
                </div>

                <div className="space-y-3">
                  {r.dispatches.map((d) => (
                    <div
                      key={d.subscription_id}
                      className="p-4 rounded border transition-colors space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white text-base">
                            {d.merchant}
                          </span>
                          <span
                            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-mono"
                            style={{
                              backgroundColor:
                                d.status === 'sent'
                                  ? 'rgba(22,163,74,0.15)'
                                  : 'rgba(229,9,20,0.15)',
                              color: d.status === 'sent' ? '#16A34A' : '#E50914',
                            }}
                          >
                            {d.status.replace(/_/g, ' ')}
                          </span>
                          {!d.reversible && d.status === 'sent' && (
                            <span className="text-[10px] uppercase tracking-wider text-amber-500 font-mono">
                              One-way door
                            </span>
                          )}
                        </div>

                        {d.signature && (
                          <span
                            className="text-[10px] font-mono text-muted"
                            title={`EIP-191 signature: ${d.signature}`}
                          >
                            Sig: {d.signature.slice(0, 14)}…{d.signature.slice(-6)}
                          </span>
                        )}
                      </div>

                      <p className="text-secondary text-xs">{d.reason}</p>

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
                <h2 className="text-xs uppercase tracking-[0.14em] text-muted font-mono font-semibold">
                  Decisions and blast radius ({r.decisions.length})
                </h2>
                <span className="text-[11px] text-muted font-mono">
                  Guardrails applied
                </span>
              </div>

              <div className="space-y-3">
                {r.decisions.map((d) => {
                  const downgraded = d.blast_radius.notes.some((n) =>
                    n.toLowerCase().includes('downgraded')
                  )
                  const style = ACTION_STYLE[d.action] ?? ACTION_STYLE.keep

                  return (
                    <div
                      key={d.subscription_id}
                      className="p-5 rounded border transition-colors space-y-3"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: downgraded
                          ? 'rgba(229,9,20,0.4)'
                          : 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded font-bold font-mono"
                            style={{
                              backgroundColor: style.bg,
                              color: style.text,
                              border: `1px solid ${style.border}`,
                            }}
                          >
                            {d.action}
                          </span>
                          <span className="font-bold text-white text-base">
                            {d.merchant}
                          </span>
                          <span className="text-muted text-xs tabular-nums font-mono">
                            {d.confidence}% confidence
                          </span>
                          {d.savings_usd_monthly > 0 && (
                            <span className="text-green-500 text-xs font-mono tabular-nums">
                              +${d.savings_usd_monthly.toFixed(2)}/mo
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {d.blast_radius.irreversible && (
                            <span className="text-[10px] uppercase tracking-wider text-amber-500 font-mono px-1.5 py-0.5 border border-amber-500/30 rounded">
                              Irreversible
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-wider text-muted font-mono">
                            {d.reasoned_by === 'model' ? 'AI reasoning' : 'Fallback rule'}
                          </span>
                        </div>
                      </div>

                      <p className="text-secondary text-sm leading-relaxed">
                        {d.rationale}
                      </p>

                      {/* Blast Radius Details */}
                      <div
                        className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t text-xs font-mono"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <div>
                          <span className="text-muted block text-[10px] uppercase">Data Loss</span>
                          <span className="text-secondary">{d.blast_radius.data_loss}</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px] uppercase">Access Impact</span>
                          <span className="text-secondary">{d.blast_radius.access_loss}</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px] uppercase">Repurchase Cost</span>
                          <span className="text-secondary">{d.blast_radius.repurchase}</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px] uppercase">Door Type</span>
                          <span className="text-secondary">
                            {d.blast_radius.irreversible ? 'One-way' : 'Two-way'}
                          </span>
                        </div>
                      </div>

                      {/* Guardrail notes */}
                      {d.blast_radius.notes.length > 0 && (
                        <div className="pt-2">
                          <ul className="space-y-1">
                            {d.blast_radius.notes.map((note, idx) => {
                              const isDowngrade = note.toLowerCase().includes('downgraded')
                              return (
                                <li
                                  key={idx}
                                  className="text-xs font-mono flex items-center gap-1.5"
                                  style={{ color: isDowngrade ? '#E50914' : 'var(--text-muted)' }}
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
