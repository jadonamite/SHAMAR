import { Hono } from 'hono'
import { randomBytes } from 'crypto'
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
  clearGmailTokens,
  cache,
} from '../lib/cache.js'
import { withGmailRetry, isAuthExpired, isRateLimited } from '../lib/gmail-retry.js'
import { quickPass } from '../lib/reasoning.js'
import { CALENDAR_SCOPE } from '../lib/calendar.js'
import {
  lookupService,
  type SubscriptionCategory,
} from '../lib/subscriptions-registry.js'
import { authenticateCaller } from '../lib/auth.js'
import { isExcludedNonSubscription } from '../lib/exclusions.js'

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

// Words that indicate a recurring charge/receipt rather than a generic notification.
const BILLING_KEYWORDS =
  /\b(receipt|invoice|billed|charged?|auto[-\s]?renew(?:ing|s)?|membership|billing\s+cycle|amount\s+due|payment\s+received)\b/i

// Stronger language that explicitly identifies a recurring subscription
const EXPLICIT_SUBSCRIPTION =
  /\b(auto[-\s]?renew(?:ing|s)?|renews?\s+(?:on|automatically|every)|next\s+(?:billing|payment|charge)\s+date|billing\s+cycle|recurring\s+(?:charge|payment|subscription|plan)|(?:monthly|annual|yearly|quarterly)\s+(?:plan|subscription)|subscription\s+(?:confirmation|receipt|invoice|charge|payment|renewed|purchase)|you\s+will\s+be\s+automatically\s+charged|cancel\s+anytime)\b/i

// Subjects that look like account/notification noise — rejected unless the
// subject also carries billing language.
const NON_BILLING_SUBJECT =
  /\b(sign[-\s]?in|log[-\s]?in|security\s+alert|verify|verification|confirm\s+your|password|one[-\s]?time|otp|2fa|new\s+device|unusual\s+activity|comment(?:ed)?|mention(?:ed)?|liked|followed|digest|newsletter|welcome|get\s+started)\b/i

export function classifyBilling(
  subject: string,
  body: string,
  from = ''
): { isBilling: boolean; explicit: boolean; reason?: string } {
  // 1. Exclude banks, fintech transfer receipts, newsletters, and one-off e-commerce shopping
  if (from) {
    const exclusion = isExcludedNonSubscription(from, subject, body)
    if (exclusion.excluded) {
      return { isBilling: false, explicit: false, reason: exclusion.reason }
    }
  }

  const text = `${subject}\n${body}`
  if (NON_BILLING_SUBJECT.test(subject) && !BILLING_KEYWORDS.test(subject)) {
    return { isBilling: false, explicit: false, reason: 'non_billing_subject' }
  }
  return {
    isBilling: BILLING_KEYWORDS.test(text),
    explicit: EXPLICIT_SUBSCRIPTION.test(text),
  }
}

type Money = { amount: number; currency: string; index: number }

// Atomic-style currency regex with negative lookahead for scale multipliers ($12.9 billion != $12.9)
const CURRENCY_AMOUNT =
  /(\$|USD|₦|NGN|€|EUR|£|GBP)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?!\d|\.\d)(?!\s*(?:billion|million|trillion|bn|b\b|m\b|k\b))/gi

// Words the actual charge sits next to. Used to pick the right number when an
// email contains several amounts (promos, taxes, crossed-out prices).
const AMOUNT_ANCHOR =
  /\b(grand\s+total|total\s*(?:due|paid|charged)?\s*[:\s]|subtotal\s*[:\s]|amount\s+(?:due|charged|paid)\s*[:\s]?|charged\s*[:\s]|you\s+paid\s*[:\s]?|payment\s+(?:of|received|amount)\s*[:\s]?|billed\s*[:\s]?|price\s*[:\s]|renewal\s*[:\s]|renew(?:s|ed)\s|processed|debited|deducted|facture\s*[:\s]|montant\s*[:\s]|pay[ée])/gi

const RECEIPT_MARKERS =
  /\b(receipt\s*#|invoice\s*#|order\s*(?:number|#|id)|order\s+date:|payment\s+method:|download\s+invoice|download\s+receipt)\b/i

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

// Billing-anchored extraction: prefer the amount adjacent to a "total/charged" label;
// otherwise fall back to explicit receipt markers. Returns null if amounts are ambiguous.
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

  // If there are explicit receipt headers (like Receipt #, Order number:), accept the largest amount
  if (RECEIPT_MARKERS.test(text)) {
    const largest = amounts.reduce((p, c) => (c.amount > p.amount ? c : p))
    return { amount: largest.amount, currency: largest.currency }
  }

  return null
}

// Cadence guessed from email language — only used when there's a single receipt.
export function detectCadence(text: string): Cadence {
  if (/domain\s+(?:purchase|registration|renewal)/i.test(text)) return 'yearly'
  if (/annual|yearly|per\s+year|\/\s*year|\byr\b/i.test(text)) return 'yearly'
  if (/weekly|per\s+week|\/\s*week/i.test(text)) return 'weekly'
  if (/daily|per\s+day|\/\s*day/i.test(text)) return 'daily'
  return 'monthly'
}

// Cadence inferred from the spacing between repeat receipts (the reliable signal).
export function cadenceFromDates(isoDates: string[]): Cadence | null {
  if (isoDates.length < 2) return null
  const days = isoDates
    .map((d) => new Date(d).getTime() / 86_400_000)
    .sort((a, b) => a - b)
  const intervals = days.slice(1).map((d, i) => d - days[i]).sort((a, b) => a - b)
  const median = intervals[Math.floor(intervals.length / 2)]
  if (median >= 5 && median <= 10) return 'weekly'
  if (median >= 20 && median <= 40) return 'monthly'
  if (median >= 320 && median <= 400) return 'yearly'
  return null
}

/**
 * Detects and parses Google Play or Apple App Store subscription receipts,
 * extracting the underlying application name (e.g. "CapCut"), vendor, and pricing.
 */
export function parseAppStoreReceipt(
  from: string,
  subject: string,
  body: string
): {
  merchant: string
  name: string
  category: SubscriptionCategory
  amount?: number
  currency?: string
  cadence?: Cadence
} | null {
  const combined = `${subject}\n${body}`
  const fromLower = from.toLowerCase()

  // 1. Google Play Receipts
  const isGooglePlay =
    fromLower.includes('googleplay') ||
    fromLower.includes('google play') ||
    /Google\s*Play\s+Order\s+Receipt/i.test(subject) ||
    /Order\s+number:\s*GPA\.\d{4}-\d{4}-\d{4}-\d{5}/i.test(body)

  if (isGooglePlay) {
    const itemPriceMatch = combined.match(/Item\s+Price\s*\n+([^\n\r]+)/i)
    let rawItem = ''
    if (itemPriceMatch) {
      let line = itemPriceMatch[1].replace(/(?:₦|\$|USD|EUR|GBP)\s*[\d,]+(?:\.\d{2})?.*$/i, '').trim()
      const subInParens = line.match(/(?:Monthly|Annual|Yearly|Weekly)?\s*Subscription\s*\((.*)\)$/i)
      if (subInParens) line = subInParens[1].trim()
      line = line.replace(/\(by [^)]+\)/gi, '').trim()
      rawItem = line
    } else {
      const subMatch = combined.match(/(?:Monthly|Annual|Yearly|Weekly)?\s*Subscription\s*\(([^)]+)\)/i)
      if (subMatch) rawItem = subMatch[1].trim()
    }

    if (rawItem) {
      let cleanName = rawItem.split(':')[0].split(' - ')[0].trim()
      cleanName = cleanName.replace(/\([^)]+\)/g, '').trim()

      let category: SubscriptionCategory = 'design'
      const lowerItem = rawItem.toLowerCase()
      if (lowerItem.includes('ai') || lowerItem.includes('gemini') || lowerItem.includes('chat') || lowerItem.includes('bot')) {
        category = 'ai'
      } else if (lowerItem.includes('google one') || lowerItem.includes('storage') || lowerItem.includes('drive')) {
        category = 'storage'
      } else if (lowerItem.includes('photo') || lowerItem.includes('video') || lowerItem.includes('editor') || lowerItem.includes('design') || lowerItem.includes('capcut')) {
        category = 'design'
      } else if (lowerItem.includes('stream') || lowerItem.includes('tv') || lowerItem.includes('movie')) {
        category = 'streaming'
      } else if (lowerItem.includes('music') || lowerItem.includes('audio') || lowerItem.includes('song')) {
        category = 'music'
      } else if (lowerItem.includes('fit') || lowerItem.includes('workout') || lowerItem.includes('health') || lowerItem.includes('gym')) {
        category = 'fitness'
      } else if (lowerItem.includes('vpn') || lowerItem.includes('proxy')) {
        category = 'vpn'
      } else if (lowerItem.includes('learn') || lowerItem.includes('tutor') || lowerItem.includes('course') || lowerItem.includes('duolingo')) {
        category = 'education'
      }

      let cadence: Cadence = 'monthly'
      if (/for\s+1\s+year|\/year|yearly|annual/i.test(combined)) {
        cadence = 'yearly'
      } else if (/for\s+1\s+week|\/week|weekly/i.test(combined)) {
        cadence = 'weekly'
      }

      return {
        merchant: cleanName || 'Google Play',
        name: cleanName || rawItem || 'Google Play Subscription',
        category,
        cadence,
      }
    }
  }

  // 2. Apple App Store Receipts
  const isApple =
    fromLower.includes('apple.com') &&
    (/receipt\s+from\s+apple/i.test(subject) || /apple\.com\/bill/i.test(body))

  if (isApple) {
    const appMatch = combined.match(/(?:App Store|In-App Purchase)\s*\n\s*([^\n\r]+)/i)
    if (appMatch) {
      const rawApp = appMatch[1].trim()
      const cleanName = rawApp.split(' - ')[0].split(':')[0].trim()
      return {
        merchant: cleanName,
        name: cleanName,
        category: 'productivity',
      }
    }
  }

  return null
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
  const auth = await authenticateCaller(c)
  const userId = auth?.dbUserId ?? c.req.query('user_id') ?? c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'user_id required' }, 400)
  const connected = await hasGmailConnected(userId)
  return c.json({ connected })
})

// ---------------------------------------------------------------------------
// POST /gmail/connect (Safe OAuth initiation with cryptographic state nonce)
// ---------------------------------------------------------------------------

app.post('/connect', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return c.json({ error: 'Gmail OAuth not configured.' }, 503)
  }

  const stateCode = randomBytes(32).toString('hex')
  await cache.set(
    `oauth_state:${stateCode}`,
    { dbUserId: auth.dbUserId, privyDid: auth.privyDid },
    { ex: 600 }
  )

  const oauth2Client = getOAuthClient()
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', CALENDAR_SCOPE],
    state: stateCode,
  })

  return c.json({ url: authUrl })
})

// ---------------------------------------------------------------------------
// GET /gmail/auth (Legacy fallback)
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
    scope: ['https://www.googleapis.com/auth/gmail.readonly', CALENDAR_SCOPE],
    state: userId,
  })

  return c.redirect(authUrl)
})

// ---------------------------------------------------------------------------
// GET /gmail/callback
// ---------------------------------------------------------------------------

app.get('/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')
  const errorDescription = c.req.query('error_description')
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'

  if (error) {
    console.warn('[Gmail OAuth] Google returned error:', error, errorDescription)
    const errParam = encodeURIComponent(error)
    const detailParam = errorDescription ? `&detail=${encodeURIComponent(errorDescription)}` : ''
    return c.redirect(`${frontendUrl}/dashboard?error=${errParam}${detailParam}`)
  }

  if (!code || !state) {
    console.warn('[Gmail OAuth] Callback missing code or state:', { code: Boolean(code), state })
    return c.redirect(`${frontendUrl}/dashboard?error=oauth_failed`)
  }

  let targetUserId: string | null = null

  // 1. Verify cryptographic state nonce from KV
  const stateKey = `oauth_state:${state}`
  const stored = await cache.get<{ dbUserId: string; privyDid: string }>(stateKey)
  if (stored) {
    targetUserId = stored.privyDid || stored.dbUserId
    await cache.del(stateKey)
  } else if (state.startsWith('did:') || state.length > 20) {
    // Backward compatibility for legacy callers
    targetUserId = state
  } else {
    console.warn('[Gmail OAuth] State expired or invalid:', state)
    return c.redirect(`${frontendUrl}/dashboard?error=oauth_expired`)
  }

  try {
    const oauth2Client = getOAuthClient()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      console.warn('[Gmail OAuth] Google did not return refresh_token')
      return c.redirect(`${frontendUrl}/dashboard?error=no_refresh_token`)
    }

    const dbUserId = await getOrCreateUser(targetUserId)
    await storeGmailTokens(targetUserId, {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? undefined,
    })
    if (dbUserId !== targetUserId) {
      await storeGmailTokens(dbUserId, {
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ?? undefined,
      })
    }

    console.log('[Gmail OAuth] Successfully connected Gmail for user:', targetUserId)
    return c.redirect(`${frontendUrl}/dashboard?connected=gmail`)
  } catch (err) {
    console.error('[Gmail OAuth] Callback error:', (err as Error).message)
    return c.redirect(
      `${frontendUrl}/dashboard?error=oauth_failed&detail=${encodeURIComponent((err as Error).message)}`
    )
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
  'subject:(receipt OR invoice OR "payment received" OR billed OR "auto-renew" OR "order receipt" OR "membership renewed") -subject:(briefing OR newsletter OR digest OR alert)'

const MAX_RESULTS = 75
const BATCH_SIZE = 5

app.post('/scan', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const userId = auth.privyDid
  const dbUserId = auth.dbUserId

  const debug = c.req.query('debug') === '1'
  const t0 = Date.now()
  const log = (...args: unknown[]) => console.log('[gmail/scan]', ...args)

  const acquired = await getScanLock(userId)
  if (!acquired) {
    return c.json({ error: 'Scan already in progress. Try again in 2 minutes.' }, 429)
  }

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
    const isReset = c.req.query('reset') === '1' || c.req.query('full') === '1'
    if (isReset) {
      await setGmailSync(userId, { lastCompletedAt: undefined, resumeToken: undefined, resumeQuery: undefined })
      if (c.req.query('clear') === '1') {
        const oldRows = (await sql`SELECT id FROM subscriptions WHERE user_id = ${dbUserId} AND source = 'gmail'`) as { id: string }[]
        for (const row of oldRows) {
          await cache.del(`renewal:${row.id}`)
          await cache.del(`insight:${row.id}`)
        }
        await sql`DELETE FROM subscriptions WHERE user_id = ${dbUserId} AND source = 'gmail'`
      }
    }
    const sync = isReset ? {} : await getGmailSync(userId)
    const scanStartedAt = Math.floor(t0 / 1000)
    const resuming = !!(sync.resumeToken && sync.resumeQuery)
    const query = resuming
      ? sync.resumeQuery!
      : sync.lastCompletedAt
        ? `${GMAIL_QUERY} after:${sync.lastCompletedAt}`
        : `${GMAIL_QUERY} newer_than:1y`
    log('window', { resuming, lastCompletedAt: sync.lastCompletedAt ?? null, isReset, query_len: query.length })

    let detected = 0       // emails that pass the billing-intent gate
    let noAmount = 0       // billing emails with no parseable amount
    let fetchErrors = 0
    let dbErrors = 0
    const rejectedSamples: Array<{ subject: string; from: string; reason: string }> = []
    const acceptedSamples: Array<{ subject: string; from: string; merchant: string; amount: number; currency: string }> = []

    type Candidate = {
      merchant: string
      name?: string
      category: SubscriptionCategory | null
      amount: number
      currency: string
      date: string
      cadenceHint: Cadence
      explicit: boolean
      messageId?: string
      subject?: string
      bodySnippet?: string
    }
    const candidates: Candidate[] = []

    // --- Phase 1: interleaved list + fetch, time-boxed and resumable ---
    const TIME_BUDGET_MS = 22_000
    // Retry waits must end before this, leaving room for Phase 2 inside the 60s function.
    const retryDeadline = t0 + TIME_BUDGET_MS + 8_000
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
      const listRes = await withGmailRetry(
        () =>
          gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 100,
            ...(tokenForThisPage ? { pageToken: tokenForThisPage } : {}),
          }),
        { deadline: retryDeadline }
      )
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

            const id = msg.id
            let full
            try {
              full = await withGmailRetry(
                () => gmail.users.messages.get({ userId: 'me', id, format: 'full' }),
                { deadline: retryDeadline }
              )
            } catch (e) {
              if (isAuthExpired(e)) throw e
              fetchErrors++
              log('fetch-error', { id, err: (e as Error).message })
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
            const { isBilling, explicit, reason } = classifyBilling(subject, body, from)
            if (!isBilling) {
              if (rejectedSamples.length < 10) rejectedSamples.push({ subject, from, reason: reason ?? 'not_billing' })
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
            const appStoreReceipt = parseAppStoreReceipt(from, subject, body)
            let merchant: string
            let candidateName: string | undefined = undefined
            let category: SubscriptionCategory | null = null
            let detectedCadenceHint: Cadence = detectCadence(`${subject}\n${snippet}\n${body}`)

            if (appStoreReceipt) {
              merchant = appStoreReceipt.merchant
              candidateName = appStoreReceipt.name
              category = appStoreReceipt.category
              if (appStoreReceipt.cadence) {
                detectedCadenceHint = appStoreReceipt.cadence
              }
            } else {
              const res = resolveMerchant(from)
              merchant = res.name
              category = res.category
            }

            candidates.push({
              merchant,
              name: candidateName,
              category,
              amount: money.amount,
              currency: money.currency,
              date,
              cadenceHint: detectedCadenceHint,
              explicit,
              messageId: msg.id ?? undefined,
              subject,
              bodySnippet: body.slice(0, 1500),
            })
            if (acceptedSamples.length < 10) {
              acceptedSamples.push({ subject, from, merchant, amount: money.amount, currency: money.currency })
            }
          })
        )

        // Inter-batch pacing delay to respect Gmail per-user query limits
        await new Promise((r) => setTimeout(r, 120))
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
      const isKnownService = !!group.find((g) => g.category)
      const detectedCadence = cadenceFromDates(group.map((g) => g.date))
      const hasExplicit = group.some((g) => g.explicit)

      // Reject one-off domain purchases for different domains without explicit auto-renew
      const domainMatches = group
        .map((g) => {
          const match = `${g.subject ?? ''} ${g.bodySnippet ?? ''}`.match(/Domain purchase\s*-\s*([^\s,]+)/i)
          return match ? match[1].toLowerCase() : null
        })
        .filter(Boolean) as string[]

      if (domainMatches.length > 0 && !hasExplicit) {
        const distinctDomains = new Set(domainMatches)
        if (distinctDomains.size === domainMatches.length) {
          skippedOneOff++
          continue
        }
      }

      // A merchant qualifies as a subscription ONLY IF:
      // 1. It is a known service in the registry, OR
      // 2. It has an explicit subscription marker in at least one email, OR
      // 3. It has regular periodic recurrence (cadenceFromDates !== null)
      if (!isKnownService && !hasExplicit && !detectedCadence) {
        skippedOneOff++
        continue
      }

      // Enforce amount consistency for unverified merchants:
      // If repeat charges fluctuate wildly, it's variable spending (not a fixed subscription)
      const positiveAmounts = group.map((g) => g.amount).filter((a) => a > 0)
      if (!isKnownService && !hasExplicit && positiveAmounts.length >= 2) {
        const min = Math.min(...positiveAmounts)
        const max = Math.max(...positiveAmounts)
        if (max > min * 1.35) {
          skippedOneOff++
          continue
        }
      }

      const latest = group[group.length - 1]
      // Reject zero-dollar phantom subscriptions for unverified merchants with no explicit trial
      if (latest.amount <= 0 && !isKnownService && !hasExplicit) {
        skippedOneOff++
        continue
      }

      const cadence: Cadence = detectedCadence ?? latest.cadenceHint
      const category = group.find((g) => g.category)?.category ?? null
      const finalName = group.find((g) => g.name)?.name ?? latest.name ?? merchant

      try {
        let subId: string
        const existingRows = (await sql`
          SELECT id FROM subscriptions
          WHERE user_id = ${dbUserId} AND LOWER(merchant) = ${merchant.toLowerCase()} AND status = 'active'
          ORDER BY (amount > 0) DESC, detected_at DESC
        `) as unknown as { id: string }[]
        if (existingRows.length > 0) {
          subId = existingRows[0].id
          await sql`
            UPDATE subscriptions
            SET name = COALESCE(${finalName}, name),
                last_charged = ${latest.date}, amount = ${latest.amount}, currency = ${latest.currency},
                cadence = ${cadence}, category = COALESCE(category, ${category})
            WHERE id = ${subId}
          `
          if (existingRows.length > 1) {
            const duplicateIds = existingRows.slice(1).map((r) => r.id)
            await sql`DELETE FROM subscriptions WHERE id = ANY(${duplicateIds})`
          }
          updated++
        } else {
          const [inserted] = (await sql`
            INSERT INTO subscriptions
              (user_id, name, merchant, amount, currency, cadence, source, category, detected_at, last_charged)
            VALUES
              (${dbUserId}, ${finalName}, ${merchant}, ${latest.amount}, ${latest.currency}, ${cadence}, 'gmail', ${category}, NOW(), ${latest.date})
            RETURNING id
          `) as unknown as { id: string }[]
          subId = inserted.id
          created++
        }

        // Write each receipt signal to the database for accurate charge_count
        for (const candidate of group) {
          if (candidate.messageId) {
            try {
              await sql`
                INSERT INTO signals (subscription_id, type, value, weight, message_id, created_at)
                VALUES (
                  ${subId},
                  'receipt',
                  ${JSON.stringify({
                    amount: candidate.amount,
                    currency: candidate.currency,
                    subject: candidate.subject,
                    date: candidate.date,
                  })},
                  1.0,
                  ${candidate.messageId},
                  ${candidate.date}
                )
                ON CONFLICT (subscription_id, message_id) DO NOTHING
              `
            } catch {
              // Ignore single duplicate or conflicting signal insert
            }
          }
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

    // Auto-score all subs now that detection is fresh — no AI calls, just DB writes.
    // Ensures confidence + recommendations are populated immediately after every scan.
    let analyzed = 0
    try {
      analyzed = await quickPass(dbUserId)
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
    console.error('[gmail/scan] fatal:', err)
    if (isAuthExpired(err)) {
      await clearGmailTokens(userId).catch(() => {})
      return c.json(
        {
          error: 'Your Gmail connection has expired. Connect Gmail again to keep scanning.',
          code: 'GMAIL_RECONNECT_REQUIRED',
        },
        400
      )
    }
    if (isRateLimited(err)) {
      return c.json(
        {
          error: 'Gmail asked us to slow down. Wait a minute, then scan again.',
          code: 'GMAIL_RATE_LIMITED',
        },
        503
      )
    }
    return c.json({ error: 'Scan failed', detail: (err as Error).message }, 500)
  } finally {
    await releaseScanLock(userId).catch(() => {})
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
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const dbUserId = auth.dbUserId

  const body = await c.req.json<{
    subject: string
    sender: string
    body_snippet: string
    received_at: string
  }>()

  const { isBilling, reason } = classifyBilling(body.subject, body.body_snippet, body.sender)
  if (!isBilling) {
    return c.json({ detected: false, reason: reason ?? 'not_billing' })
  }

  const { name: merchant, category } = resolveMerchant(body.sender)
  const amountResult = extractBillingAmount(`${body.subject}\n${body.body_snippet}`)
  const cadence = detectCadence(`${body.subject}\n${body.body_snippet}`)

  const existingRows = await sql`
    SELECT id FROM subscriptions
    WHERE user_id = ${dbUserId} AND merchant = ${merchant} AND status = 'active'
    LIMIT 1
  `

  const amount = amountResult?.amount ?? 0
  const currency = amountResult?.currency ?? 'USD'
  let subId: string

  if (existingRows.length > 0) {
    subId = existingRows[0].id
    await sql`UPDATE subscriptions SET last_charged = ${body.received_at}, category = COALESCE(category, ${category}) WHERE id = ${subId}`
  } else {
    const created = await sql`
      INSERT INTO subscriptions (user_id, name, merchant, amount, currency, cadence, source, category, detected_at, last_charged)
      VALUES (${dbUserId}, ${merchant}, ${merchant}, ${amount}, ${currency}, ${cadence}, 'gmail', ${category}, NOW(), ${body.received_at})
      RETURNING id
    `
    subId = created[0].id
  }

  // Insert signal record
  try {
    await sql`
      INSERT INTO signals (subscription_id, type, value, weight, created_at)
      VALUES (
        ${subId},
        'receipt',
        ${JSON.stringify({ amount, currency, subject: body.subject, date: body.received_at })},
        1.0,
        ${body.received_at}
      )
    `
  } catch {
    // ignore
  }

  return c.json({
    detected: true,
    action: existingRows.length > 0 ? 'updated' : 'created',
    subscription_id: subId,
  })
})

export default app
