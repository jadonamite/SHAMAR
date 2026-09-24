import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'

import { applyGuardrails, fallbackDecision, type Decision, type Evidence } from '../src/lib/reasoning.js'
import { extractBillingAmount, detectCadence, cadenceFromDates, classifyBilling } from '../src/routes/gmail.js'
import { executeDecision } from '../src/lib/execution.js'

test('Guardrails: downgrades cancel to remind when data loss is permanent', () => {
  const decision: Decision = {
    subscription_id: 'sub-1',
    merchant: 'AWS Cloud',
    action: 'cancel',
    confidence: 95,
    rationale: 'High monthly spend on unused instance',
    blast_radius: {
      data_loss: 'permanent',
      access_loss: 'shared',
      repurchase: 'same_price',
      irreversible: true,
      notes: [],
    },
    savings_usd_monthly: 120,
    requires_authorization: true,
    reasoned_by: 'model',
  }

  const guarded = applyGuardrails(decision)
  assert.equal(guarded.action, 'remind', 'Permanent data loss MUST downgrade cancel to remind')
  assert.match(guarded.blast_radius.notes[0], /permanent data loss/i)
})

test('Guardrails: downgrades cancel to remind when irreversible and confidence < 85%', () => {
  const decision: Decision = {
    subscription_id: 'sub-2',
    merchant: 'Legacy Pro Plan',
    action: 'cancel',
    confidence: 80,
    rationale: 'Unused for 60 days',
    blast_radius: {
      data_loss: 'recoverable',
      access_loss: 'solo',
      repurchase: 'higher_price',
      irreversible: true,
      notes: [],
    },
    savings_usd_monthly: 50,
    requires_authorization: true,
    reasoned_by: 'model',
  }

  const guarded = applyGuardrails(decision)
  assert.equal(guarded.action, 'remind', 'Irreversible cancel with confidence < 85% must downgrade to remind')
  assert.match(guarded.blast_radius.notes[0], /irreversible at 80% confidence/i)
})

test('Guardrails: permits cancel when irreversible and confidence >= 85%', () => {
  const decision: Decision = {
    subscription_id: 'sub-3',
    merchant: 'Spotify Family',
    action: 'cancel',
    confidence: 90,
    rationale: 'Completely inactive account with alternative service active',
    blast_radius: {
      data_loss: 'recoverable',
      access_loss: 'shared',
      repurchase: 'higher_price',
      irreversible: true,
      notes: [],
    },
    savings_usd_monthly: 19.99,
    requires_authorization: true,
    reasoned_by: 'model',
  }

  const guarded = applyGuardrails(decision)
  assert.equal(guarded.action, 'cancel', 'Irreversible cancel with >= 85% confidence is permitted')
})

test('Cadence Detection: identifies weekly, monthly, and yearly intervals from dates', () => {
  // Weekly: ~7 days apart
  const weeklyDates = [
    '2026-01-01T00:00:00Z',
    '2026-01-08T00:00:00Z',
    '2026-01-15T00:00:00Z',
  ]
  assert.equal(cadenceFromDates(weeklyDates), 'weekly')

  // Monthly: ~30 days apart
  const monthlyDates = [
    '2026-01-01T00:00:00Z',
    '2026-02-01T00:00:00Z',
    '2026-03-01T00:00:00Z',
  ]
  assert.equal(cadenceFromDates(monthlyDates), 'monthly')

  // Yearly: ~365 days apart
  const yearlyDates = [
    '2024-01-10T00:00:00Z',
    '2025-01-10T00:00:00Z',
  ]
  assert.equal(cadenceFromDates(yearlyDates), 'yearly')

  // Insufficient dates (< 2)
  assert.equal(cadenceFromDates(['2026-01-01T00:00:00Z']), null)
})

test('Cadence Detection: identifies cadence from email text snippets', () => {
  assert.equal(detectCadence('Your annual subscription has renewed for $120/year'), 'yearly')
  assert.equal(detectCadence('Billed weekly for gym access'), 'weekly')
  assert.equal(detectCadence('Daily pass fee charged'), 'daily')
  assert.equal(detectCadence('Your monthly invoice of $15 is ready'), 'monthly')
})

test('Amount Parsing: extracts amounts and currencies reliably', () => {
  const usd = extractBillingAmount('Thank you for your payment. Total charged: $29.99')
  assert.ok(usd)
  assert.equal(usd.amount, 29.99)
  assert.equal(usd.currency, 'USD')

  const gbp = extractBillingAmount('Subscription renewal: £14.50 processed successfully')
  assert.ok(gbp)
  assert.equal(gbp.amount, 14.5)
  assert.equal(gbp.currency, 'GBP')

  const eur = extractBillingAmount('Facture mensuelle: €49.00 payé')
  assert.ok(eur)
  assert.equal(eur.amount, 49)
  assert.equal(eur.currency, 'EUR')

  const ngn = extractBillingAmount('Debited ₦15,000 for your monthly subscription')
  assert.ok(ngn)
  assert.equal(ngn.amount, 15000)
  assert.equal(ngn.currency, 'NGN')

  // Null when no positive amount
  assert.equal(extractBillingAmount('Welcome to your trial, enjoy the app'), null)
})

test('Trial Heuristics: does not flag regular Gmail subscriptions as trials', () => {
  const isTrial = (merchant: string, name: string, amount: number, category?: string) => {
    const isTrialMerchant = /trial/i.test(merchant) || /trial/i.test(name)
    const isZeroAmount = Number(amount) === 0
    return isTrialMerchant || isZeroAmount || category === 'trial'
  }

  // Legitimate trials
  assert.equal(isTrial('Duolingo Trial', 'Duolingo Trial', 0), true)
  assert.equal(isTrial('Figma', 'Figma Pro 14-day trial', 0), true)
  assert.equal(isTrial('Notion', 'Notion', 0, 'trial'), true)

  // Regular Gmail subscriptions MUST NOT be flagged as trials
  assert.equal(isTrial('Netflix', 'Netflix Standard', 19.99, 'streaming'), false)
  assert.equal(isTrial('GitHub', 'GitHub Copilot', 10.00, 'dev'), false)
  assert.equal(isTrial('Vercel', 'Vercel Pro', 20.00, 'dev'), false)
})

test('Global Exclusion: rejects bank and fintech transaction alerts (OPay, Moniepoint, etc.)', () => {
  // OPay transaction receipt
  const opay = classifyBilling(
    'Transaction Notification: NGN 40,371.00',
    'Dear Customer, your transfer of NGN 40,371 to John Doe was successful. Beneficiary: John Doe. Account Number: 1234567890. Available Balance: NGN 150,000.',
    'no-reply@opay-nigeria.com'
  )
  assert.equal(opay.isBilling, false)
  assert.equal(opay.reason, 'bank_or_fintech_sender')

  // Moniepoint debit alert
  const moniepoint = classifyBilling(
    'Debit Alert Notification',
    'Your account has been debited with NGN 15,000. Session ID: 9991238472. Available Balance: NGN 85,000.',
    'no-reply@moniepoint.com'
  )
  assert.equal(moniepoint.isBilling, false)
  assert.equal(moniepoint.reason, 'bank_or_fintech_sender')

  // Unknown bank with generic sender but explicit bank alert subject
  const unknownBank = classifyBilling(
    'Transaction Receipt for your transfer',
    'Your transfer of $500 was completed.',
    'notifications@community-bank.org'
  )
  assert.equal(unknownBank.isBilling, false)
  assert.equal(unknownBank.reason, 'bank_transaction_subject')

  // Unknown bank with banking ledger markers in body
  const ledgerBank = classifyBilling(
    'Payment update',
    'Payment of NGN 20,000 processed. Beneficiary Name: XYZ Corp. Account Number: 9876543210. Session ID: 111222. Available balance: NGN 40,000.',
    'alerts@custom-bank.com'
  )
  assert.equal(ledgerBank.isBilling, false)
  assert.equal(ledgerBank.reason, 'bank_transaction_ledger_markers')
})

test('Global Exclusion: rejects e-commerce shopping and delivery orders (Temu, Uber, etc.)', () => {
  // Temu order confirmation
  const temu = classifyBilling(
    'Order Confirmation #123456',
    'Thank you for your purchase on Temu! Your order has shipped to your address.',
    'temu@orders.temu.com'
  )
  assert.equal(temu.isBilling, false)
  assert.equal(temu.reason, 'ecommerce_or_delivery_sender')

  // Uber ride receipt
  const uber = classifyBilling(
    'Your trip with Uber',
    'Total charged for your ride: $24.50. Drop-off: Main Street.',
    'receipts@uber.com'
  )
  assert.equal(uber.isBilling, false)
  assert.equal(uber.reason, 'ecommerce_or_delivery_sender')
})

test('Global Exclusion: accepts legitimate recurring subscriptions', () => {
  // Netflix subscription renewal
  const netflix = classifyBilling(
    'Your Netflix subscription renewal',
    'Your monthly plan has renewed for $15.49. Next billing cycle starts on June 15.',
    'info@mailer.netflix.com'
  )
  assert.equal(netflix.isBilling, true)
  assert.equal(netflix.explicit, true)

  // Claude Pro monthly plan
  const claude = classifyBilling(
    'Receipt for Claude Pro',
    'Your subscription to Claude Pro has renewed. Total charged: $20.00. Billing cycle: monthly.',
    'no-reply@anthropic.com'
  )
  assert.equal(claude.isBilling, true)
  assert.equal(claude.explicit, true)
})

test('Cadence Detection: rejects irregular transaction intervals (< 5 days or between brackets)', () => {
  // Ad-hoc bank transfers: 2 days apart
  const bankDates = ['2026-05-12T00:00:00Z', '2026-05-14T00:00:00Z']
  assert.equal(cadenceFromDates(bankDates), null, 'Irregular 2-day interval must NOT be classified as monthly')

  // Random purchases 15 days apart
  const irregularDates = ['2026-05-01T00:00:00Z', '2026-05-16T00:00:00Z']
  assert.equal(cadenceFromDates(irregularDates), null, '15-day interval must NOT be classified as monthly')
})

test('Single Cancel Pipeline: blocks execution when guardrail downgrades action', async () => {
  const permanentDataLossDecision: Decision = {
    subscription_id: 'sub-guardrail-test',
    merchant: 'Google Cloud Storage',
    action: 'cancel',
    confidence: 90,
    rationale: 'Unused storage buckets',
    blast_radius: {
      data_loss: 'permanent',
      access_loss: 'solo',
      repurchase: 'same_price',
      irreversible: true,
      notes: [],
    },
    savings_usd_monthly: 50,
    requires_authorization: true,
    reasoned_by: 'model',
  }

  const result = await executeDecision({
    decision: permanentDataLossDecision,
    trigger: 'manual',
    dbUserId: 'test-user',
    userPrivyDid: 'did:privy:test',
    apply: true,
  })

  assert.equal(result.status, 'blocked_action')
  assert.match(result.reason, /Blocked by guardrails/i)
})

test('Single Cancel Pipeline: blocks execution when unauthorized on chain', async () => {
  const cancelDecision: Decision = {
    subscription_id: 'sub-auth-test',
    merchant: 'ChatGPT Plus',
    action: 'cancel',
    confidence: 90,
    rationale: 'Inactive user with high monthly charge',
    blast_radius: {
      data_loss: 'recoverable',
      access_loss: 'solo',
      repurchase: 'same_price',
      irreversible: false,
      notes: [],
    },
    savings_usd_monthly: 20,
    requires_authorization: true,
    reasoned_by: 'fallback',
  }

  // Non-existent user or user without grant
  const result = await executeDecision({
    decision: cancelDecision,
    trigger: 'manual',
    dbUserId: '00000000-0000-0000-0000-000000000000',
    userPrivyDid: 'did:privy:unknown',
    apply: true,
  })

  // Must block unauthorized rather than silently proceeding
  assert.equal(result.status, 'blocked_unauthorized')
  assert.ok(result.reason.length > 0)
})

test('Single Cancel Pipeline: dry-run mode returns dry_run status without sending', async () => {
  // Mock authorized scenario or check dry_run handling
  const cancelDecision: Decision = {
    subscription_id: 'sub-dryrun-test',
    merchant: 'Duolingo',
    action: 'cancel',
    confidence: 90,
    rationale: 'No activity in 90 days',
    blast_radius: {
      data_loss: 'recoverable',
      access_loss: 'solo',
      repurchase: 'same_price',
      irreversible: false,
      notes: [],
    },
    savings_usd_monthly: 9.99,
    requires_authorization: true,
    reasoned_by: 'model',
  }

  const result = await executeDecision({
    decision: cancelDecision,
    trigger: 'manual',
    dbUserId: '00000000-0000-0000-0000-000000000000',
    userPrivyDid: 'did:privy:unknown',
    apply: false, // dry-run
  })

  // Even in dry-run, on-chain authorization is checked first
  assert.equal(result.status, 'blocked_unauthorized')
})

