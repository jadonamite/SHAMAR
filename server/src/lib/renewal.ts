import { sql } from './db.js'
import { redis } from './cache.js'
import { nextRenewal } from './calendar.js'
import { currencySymbol } from './currency.js'
import { executeSubscriptionById } from './execution.js'
import { getUserTelegramChat, sendTelegram } from './telegram.js'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? ''
const API = `https://api.telegram.org/bot${TOKEN}`

// Notices go out at these hours before renewal. Silence escalates; the last
// window belongs to the agent.
export const NOTICE_HOURS = [120, 72, 48]
export const AUTO_CANCEL_HOURS = 36

export type NoticeState = {
  subscription_id: string
  merchant: string
  renewal_at: string
  notices_sent: number
  last_notice_at: string | null
  decision: 'cancel' | 'renew' | null
  decided_at: string | null
  auto_cancelled: boolean
}

const key = (id: string) => `renewal:${id}`

export async function getNotice(subId: string): Promise<NoticeState | null> {
  return redis.get<NoticeState>(key(subId))
}

async function putNotice(s: NoticeState): Promise<void> {
  await redis.set(key(s.subscription_id), s, { ex: 60 * 60 * 24 * 60 })
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000
}

function noticeText(s: NoticeState, price: string, hoursLeft: number): string {
  const when = new Date(s.renewal_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  const nth = s.notices_sent + 1
  const urgency =
    nth === 1
      ? `renews on the ${when}.`
      : `still renews on the ${when}. This is reminder ${nth} of ${NOTICE_HOURS.length}.`

  return [
    `*${s.merchant.toUpperCase()}* ${urgency}`,
    ``,
    `${price}`,
    ``,
    nth >= NOTICE_HOURS.length
      ? `No reply yet. If you say nothing, SHAMAR cancels this ${AUTO_CANCEL_HOURS} hours before renewal.`
      : `Reply below. Silence means SHAMAR cancels it ${AUTO_CANCEL_HOURS} hours before renewal.`,
    ``,
    `_${Math.round(hoursLeft)}h remaining._`,
  ].join('\n')
}

export async function sendNotice(s: NoticeState, price: string, hoursLeft: number, chatId?: string | null): Promise<boolean> {
  const targetChatId = chatId || DEFAULT_CHAT_ID
  if (!TOKEN || !targetChatId) return false
  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: noticeText(s, price, hoursLeft),
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Cancel subscription', callback_data: `cancel:${s.subscription_id}` },
              { text: 'Keep subscription', callback_data: `renew:${s.subscription_id}` },
            ],
          ],
        },
      }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } = { inline_keyboard: [] }
): Promise<boolean> {
  if (!TOKEN || !chatId) return false
  try {
    const res = await fetch(`${API}/editMessageText`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function ack(callbackId: string, text?: string): Promise<void> {
  try {
    const payload: Record<string, any> = { callback_query_id: callbackId }
    if (text) {
      payload.text = text
      payload.show_alert = false
    }
    await fetch(`${API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    /* the decision is already recorded; a failed ack only affects the spinner */
  }
}

/**
 * Handles an interactive Telegram callback query (button press)
 */
export async function handleCallbackQuery(cb: Record<string, any>): Promise<{ subscription_id: string; decision: string } | null> {
  if (!cb?.data) return null

  const [verb, subId] = String(cb.data).split(':')
  if (verb !== 'cancel' && verb !== 'renew') return null

  const chatId = cb.message?.chat?.id || cb.from?.id
  const messageId = cb.message?.message_id

  const state = await getNotice(subId)
  if (!state) {
    await ack(cb.id, 'Notice has expired.')
    if (chatId && messageId) {
      await editTelegramMessage(
        chatId,
        messageId,
        `*Notice Expired*\n\nThis renewal alert has expired.`
      )
    }
    if (chatId) {
      await sendTelegram(
        `*Notice Expired*\n\nThis renewal alert has expired. Reply status to view active subscriptions.`,
        String(chatId),
        messageId ? { replyToMessageId: messageId } : undefined
      )
    }
    return null
  }
  if (state.decision) {
    await ack(cb.id, `Already ${state.decision === 'renew' ? 'kept' : 'cancelled'}.`)
    if (chatId && messageId) {
      await editTelegramMessage(
        chatId,
        messageId,
        [
          `*${state.merchant.toUpperCase()}*`,
          ``,
          `Decision: *${state.decision === 'renew' ? 'Kept' : 'Cancellation requested'}*`,
          `This renewal has already been resolved.`,
        ].join('\n')
      )
    }
    if (chatId) {
      await sendTelegram(
        `*Subscription Already ${state.decision === 'renew' ? 'Kept' : 'Cancelled'}*\n\n*${state.merchant}* was already marked as ${state.decision === 'renew' ? 'kept' : 'cancelled'}.\n\nReply stop anytime to pause cancellations.`,
        String(chatId),
        messageId ? { replyToMessageId: messageId } : undefined
      )
    }
    return null
  }

  state.decision = verb as 'cancel' | 'renew'
  state.decided_at = new Date().toISOString()
  await putNotice(state)

  if (verb === 'renew') {
    // Immediate popup toast on tap
    await ack(cb.id, `Keeping ${state.merchant}.`)

    // 1. Edit original message in place to remove buttons and show decision
    if (chatId && messageId) {
      await editTelegramMessage(
        chatId,
        messageId,
        [
          `*${state.merchant.toUpperCase()}*`,
          ``,
          `Decision: *Kept*`,
          `Your subscription will renew as normal.`,
          `We will notify you again before the next billing cycle.`,
        ].join('\n')
      )
    }

    // 2. Send explicit confirmation reply into chat
    if (chatId) {
      await sendTelegram(
        `*Subscription Kept*\n\n*${state.merchant}* will continue without interruption. No cancellation request was sent.\n\nReply stop anytime to pause cancellations.`,
        String(chatId),
        messageId ? { replyToMessageId: messageId } : undefined
      )
    }
  } else {
    // Immediate popup toast on tap
    await ack(cb.id, `Cancelling ${state.merchant}...`)

    // 1. Edit original message in place to remove buttons
    if (chatId && messageId) {
      await editTelegramMessage(
        chatId,
        messageId,
        [
          `*${state.merchant.toUpperCase()}*`,
          ``,
          `Decision: *Cancellation requested*`,
          `Processing cancellation dispatch...`,
        ].join('\n')
      )
    }

    // Look up owner of this subscription
    const [subRow] = await sql`
      SELECT s.id, s.merchant, s.user_id, u.privy_did, u.email
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ${subId}
    `

    if (subRow) {
      // Unified execution pipeline: checks guardrails, Base grant, halt state, emails merchant, signs attestation
      const dispatchRes = await executeSubscriptionById({
        subscriptionId: subId,
        trigger: 'telegram_button',
        dbUserId: subRow.user_id,
        userPrivyDid: subRow.privy_did,
        accountEmail: subRow.email,
        apply: true,
      })

      if (chatId) {
        if (dispatchRes.status === 'sent') {
          await sendTelegram(
            `*Cancellation Dispatched*\n\nCancellation request sent for *${state.merchant}*.\n\nReply stop anytime to halt further action.`,
            String(chatId),
            messageId ? { replyToMessageId: messageId } : undefined
          )
        } else if (dispatchRes.status === 'blocked_unauthorized') {
          await sendTelegram(
            `*Cancellation Blocked*\n\n*${state.merchant}*: ${dispatchRes.reason || 'Unauthorized'}.`,
            String(chatId),
            messageId ? { replyToMessageId: messageId } : undefined
          )
        } else {
          await sendTelegram(
            `*Cancellation Status*\n\n*${state.merchant}*: ${dispatchRes.status} (${dispatchRes.reason || 'Guardrail protected'}).`,
            String(chatId),
            messageId ? { replyToMessageId: messageId } : undefined
          )
        }
      }
    } else {
      // Demo / test notice acknowledgment
      if (chatId) {
        await sendTelegram(
          `*Cancellation Request Confirmed*\n\n*${state.merchant}* cancellation confirmed. Test notice button response verified.\n\nReply stop anytime to pause cancellations.`,
          String(chatId),
          messageId ? { replyToMessageId: messageId } : undefined
        )
      }
    }
  }
  return { subscription_id: subId, decision: verb }
}

// Reads button presses using unified Telegram poller
export async function pollDecisions(): Promise<Array<{ subscription_id: string; decision: string }>> {
  // pollDecisions now delegates through the unified Telegram poller
  // to avoid update collisions between separate offsets
  return []
}

export type TickResult = {
  checked: number
  notices_sent: number
  decisions_applied: Array<{ subscription_id: string; decision: string }>
  auto_cancelled: string[]
  states: NoticeState[]
}

// One pass of the renewal loop: apply any button presses, send notices that
// have come due, and cancel anything still undecided inside the final window.
// Every cancellation goes through the unified executeDecision pipeline.
export async function tick(dbUserId: string, opts: { apply?: boolean } = {}): Promise<TickResult> {
  const apply = opts.apply ?? false
  const decisions = await pollDecisions()

  const [userRow] = await sql`SELECT privy_did, email FROM users WHERE id = ${dbUserId}`
  const userChatId = await getUserTelegramChat(dbUserId)

  const subs = (await sql`
    SELECT id, merchant, amount, currency, cadence, last_charged
    FROM subscriptions
    WHERE user_id = ${dbUserId} AND status = 'active' AND amount > 0
  `) as Array<Record<string, any>>

  const states: NoticeState[] = []
  const autoCancelled: string[] = []
  let sent = 0

  for (const sub of subs) {
    const due = nextRenewal(sub.last_charged, sub.cadence)
    if (!due) continue

    let state = await getNotice(sub.id)
    if (!state) {
      state = {
        subscription_id: sub.id,
        merchant: sub.merchant,
        renewal_at: due.toISOString(),
        notices_sent: 0,
        last_notice_at: null,
        decision: null,
        decided_at: null,
        auto_cancelled: false,
      }
    }

    const left = hoursUntil(state.renewal_at)
    if (state.decision || state.auto_cancelled) {
      states.push(state)
      continue
    }

    // Auto-cancel threshold: within the last 36 hours.
    // Safety check (B6): Do NOT auto-cancel if no Telegram notice was ever confirmed delivered (notices_sent === 0).
    // Silence only implies consent if the user was actually notified.
    if (left <= AUTO_CANCEL_HOURS && left > 0) {
      if (state.notices_sent === 0) {
        console.warn(`[renewal] Skipping auto-cancel for ${sub.merchant}: no notices were confirmed delivered to user.`)
        states.push(state)
        continue
      }

      if (apply && userRow) {
        // Single unified cancellation execution
        const dispatchRes = await executeSubscriptionById({
          subscriptionId: sub.id,
          trigger: 'auto_cancel',
          dbUserId,
          userPrivyDid: userRow.privy_did,
          accountEmail: userRow.email,
          apply: true,
          rationale: `${sub.merchant} auto-cancelled: ${state.notices_sent} notice(s) went unanswered ${AUTO_CANCEL_HOURS}h before renewal.`,
        })

        if (dispatchRes.status === 'sent') {
          state.auto_cancelled = true
          state.decided_at = new Date().toISOString()
          await putNotice(state)
          autoCancelled.push(sub.merchant)
        } else {
          console.warn(`[renewal] Auto-cancel blocked for ${sub.merchant}:`, dispatchRes.reason)
        }
      } else {
        autoCancelled.push(sub.merchant)
      }
      states.push(state)
      continue
    }

    const threshold = NOTICE_HOURS[state.notices_sent]
    if (threshold !== undefined && left <= threshold) {
      if (apply) {
        const price = `${currencySymbol(sub.currency)}${sub.amount} / ${sub.cadence}`
        if (await sendNotice(state, price, left, userChatId)) {
          state.notices_sent += 1
          state.last_notice_at = new Date().toISOString()
          await putNotice(state)
          sent++
        }
      } else {
        sent++
      }
    }

    states.push(state)
  }

  return {
    checked: subs.length,
    notices_sent: sent,
    decisions_applied: decisions,
    auto_cancelled: autoCancelled,
    states,
  }
}

// Demo helper: places a subscription at a chosen number of hours before its
// renewal so the escalation can be exercised without waiting days.
export async function stageNotice(
  subId: string,
  merchant: string,
  hoursOut: number,
  noticesSent = 0
): Promise<NoticeState> {
  const state: NoticeState = {
    subscription_id: subId,
    merchant,
    renewal_at: new Date(Date.now() + hoursOut * 3_600_000).toISOString(),
    notices_sent: noticesSent,
    last_notice_at: null,
    decision: null,
    decided_at: null,
    auto_cancelled: false,
  }
  await putNotice(state)
  return state
}
