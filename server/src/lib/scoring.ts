import { sql } from './db.js'
import { toUsd, currencySymbol } from './currency.js'

export type SignalWeight = {
  type: string
  value: number
  label: string
}

export function buildSignals(sub: {
  amount: number
  currency: string
  cadence: string
  last_charged: Date | null
  detected_at: Date
}): SignalWeight[] {
  const now = new Date()
  const daysSinceCharge = sub.last_charged
    ? (now.getTime() - new Date(sub.last_charged).getTime()) / (1000 * 60 * 60 * 24)
    : 999

  const signals: SignalWeight[] = []

  if (daysSinceCharge > 60) signals.push({ type: 'inactivity', value: 9, label: '60+ days since last charge' })
  else if (daysSinceCharge > 30) signals.push({ type: 'inactivity', value: 6, label: '30+ days since last charge' })
  else signals.push({ type: 'inactivity', value: 2, label: 'Recently active' })

  // Value thresholds compare a USD-normalized amount so non-USD subs (₦, €, £,
  // CELO) bucket correctly; the label shows the original currency.
  const priced = `${currencySymbol(sub.currency)}${sub.amount}`
  const usdValue = toUsd(sub.amount, sub.currency)
  if (usdValue > 50) signals.push({ type: 'high_value', value: 7, label: `High value: ${priced}` })
  else if (usdValue > 20) signals.push({ type: 'moderate_value', value: 4, label: `Moderate value: ${priced}` })
  else signals.push({ type: 'low_value', value: 1, label: `Low cost: ${priced}` })

  const daysSinceDetected = (now.getTime() - new Date(sub.detected_at).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceDetected > 180) signals.push({ type: 'long_standing', value: 5, label: 'Active 6+ months' })
  else if (daysSinceDetected > 60) signals.push({ type: 'established', value: 3, label: 'Active 2+ months' })
  else signals.push({ type: 'new', value: 1, label: 'Recently detected' })

  return signals
}

export function scoreSubscription(signals: SignalWeight[]): number {
  const total = signals.reduce((sum, s) => sum + s.value, 0)
  const max = signals.length * 10
  return Math.min(Math.round((total / max) * 100), 100)
}

export function recommendAction(
  confidence: number,
  signals: SignalWeight[]
): 'cancel' | 'pause' | 'remind' | 'keep' {
  const hasInactivity = signals.some((s) => s.type === 'inactivity' && s.value >= 6)
  if (confidence >= 75 && hasInactivity) return 'cancel'
  if (confidence >= 50 && hasInactivity) return 'pause'
  if (confidence >= 40) return 'remind'
  return 'keep'
}

// Scores all active subscriptions for a user and writes signals + recommendations to DB.
// Safe to call after a scan — runs in O(n) DB writes, no AI calls.
export async function runAnalyzeAll(dbUserId: string): Promise<number> {
  const subs = await sql`
    SELECT * FROM subscriptions WHERE user_id = ${dbUserId} AND status = 'active'
  ` as Array<{
    id: string
    name: string
    amount: number
    currency: string
    cadence: string
    last_charged: Date | null
    detected_at: Date
  }>

  for (const sub of subs) {
    const signals = buildSignals(sub)
    const confidence = scoreSubscription(signals)
    const action = recommendAction(confidence, signals)

    for (const sig of signals) {
      await sql`
        INSERT INTO signals (subscription_id, type, value, weight)
        VALUES (${sub.id}, ${sig.type}, ${sig.label}, ${sig.value})
        ON CONFLICT DO NOTHING
      `
    }

    await sql`DELETE FROM recommendations WHERE subscription_id = ${sub.id}`
    await sql`
      INSERT INTO recommendations (subscription_id, action, confidence, evidence)
      VALUES (${sub.id}, ${action}, ${confidence}, ${JSON.stringify(signals.map((s) => s.label))})
    `
  }

  return subs.length
}
