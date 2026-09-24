/**
 * Financial institution, banking alert, payment gateway, and e-commerce exclusion filter.
 *
 * Prevents bank debit/credit alerts, P2P money transfers, ATM/POS notifications,
 * and one-off shopping receipts from being misclassified as recurring subscriptions.
 */

function extractDomain(raw: string): string {
  const address = raw.replace(/^.*</, '').replace(/>.*$/, '').trim().toLowerCase()
  const domainMatch = address.match(/@([\w.-]+\.\w+)/)
  return domainMatch ? domainMatch[1] : address
}

function rootDomain(domain: string): string {
  const parts = domain.split('.')
  return parts.length >= 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : domain
}

// ---------------------------------------------------------------------------
// 1. Retail Banks & P2P Mobile Wallets (NEVER a subscription service)
// ---------------------------------------------------------------------------
export const RETAIL_BANKS_AND_WALLETS = new Set<string>([
  // Nigeria & African Commercial Banks & Mobile Money
  'opay-nigeria.com',
  'opayweb.com',
  'moniepoint.com',
  'moniepoint.ng',
  'kuda.com',
  'kudabank.com',
  'palmpay.com',
  'palmpay-inc.com',
  'gtbank.com',
  'accessbankplc.com',
  'zenithbank.com',
  'firstbanknigeria.com',
  'ubagroup.com',
  'stanbicibtc.com',
  'fidelitybank.ng',
  'fcmb.com',
  'unionbankng.com',
  'sterling.ng',
  'providusbank.com',
  'wema.com',
  'alat.ng',
  'piggyvest.com',
  'cowrywise.com',
  'chippercash.com',
  'fairmoney.io',
  'carbon.ng',
  'rubiesbank.com',
  'vbank.ng',
  'quickteller.com',

  // Global Commercial Banks & P2P Wallets
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'citi.com',
  'capitalone.com',
  'usbank.com',
  'pnc.com',
  'td.com',
  'barclays.co.uk',
  'barclays.com',
  'hsbc.com',
  'hsbc.co.uk',
  'lloydsbank.com',
  'santander.com',
  'santander.co.uk',
  'natwest.com',
  'monzo.com',
  'revolut.com',
  'starlingbank.com',
  'wise.com',
  'transferwise.com',
  'venmo.com',
  'cash.app',
  'zellepay.com',
  'westernunion.com',
  'moneygram.com',
])

// ---------------------------------------------------------------------------
// 2. Payment Processors / Gateways (Excluded UNLESS explicitly recurring)
// ---------------------------------------------------------------------------
export const PAYMENT_GATEWAY_DOMAINS = new Set<string>([
  'paystack.com',
  'paystack.co',
  'flutterwave.com',
  'interswitchgroup.com',
  'remita.net',
  'stripe.com',
  'paypal.com',
])

// ---------------------------------------------------------------------------
// 3. E-commerce, One-off Shopping, Logistics & Rideshare
// ---------------------------------------------------------------------------
export const ECOMMERCE_AND_DELIVERY_DOMAINS = new Set<string>([
  'temu.com',
  'aliexpress.com',
  'shein.com',
  'ebay.com',
  'jumia.com',
  'jumia.com.ng',
  'konga.com',
  'uber.com',
  'bolt.eu',
  'doordash.com',
  'ubereats.com',
  'deliveroo.com',
  'instacart.com',
  'lyft.com',
  'target.com',
  'walmart.com',
  'bestbuy.com',
  'asos.com',
  'zara.com',
  'hm.com',
  'booking.com',
  'airbnb.com',
  'expedia.com',
])

// ---------------------------------------------------------------------------
// Universal Subject & Content Heuristics
// ---------------------------------------------------------------------------

// Explicit bank transaction alert subjects
const BANK_ALERT_SUBJECT =
  /\b(debit\s+(?:alert|notification)|credit\s+(?:alert|notification)|transaction\s+(?:alert|notification|receipt)|transfer\s+(?:alert|notification|receipt|successful|confirmation)|funds?\s+transfer|account\s+statement|money\s+(?:sent|received)|you\s+(?:sent|received)|payment\s+to\s+.*via\s+pos|atm\s+(?:withdrawal|transaction)|airtime\s+(?:purchase|recharge)|data\s+purchase|bill\s+payment\s+receipt|wallet\s+top[-\s]?up|inward\s+transfer|outward\s+transfer|interbank\s+transfer|nip\s+transaction|quickteller|pos\s+transaction|receipt\s+for\s+your\s+transfer)\b/i

// One-off order & delivery subjects
const ECOMMERCE_ORDER_SUBJECT =
  /\b(order\s+#|order\s+confirmation|package\s+delivered|estimated\s+delivery|shipping\s+update|tracking\s+number|your\s+order\s+has\s+shipped|your\s+trip\s+with\s+uber|your\s+bolt\s+receipt|your\s+ride\s+with\s+lyft|delivery\s+confirmation|trip\s+receipt)\b/i

// Banking ledger / account keywords that strongly indicate personal bank alert
const BANK_LEDGER_MARKERS = [
  /\bbeneficiary(?:\s+name)?\b/i,
  /\bsender\s+name\b/i,
  /\brecipient\s+name\b/i,
  /\baccount\s+number\b/i,
  /\b(?:available|ledger)\s+balance\b/i,
  /\bsession\s+id\b/i,
  /\btransaction\s+reference\b/i,
  /\bnarration\b/i,
  /\bvalue\s+date\b/i,
  /\bterminal\s+id\b/i,
  /\bbvn\b/i,
  /\biban\b/i,
  /\bsort\s+code\b/i,
  /\brouting\s+number\b/i,
  /\baccount\s+debited\b/i,
]

// Explicit indicators that override and prove a recurring subscription
const EXPLICIT_SUBSCRIPTION_OVERRIDE =
  /\b(auto[-\s]?renew(?:ing|s)?|renews?\s+(?:on|automatically|every)|next\s+(?:billing|payment|charge)\s+date|billing\s+cycle|recurring\s+(?:charge|payment|subscription|plan)|(?:monthly|annual|yearly|quarterly)\s+(?:plan|subscription)|subscription\s+(?:confirmation|receipt|invoice|charge|payment|renewed|purchase)|you\s+will\s+be\s+automatically\s+charged|cancel\s+anytime)\b/i

// Editorial newsletters, news columns, digests that are not billing receipts
const NEWSLETTER_SENDER_PATTERNS =
  /\b(?:the\s+briefing|newsletter|newsletters|daily\s+digest|weekly\s+roundup|editorial|column|opinions|substack|beehiiv)\b/i

const NEWSLETTER_SUBJECT_PATTERNS =
  /\b(?:the\s+briefing|daily\s+briefing|weekly\s+briefing|morning\s+briefing|evening\s+briefing|edition\s+#\d+|edition\s+\d+|roundup|newsletter|digest)\b/i

const HAS_REAL_BILLING_EVIDENCE =
  /\b(receipt\s*#|invoice\s*#|order\s*(?:number|#|id)|order\s+date:|payment\s+method:|amount\s+(?:due|paid|charged)\s*[:\s]|total\s*[:\s]\s*(?:₦|\$|USD|EUR|GBP|\d)|auto-renew(?:ing|s)?|you\s+will\s+be\s+(?:automatically\s+)?charged)\b/i

/**
 * Checks whether an incoming email is a bank transaction alert, P2P money transfer,
 * or one-off e-commerce purchase that must be globally excluded from subscription detection.
 */
export function isExcludedNonSubscription(
  sender: string,
  subject: string,
  body: string
): { excluded: boolean; reason?: string } {
  const fullDomain = extractDomain(sender)
  const root = rootDomain(fullDomain)
  const combinedText = `${subject}\n${body}`

  // 1. Retail banks and digital wallets are strictly excluded
  if (RETAIL_BANKS_AND_WALLETS.has(fullDomain) || RETAIL_BANKS_AND_WALLETS.has(root)) {
    return { excluded: true, reason: 'bank_or_fintech_sender' }
  }

  // 2. Check universal bank alert subjects
  if (BANK_ALERT_SUBJECT.test(subject)) {
    return { excluded: true, reason: 'bank_transaction_subject' }
  }

  // 3. Check for multiple banking ledger indicators in body
  let ledgerMatches = 0
  for (const marker of BANK_LEDGER_MARKERS) {
    if (marker.test(combinedText)) {
      ledgerMatches++
      if (ledgerMatches >= 2) {
        return { excluded: true, reason: 'bank_transaction_ledger_markers' }
      }
    }
  }

  // 4. Payment processors (Paystack, Stripe, PayPal) are excluded UNLESS explicitly recurring
  const isGateway =
    PAYMENT_GATEWAY_DOMAINS.has(fullDomain) || PAYMENT_GATEWAY_DOMAINS.has(root)

  if (isGateway) {
    if (EXPLICIT_SUBSCRIPTION_OVERRIDE.test(combinedText)) {
      return { excluded: false }
    }
    return { excluded: true, reason: 'payment_gateway_one_off' }
  }

  // 5. E-commerce / rideshare / food delivery domains
  // (unless explicit subscription keyword like Uber One or DashPass is found)
  const isEcomDomain =
    ECOMMERCE_AND_DELIVERY_DOMAINS.has(fullDomain) || ECOMMERCE_AND_DELIVERY_DOMAINS.has(root)

  if (isEcomDomain) {
    if (EXPLICIT_SUBSCRIPTION_OVERRIDE.test(combinedText)) {
      return { excluded: false }
    }
    return { excluded: true, reason: 'ecommerce_or_delivery_sender' }
  }

  // 6. Check e-commerce order confirmation / shipping subjects
  if (ECOMMERCE_ORDER_SUBJECT.test(subject)) {
    if (EXPLICIT_SUBSCRIPTION_OVERRIDE.test(combinedText)) {
      return { excluded: false }
    }
    return { excluded: true, reason: 'ecommerce_order_subject' }
  }

  // 7. Exclude newsletters and editorial columns that lack billing/payment evidence
  if (
    (NEWSLETTER_SENDER_PATTERNS.test(sender) || NEWSLETTER_SUBJECT_PATTERNS.test(subject)) &&
    !HAS_REAL_BILLING_EVIDENCE.test(combinedText)
  ) {
    return { excluded: true, reason: 'editorial_newsletter' }
  }

  return { excluded: false }
}
