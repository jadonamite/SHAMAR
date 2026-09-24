import { sql } from '../db.js'
import { cardRail } from './card.js'
import { emailRail } from './email.js'
import type { ExecutionRail, RailKind } from './types.js'

export * from './card.js'
export * from './email.js'
export * from './types.js'

const rails: Record<RailKind, ExecutionRail> = {
  email: emailRail,
  card: cardRail,
}

// Unknown or missing values fall back to email, the default tier.
export function getRail(kind?: string | null): ExecutionRail {
  const normalized = (kind || 'email').toLowerCase()
  return normalized in rails ? rails[normalized as RailKind] : emailRail
}

// The rail stored on the subscription. Falls back to email if the row or the
// column is missing (for example before migration_v6 has run).
export async function railForSubscription(subscriptionId: string): Promise<RailKind> {
  try {
    const [row] = await sql`SELECT rail FROM subscriptions WHERE id = ${subscriptionId}`
    return getRail(row?.rail as string | undefined).kind
  } catch {
    return 'email'
  }
}
