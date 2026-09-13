import { sql } from './db.js'
import { complete } from './ai.js'
import { toUsd, currencySymbol } from './currency.js'
import type { SubscriptionCategory } from './subscriptions-registry.js'

export type Evidence = {
  subscription_id: string
  merchant: string
  category: SubscriptionCategory | null
  amount: number
  currency: string
  cadence: string
  monthly_usd: number
  days_since_charge: number | null
  days_since_detected: number
  charge_count: number
}

export type BlastRadius = {
  data_loss: 'none' | 'recoverable' | 'permanent'
  access_loss: 'solo' | 'shared'
  repurchase: 'same_price' | 'higher_price' | 'unavailable'
  irreversible: boolean
  notes: string[]
}

export type Decision = {
  subscription_id: string
  merchant: string
  action: 'cancel' | 'pause' | 'remind' | 'keep'
  confidence: number
  rationale: string
  blast_radius: BlastRadius
  savings_usd_monthly: number
  requires_authorization: boolean
  reasoned_by: 'model' | 'fallback'
}

const CADENCE_MULTIPLIER: Record<string, number> = {
  daily: 30,
  weekly: 4.33,
  monthly: 1,
  yearly: 1 / 12,
}

// Category priors for what cancelling actually costs you. The model may argue
// against these with merchant-specific knowledge; the guardrails below cannot.
const CATEGORY_PRIOR: Record<string, Pick<BlastRadius, 'data_loss' | 'access_loss'>> = {
  storage: { data_loss: 'permanent', access_loss: 'solo' },
  design: { data_loss: 'permanent', access_loss: 'shared' },
  dev: { data_loss: 'recoverable', access_loss: 'shared' },
  productivity: { data_loss: 'recoverable', access_loss: 'shared' },
  communication: { data_loss: 'recoverable', access_loss: 'shared' },
  security: { data_loss: 'none', access_loss: 'solo' },
  vpn: { data_loss: 'none', access_loss: 'solo' },
  marketing: { data_loss: 'recoverable', access_loss: 'shared' },
  education: { data_loss: 'recoverable', access_loss: 'solo' },
  ai: { data_loss: 'recoverable', access_loss: 'solo' },
  streaming: { data_loss: 'none', access_loss: 'solo' },
  music: { data_loss: 'none', access_loss: 'solo' },
}

export function monthlyUsd(amount: number, currency: string, cadence: string): number {
  return toUsd(amount, currency) * (CADENCE_MULTIPLIER[cadence] ?? 1)
}

export async function gatherEvidence(dbUserId: string): Promise<Evidence[]> {
  const rows = (await sql`
    SELECT s.id, s.merchant, s.category, s.amount, s.currency, s.cadence,
           s.detected_at, s.last_charged,
           (SELECT COUNT(*) FROM signals g WHERE g.subscription_id = s.id) AS signal_count
    FROM subscriptions s
    WHERE s.user_id = ${dbUserId} AND s.status = 'active'
    ORDER BY s.detected_at DESC
  `) as Array<Record<string, any>>

  const now = Date.now()
  const days = (d: string | Date | null) =>
    d ? Math.floor((now - new Date(d).getTime()) / 86_400_000) : null

  return rows.map((r) => ({
    subscription_id: r.id,
    merchant: r.merchant,
    category: r.category,
    amount: Number(r.amount),
    currency: r.currency,
    cadence: r.cadence,
    monthly_usd: monthlyUsd(Number(r.amount), r.currency, r.cadence),
    days_since_charge: days(r.last_charged),
    days_since_detected: days(r.detected_at) ?? 0,
    charge_count: Number(r.signal_count ?? 0),
  }))
}

function priorFor(category: string | null): Pick<BlastRadius, 'data_loss' | 'access_loss'> {
  return CATEGORY_PRIOR[category ?? ''] ?? { data_loss: 'recoverable', access_loss: 'solo' }
}

// Deterministic decision used when the model is unavailable or returns
// unparseable output. Never silently substituted — the caller sees reasoned_by.
export function fallbackDecision(e: Evidence): Decision {
  const prior = priorFor(e.category)
  const dormant = e.days_since_charge !== null && e.days_since_charge > 60
  const established = e.days_since_detected > 365

  const blast: BlastRadius = {
    ...prior,
    repurchase: established ? 'higher_price' : 'same_price',
    irreversible: prior.data_loss === 'permanent' || established,
    notes: [
      dormant ? `No charge in ${e.days_since_charge} days` : 'Billing is current',
      established ? 'Active over a year — current price may be legacy' : 'Recently acquired',
    ],
  }

  let action: Decision['action'] = 'keep'
  let confidence = 40
  if (dormant && e.monthly_usd >= 20) {
    action = blast.irreversible ? 'remind' : 'cancel'
    confidence = blast.irreversible ? 70 : 88
  } else if (dormant) {
    action = 'pause'
    confidence = 62
  } else if (e.monthly_usd >= 50) {
    action = 'remind'
    confidence = 55
  }

  return {
    subscription_id: e.subscription_id,
    merchant: e.merchant,
    action,
    confidence,
    rationale: dormant
      ? `${e.merchant} has not billed in ${e.days_since_charge} days at ${currencySymbol(e.currency)}${e.amount}/${e.cadence}.`
      : `${e.merchant} is billing normally at ${currencySymbol(e.currency)}${e.amount}/${e.cadence}.`,
    blast_radius: blast,
    savings_usd_monthly: action === 'cancel' || action === 'pause' ? e.monthly_usd : 0,
    requires_authorization: action === 'cancel' || action === 'pause',
    reasoned_by: 'fallback',
  }
}

const SYSTEM = `You are SHAMAR, an agent that decides whether to cancel paid subscriptions.

Cancellation is a one-way door. Re-subscribing may cost more than the current
price, and some services delete data permanently. Weigh what cancelling COSTS,
not only what it saves.

Return ONLY a JSON object, no prose:
{
  "action": "cancel" | "pause" | "remind" | "keep",
  "confidence": 0-100,
  "rationale": "one or two sentences, specific, no hedging",
  "blast_radius": {
    "data_loss": "none" | "recoverable" | "permanent",
    "access_loss": "solo" | "shared",
    "repurchase": "same_price" | "higher_price" | "unavailable",
    "irreversible": true | false,
    "notes": ["short factual findings"]
  }
}

Rules:
- "cancel" only when you would defend it to the account holder.
- Anything with permanent data loss is at most "remind".
- A long-held subscription may be on legacy pricing; treat repurchase as higher_price.
- Low cost plus low evidence is "keep", not "cancel".`

function extractJson(raw: string): any | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

// Constraints the model cannot argue its way past. Applied after every decision,
// model-sourced or not.
function applyGuardrails(d: Decision): Decision {
  const g = { ...d, blast_radius: { ...d.blast_radius } }

  if (g.blast_radius.data_loss === 'permanent' && g.action === 'cancel') {
    g.action = 'remind'
    g.blast_radius.notes.push('Downgraded from cancel: permanent data loss')
  }

  if (g.blast_radius.irreversible && g.action === 'cancel' && g.confidence < 85) {
    g.action = 'remind'
    g.blast_radius.notes.push(`Downgraded from cancel: irreversible at ${g.confidence}% confidence`)
  }

  g.confidence = Math.max(0, Math.min(100, Math.round(g.confidence)))
  g.requires_authorization = g.action === 'cancel' || g.action === 'pause'
  g.savings_usd_monthly = g.action === 'cancel' || g.action === 'pause' ? g.savings_usd_monthly : 0
  return g
}

export async function decide(e: Evidence): Promise<Decision> {
  const prior = priorFor(e.category)
  const user = `Subscription: ${e.merchant}
Category: ${e.category ?? 'unknown'}
Price: ${currencySymbol(e.currency)}${e.amount}/${e.cadence} (≈$${e.monthly_usd.toFixed(2)}/month)
Last charged: ${e.days_since_charge === null ? 'never recorded' : `${e.days_since_charge} days ago`}
First detected: ${e.days_since_detected} days ago
Category prior — data loss: ${prior.data_loss}, access: ${prior.access_loss}

Decide.`

  let parsed: any = null
  try {
    const raw = await complete(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
      { maxTokens: 400, temperature: 0.2 }
    )
    parsed = extractJson(raw)
  } catch (err) {
    console.warn('[reasoning] model call failed:', (err as Error).message)
  }

  if (!parsed || !parsed.action || !parsed.blast_radius) return applyGuardrails(fallbackDecision(e))

  const blast: BlastRadius = {
    data_loss: parsed.blast_radius.data_loss ?? prior.data_loss,
    access_loss: parsed.blast_radius.access_loss ?? prior.access_loss,
    repurchase: parsed.blast_radius.repurchase ?? 'same_price',
    irreversible: Boolean(parsed.blast_radius.irreversible),
    notes: Array.isArray(parsed.blast_radius.notes) ? parsed.blast_radius.notes.slice(0, 5) : [],
  }

  return applyGuardrails({
    subscription_id: e.subscription_id,
    merchant: e.merchant,
    action: parsed.action,
    confidence: Number(parsed.confidence) || 0,
    rationale: String(parsed.rationale ?? '').slice(0, 400),
    blast_radius: blast,
    savings_usd_monthly: e.monthly_usd,
    requires_authorization: true,
    reasoned_by: 'model',
  })
}

export async function persistDecision(d: Decision): Promise<void> {
  const evidence = [d.rationale, ...d.blast_radius.notes]
  await sql`DELETE FROM recommendations WHERE subscription_id = ${d.subscription_id}`
  await sql`
    INSERT INTO recommendations (subscription_id, action, confidence, evidence)
    VALUES (${d.subscription_id}, ${d.action}, ${d.confidence}, ${JSON.stringify(evidence)})
  `
}

// Deterministic pass with no model calls — safe to run inside the scan's time
// budget so recommendations exist immediately. The model pass runs separately.
export async function quickPass(dbUserId: string): Promise<number> {
  const evidence = await gatherEvidence(dbUserId)
  for (const e of evidence) await persistDecision(applyGuardrails(fallbackDecision(e)))
  return evidence.length
}

export async function reasonOverAll(
  dbUserId: string,
  opts: { persist?: boolean } = {}
): Promise<Decision[]> {
  const evidence = await gatherEvidence(dbUserId)
  const decisions: Decision[] = []

  for (const e of evidence) {
    const d = await decide(e)
    decisions.push(d)
    if (opts.persist) await persistDecision(d)
  }

  return decisions.sort((a, b) => b.savings_usd_monthly - a.savings_usd_monthly)
}
