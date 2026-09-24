import { sql } from './db.js'
import { sendEmail } from './email.js'
import { logAction } from './actions.js'
import { SUBSCRIPTION_REGISTRY } from './subscriptions-registry.js'
import { currencySymbol } from './currency.js'
import type { Decision } from './reasoning.js'

export type DispatchStatus =
  | 'sent'
  | 'dry_run'
  | 'skipped_duplicate'
  | 'blocked_unauthorized'
  | 'blocked_action'
  | 'blocked_by_rail'
  | 'failed'

export type DispatchResult = {
  subscription_id: string
  merchant: string
  status: DispatchStatus
  recipient: string | null
  reason: string
  reversible: boolean
  attestation?: unknown
}

const RECIPIENT_OVERRIDE = process.env.DISPATCH_RECIPIENT ?? ''

// Merchants publish cancellation addresses inconsistently; billing@ is the most
// widely honoured. The registry gives us the canonical domain.
export function cancellationRecipient(merchant: string): string | null {
  if (RECIPIENT_OVERRIDE) return RECIPIENT_OVERRIDE
  const service = SUBSCRIPTION_REGISTRY.find(
    (s) => s.name.toLowerCase() === merchant.toLowerCase()
  )
  if (!service || service.domains.length === 0) return null
  return `billing@${service.domains[0]}`
}

function cancellationEmail(opts: {
  merchant: string
  amount: number
  currency: string
  cadence: string
  accountEmail: string
  rationale: string
}): { subject: string; html: string } {
  const price = `${currencySymbol(opts.currency)}${opts.amount}/${opts.cadence}`
  return {
    subject: `Cancellation request — ${opts.merchant} subscription`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#111">
  <p>Hello,</p>
  <p>Please cancel the ${opts.merchant} subscription associated with
  <strong>${opts.accountEmail}</strong>, currently billed at ${price}.</p>
  <p>Please confirm the cancellation date and that no further charges will be made.
  If you require any additional detail to process this, reply to this address.</p>
  <p>Thank you.</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <p style="color:#666;font-size:12px">Sent by SHAMAR on behalf of the account holder.
  Basis for this request: ${opts.rationale}</p>
</div>`,
  }
}

// A cancellation already dispatched and not reversed must never be sent twice.
async function alreadyDispatched(subscriptionId: string): Promise<boolean> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subscriptionId)
  if (!isUuid) return false
  const rows = await sql`
    SELECT id FROM actions
    WHERE subscription_id = ${subscriptionId}
      AND type = 'cancel'
      AND executed_at IS NOT NULL
      AND reversed_at IS NULL
    LIMIT 1
  `
  return rows.length > 0
}

export async function dispatchCancellation(opts: {
  decision: Decision
  userPrivyDid: string
  dbUserId: string
  accountEmail: string
  authorized: boolean
  apply: boolean
}): Promise<DispatchResult> {
  const { decision, userPrivyDid, dbUserId, accountEmail, authorized, apply } = opts
  const base = {
    subscription_id: decision.subscription_id,
    merchant: decision.merchant,
    reversible: false,
  }

  if (decision.action !== 'cancel') {
    return { ...base, status: 'blocked_action', recipient: null, reason: `Decision was ${decision.action}, not cancel`, reversible: true }
  }

  if (await alreadyDispatched(decision.subscription_id)) {
    return { ...base, status: 'skipped_duplicate', recipient: null, reason: 'Cancellation already dispatched and not reversed' }
  }

  const recipient = cancellationRecipient(decision.merchant)
  if (!recipient) {
    return { ...base, status: 'failed', recipient: null, reason: `No cancellation address known for ${decision.merchant}` }
  }

  if (!authorized) {
    return { ...base, status: 'blocked_unauthorized', recipient, reason: 'On-chain authorization for shamar.cancel is absent or expired' }
  }

  const [sub] = await sql`
    SELECT amount, currency, cadence FROM subscriptions
    WHERE id = ${decision.subscription_id} AND user_id = ${dbUserId}
  `
  if (!sub) {
    return { ...base, status: 'failed', recipient, reason: 'Subscription not found' }
  }

  const mail = cancellationEmail({
    merchant: decision.merchant,
    amount: Number(sub.amount),
    currency: sub.currency,
    cadence: sub.cadence,
    accountEmail,
    rationale: decision.rationale,
  })

  if (!apply) {
    return { ...base, status: 'dry_run', recipient, reason: `Would send "${mail.subject}" to ${recipient}` }
  }

  const delivered = await sendEmail({ to: recipient, subject: mail.subject, html: mail.html })
  if (!delivered) {
    return { ...base, status: 'failed', recipient, reason: 'Resend rejected the message or no API key is configured' }
  }

  // Written only after delivery, so a failed send leaves no record claiming success.
  const { attestation } = await logAction({
    subscriptionId: decision.subscription_id,
    actionType: 'cancel',
    triggeredBy: 'policy',
    userPrivyDid,
    reversible: false,
  })

  await sql`UPDATE subscriptions SET status = 'cancelled' WHERE id = ${decision.subscription_id}`

  return { ...base, status: 'sent', recipient, reason: `Cancellation request delivered to ${recipient}`, attestation }
}
