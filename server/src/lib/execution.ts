import { sql } from './db.js'
import { applyGuardrails, type Decision, fallbackDecision, gatherEvidence } from './reasoning.js'
import { dispatchCancellation, cancellationRecipient, type DispatchResult } from './dispatch.js'
import { resolveAuthorization, type Authorization } from './agent.js'
import { getHaltState, sendTelegram, dispatchReport, getUserTelegramChat, type HaltState } from './telegram.js'
import { calendarClientFor, writeCancellationEvent } from './calendar.js'
import { currencySymbol } from './currency.js'

export type ExecutionTrigger = 'manual' | 'auto_cancel' | 'telegram_button' | 'policy'

export type ExecuteDecisionParams = {
  decision: Decision
  trigger: ExecutionTrigger
  dbUserId: string
  userPrivyDid: string
  accountEmail?: string
  apply?: boolean
}

export type ExecuteSubscriptionParams = {
  subscriptionId: string
  trigger: ExecutionTrigger
  dbUserId: string
  userPrivyDid: string
  accountEmail?: string
  apply?: boolean
  rationale?: string
}

/**
 * Unified execution pipeline. EVERY cancellation trigger must flow through this function.
 *
 * Enforces:
 * 1. Blast-radius guardrails (permanent data loss, 85% confidence threshold for irreversible)
 * 2. On-chain authorization check (Base mainnet SHAMARPolicy, with local fallback)
 * 3. Telegram halt check (/stop and /resume per-user and globally)
 * 4. Execution rail dispatch (email to merchant via Resend, signed EIP-191 record via logAction)
 * 5. Downstream notifications (Google Calendar event + Telegram report)
 */
export async function executeDecision(params: ExecuteDecisionParams): Promise<DispatchResult> {
  const { decision, trigger, dbUserId, userPrivyDid, accountEmail, apply = false } = params

  // 1. Enforce Guardrails
  const guarded = applyGuardrails(decision)
  if (guarded.action !== 'cancel') {
    return {
      subscription_id: decision.subscription_id,
      merchant: decision.merchant,
      status: 'blocked_action',
      recipient: cancellationRecipient(decision.merchant),
      reason: `Blocked by guardrails: ${guarded.blast_radius.notes.join('; ') || guarded.action}`,
      reversible: true,
    }
  }

  // 2. Enforce On-Chain Authorization
  const auth: Authorization = await resolveAuthorization(dbUserId)
  if (!auth.granted) {
    return {
      subscription_id: decision.subscription_id,
      merchant: decision.merchant,
      status: 'blocked_unauthorized',
      recipient: cancellationRecipient(decision.merchant),
      reason: auth.reason,
      reversible: false,
    }
  }

  // 3. Enforce Telegram Halt State
  const control: HaltState = await getHaltState(dbUserId)
  if (control.halted) {
    return {
      subscription_id: decision.subscription_id,
      merchant: decision.merchant,
      status: 'blocked_unauthorized',
      recipient: cancellationRecipient(decision.merchant),
      reason: 'Halted from Telegram — /resume to re-authorize',
      reversible: false,
    }
  }

  // Resolve account email if not passed
  let effectiveEmail = accountEmail || process.env.NOTIFY_EMAIL_TO || ''
  if (!effectiveEmail) {
    try {
      const [u] = await sql`SELECT email FROM users WHERE id = ${dbUserId}`
      effectiveEmail = (u?.email as string) || ''
    } catch {
      // ignore
    }
  }

  // 4. Dispatch via Cancellation Rail (Email adapter)
  const result = await dispatchCancellation({
    decision: guarded,
    userPrivyDid,
    dbUserId,
    accountEmail: effectiveEmail,
    authorized: true, // Already verified above
    apply,
  })

  // 5. Post-Dispatch Notifications (only when actually sent)
  if (result.status === 'sent') {
    try {
      // Calendar notification
      const calendar = await calendarClientFor(userPrivyDid).catch(() => null)
      if (calendar) {
        await writeCancellationEvent(
          calendar,
          { id: guarded.subscription_id, merchant: guarded.merchant },
          result.recipient ?? ''
        ).catch(() => {})
      }

      // Telegram report
      const userChatId = await getUserTelegramChat(dbUserId)
      const [sub] = await sql`
        SELECT amount, currency, cadence FROM subscriptions WHERE id = ${guarded.subscription_id}
      `
      const priceFormatted = sub
        ? `${currencySymbol(sub.currency)}${sub.amount}/${sub.cadence}`
        : 'active plan'

      await sendTelegram(
        dispatchReport({
          merchant: guarded.merchant,
          recipient: result.recipient ?? '',
          amount: priceFormatted,
          rationale: guarded.rationale,
          attested: Boolean(result.attestation),
        }),
        userChatId
      ).catch(() => {})
    } catch (err) {
      console.warn('[execute] post-dispatch notification failed:', (err as Error).message)
    }
  }

  return result
}

/**
 * Execute cancellation for a subscription ID.
 * Looks up existing recommendation or constructs a policy decision, then runs through executeDecision.
 */
export async function executeSubscriptionById(params: ExecuteSubscriptionParams): Promise<DispatchResult> {
  const { subscriptionId, trigger, dbUserId, userPrivyDid, accountEmail, apply = false, rationale } = params

  const [sub] = await sql`
    SELECT id, merchant, amount, currency, cadence, category, last_charged, detected_at
    FROM subscriptions
    WHERE id = ${subscriptionId} AND user_id = ${dbUserId}
  `
  if (!sub) {
    return {
      subscription_id: subscriptionId,
      merchant: 'unknown',
      status: 'failed',
      recipient: null,
      reason: 'Subscription not found',
      reversible: false,
    }
  }

  // Check if a saved decision exists in recommendations
  const [saved] = await sql`
    SELECT action, confidence, evidence, decision
    FROM recommendations
    WHERE subscription_id = ${subscriptionId}
  `

  let decision: Decision
  if (saved?.decision && typeof saved.decision === 'object') {
    decision = {
      ...(saved.decision as Decision),
      action: 'cancel',
      rationale: rationale || (saved.decision as Decision).rationale,
    }
  } else {
    // Construct valid decision for trigger
    const defaultRationale =
      rationale ||
      (trigger === 'telegram_button'
        ? `Cancellation initiated by user via Telegram notice.`
        : trigger === 'auto_cancel'
        ? `Auto-cancelled 36h before renewal after unanswered escalation notices.`
        : `Cancelled under automated policy rule.`)

    decision = {
      subscription_id: subscriptionId,
      merchant: sub.merchant,
      action: 'cancel',
      confidence: 90,
      rationale: defaultRationale,
      blast_radius: {
        data_loss: 'recoverable',
        access_loss: 'solo',
        repurchase: 'same_price',
        irreversible: false,
        notes: [defaultRationale],
      },
      savings_usd_monthly: Number(sub.amount),
      requires_authorization: true,
      reasoned_by: 'fallback',
    }
  }

  return executeDecision({
    decision,
    trigger,
    dbUserId,
    userPrivyDid,
    accountEmail,
    apply,
  })
}
