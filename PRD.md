# SHAMAR: product requirements

Last updated 2026-09-22. Companion documents: `TECHNICAL_ARCHITECTURE.md` for how it is
built, `PROGRESS.md` for where the build stands.

## 1. The problem

A person paying for eight or ten digital subscriptions forgets two or three of them. The
forgotten ones renew every month because renewing needs nothing from the person and
cancelling needs a login, a retention screen and sometimes a phone call. The whole category
earns money from that asymmetry.

The tools that exist today find the subscriptions and hand over a list. The decision stays
with the person, and so does the work, because the tool has no idea what cancelling would
cost. Cancelling can delete a design library for good, cut off a teammate on a shared plan,
or give up a price the service no longer sells. A list of charges says nothing about any of
that.

SHAMAR takes the decision and the work. It reads receipts, works out what cancelling would
cost as well as what it would save, asks the person before a renewal, and acts if they don't
answer. It will not act without a grant the person gave it and can revoke.

## 2. Who it is for

The first user pays for subscriptions in more than one currency and reads receipts in
Gmail: someone in Lagos paying for Showmax in naira, Spotify in dollars and a design tool
billed to a card. The subscription registry already carries iROKOtv, Showmax and Boomplay
next to Netflix and Figma. The static FX table converts NGN, USD, EUR and GBP.

They reach SHAMAR on the web at shamar.namite.xyz, signed in with Privy (email, Google or
wallet).

They are not assumed to know what a smart contract is. Every on-chain step has to make sense
to someone who has never heard the word.

## 3. What the product is

An agent you can safely hand a recurring bill to. Subscriptions are the task because
everyone understands them in a few seconds. The safety comes from two limits that do not
depend on trusting SHAMAR's own code: an on-chain grant that says what the agent may do,
and (in the card tier) a card-network ceiling that says what it can spend.

## 4. Tiers

The card is a feature, and it is opt-in. The default tier has to be a complete product
without it.

| | Default tier | Card tier (later) |
|---|---|---|
| How subscriptions are found | Gmail receipts | The charges on the card itself |
| How cancelling works | Email to the merchant's billing address | Close or pause the card |
| What the person has to do | Connect Gmail and Telegram, grant the scope | Also pass KYC and fund a balance |
| How certain the cancel is | Best effort. The merchant can ignore the email | The next charge declines |

The pipeline that decides (evidence, judgment, guardrails, authorization) is the same for
both tiers and does not know how a subscription is paid. Only the last step changes, behind
an adapter.

The default tier's weakness is real, and the interface says so. After an email
cancellation, SHAMAR puts a calendar event on the person's calendar telling them to watch
for written confirmation.

## 5. Requirements, default tier

### 5.1 Detection

- R1. Connect Gmail with one OAuth consent that covers read-only mail and calendar events.
- R2. Scan up to a year of mail on first connect, then only mail newer than the last
  completed scan. A scan cut short by the time limit resumes where it stopped.
- R3. A merchant becomes a subscription only with two or more billing emails, or one email
  that says in plain words it is a subscription. One-off purchases are left out.
- R4. Amount, currency and cadence come from the receipts. Cadence is the median gap
  between charges, not a keyword in the subject line.
- R5. A charge whose amount could not be read is shown, but SHAMAR never cancels it.

### 5.2 Judgment

- R6. For each subscription SHAMAR returns one action (cancel, pause, remind or keep), a
  confidence from 0 to 100, a one or two sentence reason, and a blast radius: data loss,
  shared access, repurchase price, and whether the change can be undone.
- R7. When no model answers, a deterministic rule makes the decision and the response says
  so (`reasoned_by: fallback`).
- R8. Guardrails run after every decision and the model cannot argue past them. Permanent
  data loss turns a cancel into a remind. An irreversible cancel below 85% confidence turns
  into a remind. Each downgrade writes its reason into the record.

### 5.3 Asking the person

- R9. Before a renewal, SHAMAR sends a Telegram message with Cancel and Keep buttons, at
  120, 72 and 48 hours before the charge.
- R10. If none of the three is answered, SHAMAR cancels 36 hours before the charge and says
  so. Not 24: an emailed cancellation needs time for the merchant to act on it before the
  card is charged.
- R11. `/stop` in Telegram halts every dispatch until `/resume`. If Telegram can't be
  reached, the last known state stands. An unreadable channel never grants permission.
- R12. The renewal schedule runs by itself. Today it only runs when someone calls
  `/renewals/tick`, so it does not meet this requirement yet.

### 5.4 Authorization

- R13. Before any cancel or pause, SHAMAR checks `SHAMARPolicy.isAuthorized(user, agent,
  scope)` on Base mainnet (`0xCcdF06aa225864B775de2bCA38403916375B6933`). The grant is
  scoped (`shamar.cancel`, `shamar.pause`, `shamar.remind`, `shamar.analyze`), can carry an
  expiry, and can be revoked by the person at any time. A fifth scope, `shamar.pay`, belongs
  to the card tier and is never part of the default grant.
- R14. If the chain can't be read, SHAMAR may act under a local grant that has an expiry,
  and it reports that the source was local.
- R15. The person can grant and revoke from the interface without leaving it.

### 5.5 Acting

- R16. Every cancel, from every trigger (a run, a Telegram button, silence, a user policy),
  goes through the same path: guardrails, authorization, halt check, dispatch, record. Today
  there are three separate paths and only one of them checks authorization. See
  `PROGRESS.md`.
- R17. A cancellation already sent and not reversed is never sent twice.
- R18. The record is written only after the email is accepted, and it carries an EIP-191
  signature from the agent key. A failed send leaves no record claiming success.
- R19. Dry run is the default everywhere. Nothing is sent without `apply: true`.
- R20. Kept subscriptions get their next renewal written to Google Calendar. Re-running
  updates the event rather than creating a second one.

### 5.6 The interface

- R21. A person can see, for each subscription, what SHAMAR decided, why, and what
  cancelling would cost them.
- R22. A person can see every action SHAMAR took, with its signature, and reverse the ones
  that can be reversed.
- R23. A person can see at a glance whether the agent is authorized, halted, or blocked,
  and why.
- R24. The interface follows the Apple Human Interface Guidelines for structure and
  behaviour: 44px minimum touch targets, both light and dark themes, reduced-motion support.
  Visual identity is SHAMAR's own.
- R25. Terms of service, a privacy policy, a cookie policy and a consent banner ship with
  the build and are linked from the footer. The footer links are `#` placeholders today.

### 5.7 Identity and data

- R26. The server verifies who is calling. Today it trusts an `x-user-id` header, so anyone
  who knows or guesses a Privy DID can act as that person. This has to be fixed before real
  users.
- R27. Gmail tokens stay on the server and are never sent to the browser.
- R28. A person can delete their account and everything SHAMAR stored about them.

## 6. Requirements, card tier

This tier is built after the default tier passes end to end. It uses agentcard.sh. What the
provider's CLI source shows (checked 2026-09-22, details in `HANDOVER.md`):

- Only issued cards have a card number a merchant can charge. They need KYC and a prefunded
  USDC balance. The no-KYC option never produces a card number, so it cannot pay Netflix.
- A multi-use card's limit is a lifetime total set aside from the balance. It runs out
  after a fixed number of renewals unless SHAMAR raises it.
- Personal plans cap cards at $50, $500 or $1,000 each. A company account with a per-user
  OAuth connection has no plan caps, and each end user is their own cardholder.

Requirements:

- C1. One multi-use card per subscription, with its limit set from the subscription's price.
- C2. Cancel closes the card. Pause pauses it. A `close_blocked` answer is a failure, not a
  cancel.
- C3. Before each renewal, SHAMAR checks the card has enough left for the charge. If it
  doesn't, the person hears about it before the charge declines. A decline on a
  subscription the person chose to keep is worse than a wrong cancel.
- C4. A declined charge over the ceiling is reported as a possible price rise.
- C5. The person can leave the card tier and go back to the default tier without losing
  anything.

Open until there is an account: the issuing-rail ceiling, whether the per-month rule is
enforced by the card network, fees, the cap on active multi-use cards, webhook event names,
and whether a resident of Nigeria can pass KYC.

## 7. Out of scope

- Cancelling by logging in to the merchant's site. Too brittle, and the person's password
  would have to be handed over.
- Crypto wallets as the way subscriptions are paid. A wallet can't pay Netflix.
- Extracting the agent machinery into a shared chassis for other products. Deferred until
  SHAMAR works properly.
- Knowing how much a person uses a subscription. Receipts and card charges say what was
  paid, never what was used. This limits how good judgment can get, and it stays an open
  problem.

## 8. How we know it works

- A person connects Gmail and sees their real subscriptions within one scan, with the
  right amounts and cadences.
- A staged renewal sends three Telegram notices, and silence cancels it with a signed
  record.
- Revoking `shamar.cancel` on chain stops the next cancel, whichever trigger fired it.
- `/stop` from a phone stops the next dispatch.
- The whole default tier passes an end-to-end run against a real Gmail inbox, with
  `DISPATCH_RECIPIENT` set so no merchant is emailed.
