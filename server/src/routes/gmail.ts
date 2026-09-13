import { Hono } from 'hono'
import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import { sql, getOrCreateUser } from '../lib/db.js'
import {
  getScanLock,
  releaseScanLock,
  storeGmailTokens,
  getGmailTokens,
  hasGmailConnected,
  getGmailSync,
  setGmailSync,
} from '../lib/cache.js'
import { runAnalyzeAll } from '../lib/scoring.js'
import {
  lookupService,
  type SubscriptionCategory,
} from '../lib/subscriptions-registry.js'

const app = new Hono()

// ---------------------------------------------------------------------------
// Merchant normalization
// ---------------------------------------------------------------------------

function extractRootDomain(email: string): string {
  // Strip display name: "Netflix <no-reply@netflix.com>" → "no-reply@netflix.com"
  const address = email.replace(/^.*</, '').replace(/>.*$/, '').trim().toLowerCase()
  const domainMatch = address.match(/@([\w.-]+\.\w+)/)
  return domainMatch ? domainMatch[1] : address
}

/**
 * Resolve a sender header to {merchant, category}. Uses the subscription
 * registry as the source of truth; falls back to a title-cased version of
 * the display name / domain when the sender is unknown.
 */
export function resolveMerchant(raw: string): { name: string; category: SubscriptionCategory | null } {
  const hit = lookupService(raw)
  if (hit) return { name: hit.name, category: hit.category }

  // Unknown sender — fall back to title-casing the display name or domain
  const displayName = raw.replace(/<.*>/, '').trim()
  if (displayName && !displayName.includes('@')) {
    const cased = displayName
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    return { name: cased, category: null }
  }
  const domain = extractRootDomain(raw)
  const base = domain.split('.')[0] ?? raw
  return { name: base.charAt(0).toUpperCase() + base.slice(1).toLowerCase(), category: null }
}

// Back-compat for callers that only need the name string (e.g. /gmail/parse)
export function normalizeMerchant(raw: string): string {
  return resolveMerchant(raw).name
}

// ---------------------------------------------------------------------------
// Email detection helpers
// ---------------------------------------------------------------------------

export type Cadence = 'monthly' | 'yearly' | 'weekly' | 'daily'

// Words that indicate a real charge/receipt rather than a notification.
const BILLING_KEYWORDS =
  /\b(receipt|invoice|payment|paid|billed|charged?|subscription|renew(?:s|ed|al)?|order\s+confirmation|transaction|amount\s+due)\b/i

// Stronger language that, on its own, identifies a recurring subscription —
// used to accept a single email in Balanced mode.
const EXPLICIT_SUBSCRIPTION =
  /\b(subscription|renews?\s+(?:on|automatically)|auto[-\s]?renew|billing\s+cycle|next\s+(?:billing|payment)|recurring|membership)\b/i

// Subjects that look like account/notification noise — rejected unless the
// subject also carries billing language.
const NON_BILLING_SUBJECT =
  /\b(sign[-\s]?in|log[-\s]?in|security\s+alert|verify|verification|confirm\s+your|password|one[-\s]?time|otp|2fa|new\s+device|unusual\s+activity|comment(?:ed)?|mention(?:ed)?|liked|followed|digest|newsletter|welcome|get\s+started)\b/i

export function classifyBilling(subject: string, body: string): { isBilling: boolean; explicit: boolean } {
  const text = `${subject}\n${body}`
  if (NON_BILLING_SUBJECT.test(subject) && !BILLING_KEYWORDS.test(subject)) {
    return { isBilling: false, explicit: false }
  }
  return { isBilling: BILLING_KEYWORDS.test(text), explicit: EXPLICIT_SUBSCRIPTION.test(text) }
}

type Money = { amount: number; currency: string; index: number }

const CURRENCY_AMOUNT =
  /(\$|USD|₦|NGN|€|EUR|£|GBP)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi

// Words the actual charge sits next to. Used to pick the right number when an
// email contains several amounts (promos, taxes, crossed-out prices).
const AMOUNT_ANCHOR =
  /\b(grand\s+total|total|subtotal|amount\s+(?:due|charged|paid)?|charged|you\s+paid|payment\s+of|billed)\b/gi

function toCurrency(symbol: string): string {
  const s = symbol.toUpperCase()
  if (s === '$' || s === 'USD') return 'USD'
  if (s === '₦' || s === 'NGN') return 'NGN'
  if (s === '€' || s === 'EUR') return 'EUR'
  return 'GBP'
}

function parseAllAmounts(text: string): Money[] {
  const out: Money[] = []
  for (const m of text.matchAll(CURRENCY_AMOUNT)) {
    const amount = parseFloat(m[2].replace(/,/g, ''))
    if (amount > 0) out.push({ amount, currency: toCurrency(m[1]), index: m.index ?? 0 })
  }
  return out
}

// Billing-anchored extraction: prefer the amount adjacent to a "total/charged"
// label; otherwise fall back to the largest amount (the charge usually beats
// promo/tax lines). Returns null when no positive amount is present.
export function extractBillingAmount(text: string): { amount: number; currency: string } | null {
  const amounts = parseAllAmounts(text)
  if (amounts.length === 0) return null

  const anchors = [...text.matchAll(AMOUNT_ANCHOR)].map((a) => a.index ?? 0)
  if (anchors.length > 0) {
    let best: Money | null = null
    let bestDist = Infinity
    for (const money of amounts) {
      for (const anchor of anchors) {
        const dist = Math.abs(money.index - anchor)
        if (dist < bestDist) { bestDist = dist; best = money }
      }
    }
    if (best && bestDist <= 80) return { amount: best.amount, currency: best.currency }
  }

  const largest = amounts.reduce((p, c) => (c.amount > p.amount ? c : p))
  return { amount: largest.amount, currency: largest.currency }
}

// Cadence guessed from email language — only used when there's a single receipt.
export function detectCadence(text: string): Cadence {
  if (/annual|yearly|per\s+year|\/\s*year|\byr\b/i.test(text)) return 'yearly'
  if (/weekly|per\s+week|\/\s*week/i.test(text)) return 'weekly'
  if (/daily|per\s+day|\/\s*day/i.test(text)) return 'daily'
  return 'monthly'
}

// Cadence inferred from the spacing between repeat receipts (the reliable
// signal). Mirrors the wallet detector's interval logic.
export function cadenceFromDates(isoDates: string[]): Cadence | null {
  if (isoDates.length < 2) return null
  const days = isoDates
    .map((d) => new Date(d).getTime() / 86_400_000)
    .sort((a, b) => a - b)
  const intervals = days.slice(1).map((d, i) => d - days[i]).sort((a, b) => a - b)
  const median = intervals[Math.floor(intervals.length / 2)]
  if (median >= 5 && median <= 10) return 'weekly'
  if (median >= 320 && median <= 400) return 'yearly'
  if (median >= 11) return 'monthly'
  return 'monthly'
}

// ---------------------------------------------------------------------------
// Email body extraction
// ---------------------------------------------------------------------------

function decodeBase64Url(encoded: string): string {
  return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function extractBodyFromParts(parts: gmail_v1.Schema$MessagePart[]): string {
  let plainText = ''
  let htmlText = ''
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      plainText += decodeBase64Url(part.body.data) + '\n'
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      htmlText += decodeBase64Url(part.body.data) + '\n'
    } else if (part.parts) {
      plainText += extractBodyFromParts(part.parts)
    }
  }
  return plainText || (htmlText ? stripHtml(htmlText) : '')
}

function getEmailBody(payload: gmail_v1.Schema$MessagePart): string {
  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data)
    return payload.mimeType === 'text/html' ? stripHtml(raw) : raw
  }
  if (payload.parts) return extractBodyFromParts(payload.parts)
  return ''
}

// ---------------------------------------------------------------------------
// OAuth client factory
// ---------------------------------------------------------------------------

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI ?? 'http://localhost:3001/gmail/callback'
  )
}

// ---------------------------------------------------------------------------
// GET /gmail/status
// ---------------------------------------------------------------------------

app.get('/status', async (c) => {
  const userId = c.req.query('user_id') ?? c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'user_id required' }, 400)
  const connected = await hasGmailConnected(userId)
  return c.json({ connected })
})

// ---------------------------------------------------------------------------
// GET /gmail/auth
// ---------------------------------------------------------------------------

app.get('/auth', (c) => {
  const userId = c.req.query('user_id')
  if (!userId) return c.json({ error: 'user_id required' }, 400)

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return c.json(
      { error: 'Gmail OAuth not configured.' },
      503
    )
  }

  const oauth2Client = getOAuthClient()
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state: userId,
  })

  return c.redirect(authUrl)
})

// ---------------------------------------------------------------------------
// GET /gmail/callback
// ---------------------------------------------------------------------------

app.get('/callback', async (c) => {
  const code = c.req.query('code')
  const userId = c.req.query('state')
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'

  if (!code || !userId) {
    return c.redirect(`${frontendUrl}/dashboard?error=oauth_failed`)
  }

  try {
    const oauth2Client = getOAuthClient()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      return c.redirect(`${frontendUrl}/dashboard?error=no_refresh_token`)
    }

    await getOrCreateUser(userId)
    await storeGmailTokens(userId, {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? undefined,
    })

    return c.redirect(`${frontendUrl}/dashboard?connected=gmail`)
  } catch (err) {
    console.error('[Gmail OAuth] Callback error:', (err as Error).message)
    return c.redirect(`${frontendUrl}/dashboard?error=oauth_failed`)
  }
})

// ---------------------------------------------------------------------------
// POST /gmail/scan — main detection pipeline
// ---------------------------------------------------------------------------

// Content-based candidate query. We pull anything that looks like a purchase or
// billing email from ANY sender — Gmail's own `category:purchases` classifier
// plus billing-language subjects — and let classifyBilling + recurrence grouping
// decide downstream. The registry is no longer a gate; it only enriches naming
// and category after detection, so subscriptions outside the registry are caught.
const GMAIL_QUERY =
  'category:purchases OR subject:(receipt OR invoice OR subscription OR renewal OR renews OR "payment received" OR billed OR "your plan" OR "order confirmation")'

const MAX_RESULTS = 200
const BATCH_SIZE = 15

app.post('/scan', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const debug = c.req.query('debug') === '1'
  const t0 = Date.now()
  const log = (...args: unknown[]) => console.log('[gmail/scan]', ...args)

  const acquired = await getScanLock(userId)
  if (!acquired) {
    return c.json({ error: 'Scan already in progress. Try again in 2 minutes.' }, 429)
  }

  const dbUserId = await getOrCreateUser(userId)
  const tokens = await getGmailTokens(userId)
  if (!tokens?.refresh_token) {
    await releaseScanLock(userId)
    return c.json({ error: 'Gmail not connected', code: 'GMAIL_NOT_CONNECTED' }, 400)
  }

  log('start', { userId, dbUserId, hasAccessToken: !!tokens.access_token, query_len: GMAIL_QUERY.length })

  try {
    const oauth2Client = getOAuthClient()
    oauth2Client.setCredentials(tokens)

    oauth2Client.on('tokens', async (newTokens) => {
      if (newTokens.refresh_token) {
        await storeGmailTokens(userId, {
          refresh_token: newTokens.refresh_token,
          access_token: newTokens.access_token ?? undefined,
        })
      }
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // --- Incremental scan window ---
    // First scan backfills 1 year; later scans only fetch mail `after:` the last
    // completed run; a scan cut short by the time budget resumes from its saved
    // pageToken instead of restarting. Reprocessing a page is safe — Phase 2
    // upserts idempotently.
    const sync = await getGmailSync(userId)
    const scanStartedAt = Math.floor(t0 / 1000)
    const resuming = !!(sync.resumeToken && sync.resumeQuery)
    const query = resuming
      ? sync.resumeQuery!
      : sync.lastCompletedAt
        ? `${GMAIL_QUERY} after:${sync.lastCompletedAt}`
        : `${GMAIL_QUERY} newer_than:1y`
    log('window', { resuming, lastCompletedAt: sync.lastCompletedAt ?? null, query_len: query.length })

    let detected = 0       // emails that pass the billing-intent gate
    let noAmount = 0       // billing emails with no parseable amount
    let fetchErrors = 0
    let dbErrors = 0
    const rejectedSamples: Array<{ subject: string; from: string; reason: string }> = []
    const acceptedSamples: Array<{ subject: string; from: string; merchant: string; amount: number; currency: string }> = []

    type Candidate = {
      merchant: string
      category: SubscriptionCategory | null
      amount: number
      currency: string
      date: string
      cadenceHint: Cadence
      explicit: boolean
    }
    const candidates: Candidate[] = []

    // --- Phase 1: interleaved list + fetch, time-boxed and resumable ---
    const TIME_BUDGET_MS = 50_000
    let timedOut = false
    let exhausted = false
    let processed = 0
    let scanned = 0
    let pages = 0
    // Token to (re)start from if this run is cut short.
    let nextToken: string | undefined = resuming ? sync.resumeToken : undefined
    let resumeAt: string | undefined = nextToken

    do {
      if (Date.now() - t0 > TIME_BUDGET_MS) { timedOut = true; break }

      const tokenForThisPage = nextToken
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
        ...(tokenForThisPage ? { pageToken: tokenForThisPage } : {}),
      })
      const msgs = listRes.data.messages ?? []
      nextToken = listRes.data.nextPageToken ?? undefined
      pages++
      scanned += msgs.length
      log('list', { page: pages, got: msgs.length, scanned, hasNext: !!nextToken })

      for (let i = 0; i < msgs.length; i += BATCH_SIZE) {
        if (Date.now() - t0 > TIME_BUDGET_MS) {
          timedOut = true
          resumeAt = tokenForThisPage   // page unfinished — redo it next run
          log('time-budget-exceeded', { processed, scanned })
          break
        }
        const batch = msgs.slice(i, i + BATCH_SIZE)

        await Promise.all(
          batch.map(async (msg) => {
            if (!msg.id) return
            processed++

            let full
            try {
              full = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full',
              })
            } catch (e) {
              fetchErrors++
              log('fetch-error', { id: msg.id, err: (e as Error).message })
              return
            }

            const headers = full.data.payload?.headers ?? []
            const subject = headers.find((h) => h.name === 'Subject')?.value ?? ''
            const from = headers.find((h) => h.name === 'From')?.value ?? ''
            const dateRaw = headers.find((h) => h.name === 'Date')?.value ?? ''
            const parsedDate = dateRaw ? new Date(dateRaw) : null
            const date = parsedDate && !isNaN(parsedDate.getTime())
              ? parsedDate.toISOString()
              : new Date().toISOString()
            const snippet = full.data.snippet ?? ''

            const body = full.data.payload ? getEmailBody(full.data.payload) : ''
            const { isBilling, explicit } = classifyBilling(subject, body)
            if (!isBilling) {
              if (rejectedSamples.length < 10) rejectedSamples.push({ subject, from, reason: 'not_billing' })
              return
            }

            const searchText = `${subject}\n${snippet}\n${body}`.slice(0, 4000)
            const money = extractBillingAmount(searchText)
            if (!money) {
              noAmount++
              if (rejectedSamples.length < 10) rejectedSamples.push({ subject, from, reason: 'no_amount' })
              return
            }

            detected++
            const { name: merchant, category } = resolveMerchant(from)
            candidates.push({
              merchant,
              category,
              amount: money.amount,
              currency: money.currency,
              date,
              cadenceHint: detectCadence(`${subject}\n${snippet}`),
              explicit,
            })
            if (acceptedSamples.length < 10) {
              acceptedSamples.push({ subject, from, merchant, amount: money.amount, currency: money.currency })
            }
          })
        )
      }

      if (timedOut) break
      resumeAt = nextToken            // page fully processed — resume from next
      if (!nextToken) { exhausted = true; break }
    } while (processed < MAX_RESULTS)

    if (!exhausted && !timedOut && nextToken) resumeAt = nextToken  // hit MAX_RESULTS cap
    const listElapsed = Date.now() - t0

    // --- Phase 2: group by merchant and enforce recurrence (Balanced mode) ---
    // A merchant becomes a subscription only with >=2 billing emails (recurrence)
    // OR a single email that explicitly states it's a subscription. Cadence and
    // amount come from the receipts themselves, never the subject keyword.
    let created = 0
    let updated = 0
    let skippedOneOff = 0

    const byMerchant = new Map<string, Candidate[]>()
    for (const cand of candidates) {
      const group = byMerchant.get(cand.merchant)
      if (group) group.push(cand)
      else byMerchant.set(cand.merchant, [cand])
    }

    for (const [merchant, group] of byMerchant) {
      group.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const recurring = group.length >= 2
      const singleExplicit = group.length === 1 && group[0].explicit
      if (!recurring && !singleExplicit) {
        skippedOneOff++
        continue
      }

      const latest = group[group.length - 1]
      const cadence: Cadence = recurring
        ? (cadenceFromDates(group.map((g) => g.date)) ?? 'monthly')
        : latest.cadenceHint
      const category = group.find((g) => g.category)?.category ?? null

      try {
        const existingRows = await sql`
          SELECT id FROM subscriptions
          WHERE user_id = ${dbUserId} AND merchant = ${merchant} AND status = 'active'
          LIMIT 1
        `
        if (existingRows.length > 0) {
          await sql`
            UPDATE subscriptions
            SET last_charged = ${latest.date}, amount = ${latest.amount}, currency = ${latest.currency},
                cadence = ${cadence}, category = COALESCE(category, ${category})
            WHERE id = ${existingRows[0].id}
          `
          updated++
        } else {
          await sql`
            INSERT INTO subscriptions
              (user_id, name, merchant, amount, currency, cadence, source, category, detected_at, last_charged)
            VALUES
              (${dbUserId}, ${merchant}, ${merchant}, ${latest.amount}, ${latest.currency}, ${cadence}, 'gmail', ${category}, NOW(), ${latest.date})
          `
          created++
        }
      } catch (e) {
        dbErrors++
        log('db-error', { merchant, err: (e as Error).message })
      }
    }

    // Persist incremental sync state. A fully-drained scan advances the
    // high-water mark and clears any resume cursor; a cut-short scan keeps the
    // old mark and saves where to resume.
    const complete = exhausted && !timedOut
    if (complete) {
      await setGmailSync(userId, { lastCompletedAt: scanStartedAt })
    } else {
      await setGmailSync(userId, {
        lastCompletedAt: sync.lastCompletedAt,
        resumeToken: resumeAt,
        resumeQuery: query,
      })
    }

    await releaseScanLock(userId)

    // Auto-score all subs now that detection is fresh — no AI calls, just DB writes.
    // Ensures confidence + recommendations are populated immediately after every scan.
    let analyzed = 0
    try {
      analyzed = await runAnalyzeAll(dbUserId)
    } catch (err) {
      log('analyze-all-error', (err as Error).message)
    }

    const elapsed = Date.now() - t0
    log('done', { scanned, processed, detected, candidates: candidates.length, merchants: byMerchant.size, created, updated, skippedOneOff, analyzed, noAmount, fetchErrors, dbErrors, timedOut, complete, resumed: resuming, listElapsed, elapsed })

    const response: Record<string, unknown> = {
      scanned,
      processed,
      detected,
      candidates: candidates.length,
      merchants: byMerchant.size,
      created,
      updated,
      skipped_one_off: skippedOneOff,
      analyzed,
      no_amount: noAmount,
      fetch_errors: fetchErrors,
      db_errors: dbErrors,
      timed_out: timedOut,
      complete,
      incremental: !!sync.lastCompletedAt && !resuming,
      resumed: resuming,
      elapsed_ms: elapsed,
    }
    if (debug) {
      response.debug = {
        query,
        query_len: query.length,
        pages,
        list_elapsed_ms: listElapsed,
        rejected_samples: rejectedSamples,
        accepted_samples: acceptedSamples,
      }
    }
    return c.json(response)
  } catch (err) {
    await releaseScanLock(userId)
    console.error('[gmail/scan] fatal:', err)
    return c.json({ error: 'Scan failed', detail: (err as Error).message }, 500)
  }
})

// DELETE /gmail/scan-lock — clear stuck scan lock (debug)
app.delete('/scan-lock', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  await releaseScanLock(userId)
  return c.json({ cleared: true })
})

// ---------------------------------------------------------------------------
// POST /gmail/parse — manual single-email parse (for testing)
// ---------------------------------------------------------------------------

app.post('/parse', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    subject: string
    sender: string
    body_snippet: string
    received_at: string
  }>()

  const { isBilling } = classifyBilling(body.subject, body.body_snippet)
  if (!isBilling) {
    return c.json({ detected: false, reason: 'not_billing' })
  }

  const { name: merchant, category } = resolveMerchant(body.sender)
  const amountResult = extractBillingAmount(`${body.subject}\n${body.body_snippet}`)
  const cadence = detectCadence(`${body.subject}\n${body.body_snippet}`)

  const dbUserId = await getOrCreateUser(userId)

  const existingRows = await sql`
    SELECT id FROM subscriptions
    WHERE user_id = ${dbUserId} AND merchant = ${merchant} AND status = 'active'
    LIMIT 1
  `

  const amount = amountResult?.amount ?? 0
  const currency = amountResult?.currency ?? 'USD'

  if (existingRows.length > 0) {
    await sql`UPDATE subscriptions SET last_charged = ${body.received_at}, category = COALESCE(category, ${category}) WHERE id = ${existingRows[0].id}`
    return c.json({ detected: true, action: 'updated', subscription_id: existingRows[0].id })
  }

  const created = await sql`
    INSERT INTO subscriptions (user_id, name, merchant, amount, currency, cadence, source, category, detected_at, last_charged)
    VALUES (${dbUserId}, ${merchant}, ${merchant}, ${amount}, ${currency}, ${cadence}, 'gmail', ${category}, NOW(), ${body.received_at})
    RETURNING id
  `

  return c.json({ detected: true, action: 'created', subscription_id: created[0].id })
})

export default app
