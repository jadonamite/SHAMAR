'use client'

import { useCallback, useEffect, useState } from 'react'

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
}

type CalendarWrite = {
  merchant: string
  date: string
  status: string
  reason?: string
}

type RunResult = {
  mode: string
  authorization: { granted: boolean; checked: boolean; reason: string; wallet: string | null; contract: string }
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

const ACTION_STYLE: Record<string, string> = {
  cancel: 'bg-[#E50914] text-white',
  pause: 'bg-[#D97706] text-black',
  remind: 'bg-[#1C1C1C] text-[#A3A3A3] border border-white/10',
  keep: 'bg-transparent text-[#525252] border border-white/5',
}

function App({ name, live }: { name: string; live: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs tracking-wide"
      style={{ borderColor: live ? 'rgba(22,163,74,.4)' : 'rgba(255,255,255,.08)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: live ? '#16A34A' : '#525252' }} />
      <span style={{ color: live ? '#fff' : '#525252' }}>{name}</span>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex-1 min-w-[110px]">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[#525252] mb-1">{label}</div>
      <div className="text-2xl font-semibold tabular-nums" style={{ color: accent ?? '#fff' }}>{value}</div>
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

  return (
    <main className="min-h-screen bg-[#0D0D0D] text-white px-5 py-8 md:px-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">SHAMAR</h1>
          <p className="text-[#A3A3A3] mt-1 text-sm">
            Reads your inbox. Decides what cancelling would cost. Acts only with permission.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <App name="Gmail" live={Boolean(r)} />
            <App name="Calendar" live={Boolean(r?.calendar_connected)} />
            <App name="Resend" live={Boolean(r && r.dispatched > 0)} />
            <App name="Telegram" live={Boolean(halt && halt.reason !== 'Telegram not configured')} />
          </div>
        </header>

        <section className="flex flex-wrap gap-3 items-center mb-6">
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="flex-1 min-w-[260px] bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm font-mono text-[#A3A3A3]"
          />
          <button
            onClick={() => run(false)}
            disabled={busy}
            className="px-5 py-2 rounded border border-white/15 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {busy ? 'Reasoning…' : 'Dry run'}
          </button>
          <button
            onClick={() => run(true)}
            disabled={busy || Boolean(halt?.halted)}
            className="px-5 py-2 rounded bg-[#E50914] text-sm font-semibold hover:bg-[#B81D24] disabled:opacity-40"
          >
            Execute
          </button>
        </section>

        {halt?.halted && (
          <div className="mb-6 px-4 py-3 rounded border border-[#E50914]/40 bg-[#E50914]/10 text-sm">
            <strong>Halted from Telegram.</strong> Dispatch is refused until <code>/resume</code>.
          </div>
        )}

        {error && (
          <div className="mb-6 px-4 py-3 rounded border border-[#E50914]/40 bg-[#E50914]/10 text-sm font-mono">
            {error}
          </div>
        )}

        {r && (
          <>
            <section className="flex flex-wrap gap-6 p-5 rounded-lg bg-[#141414] border border-white/5 mb-6">
              <Stat label="Reasoned" value={r.reasoned} />
              <Stat label="Model / fallback" value={`${r.reasoned - r.fell_back} / ${r.fell_back}`} accent={r.fell_back === r.reasoned ? '#D97706' : undefined} />
              <Stat label="Cancellations" value={r.proposed_cancellations} accent="#E50914" />
              <Stat label="Dispatched" value={r.dispatched} accent={r.dispatched ? '#16A34A' : undefined} />
              <Stat label="Blocked" value={r.blocked} accent={r.blocked ? '#D97706' : undefined} />
              <Stat label="Saved / mo" value={`$${r.monthly_savings_usd}`} accent="#16A34A" />
              <Stat label="Elapsed" value={`${(r.elapsed_ms / 1000).toFixed(1)}s`} />
            </section>

            <section className="grid md:grid-cols-2 gap-3 mb-8 text-sm">
              <div className="p-4 rounded-lg bg-[#141414] border border-white/5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#525252] mb-2">Authorization</div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: r.authorization.granted ? '#16A34A' : '#E50914' }} />
                  <span>{r.authorization.granted ? 'sam.cancel granted' : 'Not authorized'}</span>
                </div>
                <p className="text-[#525252] text-xs mt-2">{r.authorization.reason}</p>
              </div>
              <div className="p-4 rounded-lg bg-[#141414] border border-white/5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#525252] mb-2">Control channel</div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: r.control.halted ? '#E50914' : '#16A34A' }} />
                  <span>{r.control.halted ? 'Halted' : 'Running'}</span>
                </div>
                <p className="text-[#525252] text-xs mt-2">{r.control.reason}</p>
              </div>
            </section>

            {r.dispatches.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs uppercase tracking-[0.12em] text-[#525252] mb-3">Dispatch ledger</h2>
                <div className="space-y-2">
                  {r.dispatches.map((d) => (
                    <div key={d.subscription_id} className="p-4 rounded-lg bg-[#141414] border border-white/5 flex flex-wrap gap-3 items-center">
                      <span className="font-semibold">{d.merchant}</span>
                      <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded"
                        style={{
                          background: d.status === 'sent' ? 'rgba(22,163,74,.15)' : 'rgba(229,9,20,.12)',
                          color: d.status === 'sent' ? '#16A34A' : '#E50914',
                        }}>
                        {d.status.replace(/_/g, ' ')}
                      </span>
                      {!d.reversible && d.status === 'sent' && (
                        <span className="text-[10px] uppercase tracking-wide text-[#D97706]">irreversible</span>
                      )}
                      <span className="text-[#525252] text-xs w-full">{d.reason}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xs uppercase tracking-[0.12em] text-[#525252] mb-3">
                Decisions — {r.reasoned} subscriptions
              </h2>
              <div className="space-y-2">
                {r.decisions.map((d) => {
                  const downgraded = d.blast_radius.notes.some((n) => n.startsWith('Downgraded'))
                  return (
                    <div key={d.subscription_id}
                      className="p-4 rounded-lg bg-[#141414] border"
                      style={{ borderColor: downgraded ? 'rgba(229,9,20,.35)' : 'rgba(255,255,255,.05)' }}>
                      <div className="flex flex-wrap gap-3 items-center">
                        <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded ${ACTION_STYLE[d.action]}`}>
                          {d.action}
                        </span>
                        <span className="font-semibold">{d.merchant}</span>
                        <span className="text-[#525252] text-xs tabular-nums">{d.confidence}%</span>
                        {d.savings_usd_monthly > 0 && (
                          <span className="text-[#16A34A] text-xs tabular-nums">${d.savings_usd_monthly.toFixed(2)}/mo</span>
                        )}
                        {d.blast_radius.irreversible && (
                          <span className="text-[10px] uppercase tracking-wide text-[#D97706]">one-way door</span>
                        )}
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-[#525252]">{d.reasoned_by}</span>
                      </div>
                      <p className="text-[#A3A3A3] text-sm mt-2">{d.rationale}</p>
                      {d.blast_radius.notes.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {d.blast_radius.notes.map((n, i) => (
                            <li key={i} className="text-xs" style={{ color: n.startsWith('Downgraded') ? '#E50914' : '#525252' }}>
                              · {n}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
