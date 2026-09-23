# SHAMAR: technical architecture

Last updated 2026-09-22. Describes the code as it is, then the changes the PRD needs. What
to build is in `PRD.md`; the order it gets built in is in `PROGRESS.md`.

## Shape

Two deployables and one contract.

```
frontend/   Next.js 16, React 19, Tailwind 4           shamar.namite.xyz
server/     Hono on Node 20, one Vercel function        /api/* is rewritten here
contracts/  SHAMARPolicy.sol                            Base mainnet 0xCcdF...6933
```

The frontend never talks to Google, Telegram or the chain for the agent's work. It calls the
server through the `/api/:path*` rewrite in `frontend/next.config.ts`. The one exception is
the grant itself: the person's own wallet signs `grantDefaultScopes` in
`frontend/app/agent/page.tsx`, because only the person can give the agent permission. The
page takes the contract and agent addresses from `GET /agent/status`, so the grant always
lands on the contract the server checks. (Before 2026-09-23 the page had its own
hard-coded address, a different contract from the server's.)

State lives in one Neon Postgres database. There is no Redis. `server/src/lib/cache.ts`
wraps a `kv` table in a Redis-shaped `get`/`set`/`del` so older call sites kept working
when Upstash was removed.

## The pipeline

```
EVIDENCE        routes/gmail.ts          receipts to subscriptions rows
   |
JUDGMENT        lib/reasoning.ts         decide(): model, else fallbackDecision()
   |
GUARDRAILS      lib/reasoning.ts         applyGuardrails(), after every decision
   |
AUTHORIZATION   routes/execute.ts        resolveAuthorization() + pollControl()
   |
DISPATCH        lib/dispatch.ts          email the merchant, then logAction()
```

### Evidence

`POST /gmail/scan` builds one Gmail search from every billing domain in
`lib/subscriptions-registry.ts` (165 services), so Gmail filters before anything is
downloaded. Each message passes a billing-intent check (`classifyBilling`), then an amount
parse (`extractBillingAmount`). Candidates are grouped by merchant. A group becomes a row in
`subscriptions` only with two or more receipts, or one that calls itself a subscription.

The scan has a 50 second budget inside a 60 second function. It saves a Gmail page token
when cut short and resumes from it on the next call. A finished scan stores a high-water
mark, and later scans only ask for mail `after:` it. A `scan_lock:<user>` row in `kv`
prevents two scans running at once.

When the scan ends, `quickPass()` writes a deterministic recommendation for every
subscription so the dashboard has something to show before any model is called.

### Judgment and guardrails

`decide()` in `lib/reasoning.ts` sends one subscription at a time to a model through
`lib/ai.ts`, which tries Groq, then NVIDIA, each with a 12 second timeout and no retries.
The prompt carries the price, days since the last charge, how many billing cycles have been
missed, and a category prior for data loss and shared access.

If there is no model, or its output doesn't parse, `fallbackDecision()` decides from the
same evidence with fixed rules. `reasoned_by` records which one ran.

`applyGuardrails()` runs on every decision from either source. It is the only place that
knows permanent data loss caps an action at `remind`, and that an irreversible cancel needs
85% confidence. An unpriced subscription never reaches the model: `unpricedDecision()`
returns `remind` at 100% confidence.

`reasonOverAll()` runs three model calls at a time. `POST /execute` replays decisions saved
in `recommendations` unless it is called with `fresh: true`, because a full live pass can
outlast the function.

### Authorization

`resolveAuthorization()` in `routes/execute.ts` checks, in order:

1. `SHAMARPolicy.isAuthorized(wallet, agent, keccak256("shamar.cancel"))` on Base mainnet
   through `BASE_RPC_URL`, defaulting to `mainnet.base.org`. Skipped when `ONCHAIN_AUTH=off`, or when the agent key, contract or
   user wallet is missing.
2. `LOCAL_GRANT_UNTIL`, an ISO date in the environment. Used only if the chain can't be
   read. The response says `source: "local"`.
3. Otherwise, denied, with the reason.

A 6 second timeout on the whole check returns a denial, never a grant.

`pollControl()` in `lib/telegram.ts` reads Telegram updates, applies `/stop` and `/resume`,
and stores the halt flag in `kv` as `shamar:halted`. A dispatch goes out only when
authorization is granted and the agent is not halted.

### Dispatch and the record

`dispatchCancellation()` in `lib/dispatch.ts` refuses anything that isn't a cancel, refuses
a second cancel for the same subscription, finds the recipient as `billing@<first registry
domain>` (or `DISPATCH_RECIPIENT` when set), and sends through Resend. Only after Resend
accepts does `logAction()` in `lib/actions.ts` sign the record with the agent key (EIP-191
`personal_sign` over the sorted JSON payload) and write it to `actions`. The subscription
then moves to `cancelled`.

The Telegram report and a calendar event ("cancellation requested, watch for confirmation")
follow a successful send.

### Renewals

`lib/renewal.ts` keeps one `renewal:<subscription>` record in `kv` per subscription: renewal
date, notices sent, the person's decision. `tick()` applies button presses, sends whichever
notice has come due (120, 72 and 48 hours out), and auto-cancels inside the last 36 hours.
Button presses are read on their own update offset (`shamar:cb_offset`) so they don't
swallow `/stop` messages, which use `shamar:tg_offset`.

Nothing calls `tick()` on a schedule. The only cron in `server/vercel.json` is
`/reminders/send-due` at 09:00 daily.

### User policies

`routes/policies.ts` lets a person write rules (`trial_cancel`, `spend_alert`,
`inactivity_pause`). `POST /policies/evaluate` runs them and, with `apply`, changes the
subscription status and writes a signed action.

## Data

| Table | Holds |
|---|---|
| `users` | Privy DID, wallet address, Self verification flag, a local `policy_granted` flag |
| `subscriptions` | Merchant, amount, currency, cadence, source (`gmail` or `wallet`), status |
| `signals` | Meant for per-charge evidence. Nothing writes to it, so `charge_count` is always 0 |
| `recommendations` | The latest decision per subscription (older ones are deleted) |
| `actions` | Every action, with signature, agent address, payload, reversible, reversed_at |
| `reminders` | Scheduled reminder emails |
| `policies`, `policy_events` | User rules and which subscriptions each has fired on |
| `kv` | Gmail tokens, sync cursors, scan locks, halt flag, Telegram offsets, renewal state |

The schema is spread over `schema/migrations.sql` and `migration_v2` to `v5`. `v2` and `v5`
add the same columns twice; both use `IF NOT EXISTS`, so running both is harmless. The `kv`
table is created only by the snippet in the README.

`recommendations` loses the blast radius. `persistDecision()` stores the rationale and notes
as a flat list, and `cachedDecisions()` rebuilds a blast radius with `recoverable` and
`solo` filled in by default and marks every replay `reasoned_by: model`, even when the
fallback wrote it.

## External services

| Service | Used for | Fails to |
|---|---|---|
| Gmail API (`gmail.readonly`) | Receipts | Scan returns an error; nothing else breaks |
| Google Calendar (`calendar.events`) | Renewal and cancellation events | Run continues, `calendar_connected: false` |
| Groq, NVIDIA | Judgment | Deterministic fallback |
| Resend | Cancellation email | `failed`, no record written |
| Telegram Bot API | Notices, buttons, `/stop` | Last known halt state |
| Base RPC (`mainnet.base.org`) | `isAuthorized` | Local grant, else denial |
| Etherscan v2 (chain 8453, Base) | Wallet subscription detection | Scan returns empty |
| Privy | Web sign-in | Pages that don't need login still load |
| Self | Identity verification | Accepts without proof outside production |

## The contract

`SHAMARPolicy.sol` (version 3.0.0) is deployed on Base mainnet at
`0xCcdF06aa225864B775de2bCA38403916375B6933`. Owner `0xF6795a9E2E9ae0F96CD46b3F9b3F1d24EaD77638`,
agent `0x3eA23AA1d53eb5209F014F02cA889A6A7B37eed0`, five registered scopes:
`shamar.cancel`, `shamar.pause`, `shamar.remind`, `shamar.analyze`, `shamar.pay`. Checked
on chain 2026-09-23.

It stores, per user, per agent, per scope, an expiry. `isAuthorized` is true when a grant
exists, it has no expiry or the expiry is in the future, and the contract is not paused.
The person calls `authorize`, `authorizeBatch` or `grantDefaultScopes`; they revoke with
`revoke`, `revokeBatch` or `revokeAll`. `grantDefaultScopes` grants the first four with no
expiry. `shamar.pay` is left out on purpose: paying needs its own explicit grant. The owner
can register scopes, change the agent and pause everything.

`SAMPolicy.sol` is the previous version, still live on Celo at
`0x18fbb7eec6e7a48f4a1ea265ace191e845b8ea9a` and no longer read by anything.
`sam-policy.clar` is a Clarity port for Stacks that was never deployed.

## Where the code and the PRD disagree

These are the changes the PRD needs, in the order they matter.

**1. Three cancel paths, one checked.** `POST /execute` checks the grant and the halt flag,
emails the merchant and signs a record. The Telegram Cancel button (`pollDecisions`) and
the silent auto-cancel (`tick`) only set `status = 'cancelled'`: no grant check, no halt
check, no email, no record. The policy engine sets the status and signs a record, but checks
neither grant nor halt and emails nobody. So the path the README leads with, silence means
cancel, never actually contacts the merchant, and a revoked grant doesn't stop it.

The fix is one function that every trigger calls:

```ts
executeDecision({ decision, trigger, userId, apply }) -> DispatchResult
  // guardrails (again, cheap) -> authorization -> halt -> adapter.cancel() -> logAction()
```

`dispatchCancellation()` becomes the email adapter behind it.

**2. The caller isn't verified.** Every route trusts `x-user-id`. `/run` defaults to a
hard-coded DID and takes any other from `?user=`. The fix is to verify a Privy access token
on the server (`@privy-io/server-auth`) and derive the DID from it. MiniPay users, who have
no Privy session, sign a short message with the injected wallet and the server checks the
signature.

**3. Revoke in the interface doesn't revoke.** The Revoke button calls
`/agent/revoke-policy`, which clears `users.policy_granted`. The on-chain grant stays, and
the on-chain grant is what `resolveAuthorization` reads. Revoke has to call `revokeAll` from
the person's wallet.

**4. Telegram is one chat for everyone.** `TELEGRAM_CHAT_ID` is a single environment value.
Every user's notices go to the same chat, and one person's `/stop` halts all users. It needs
a per-user link: the person opens `t.me/<bot>?start=<one-time code>`, the server stores
their chat id against their user, and the halt flag becomes `shamar:halted:<user>`.

**5. Renewals don't run on their own.** Add a cron that calls `tick()` for every user with
a linked Telegram chat. Vercel crons on the Hobby plan run at most daily, and the 36 and 24
hour windows need at least hourly, so either the Pro plan or an outside scheduler.

**6. `trial_cancel` matches everything from Gmail.** `looksLikeTrial` is true when
`source === 'gmail'`, which is every subscription the scan found. With `apply`, a
`trial_cancel` policy set to cancel marks all of them cancelled after seven days.

**7. Replays misreport.** Store the full decision as JSON in `recommendations` so a replay
returns what was decided, including `reasoned_by`.

## The execution adapter

The card tier plugs in here. The pipeline above the adapter doesn't change.

```ts
interface ExecutionRail {
  kind: 'email' | 'card'
  cancel(sub, ctx): Promise<RailResult>   // email: send request   card: close_card
  pause(sub, ctx): Promise<RailResult>    // email: unsupported    card: pause_card
  resume(sub, ctx): Promise<RailResult>   // email: unsupported    card: resume_card
  reversible(action): boolean             // email: never          card: pause yes, close no
}
```

A subscription carries its rail (`subscriptions.rail`, default `email`). The adapter is
chosen per subscription, not per user, so a person can move one subscription to a card and
leave the rest on email.

`RailResult` keeps the statuses `DispatchResult` already uses (`sent`, `dry_run`,
`skipped_duplicate`, `blocked_unauthorized`, `failed`) and adds `blocked_by_rail` for a card
that refuses to close.

The card rail also needs two things the email rail doesn't:

- A webhook endpoint for agentcard.sh events (decline, charge, low balance). A decline over
  the ceiling becomes evidence ("possible price rise"). A charge becomes `last_charged`,
  which replaces receipt parsing for that subscription.
- A balance check inside `tick()`. If the card's remaining limit is below the next charge,
  the Telegram notice says so and offers to top up, before the renewal date.

## Running and deploying

Local: `npx tsx src/index.ts` in `server/` (port 3001), `npm run dev` in `frontend/` (port
3000). Deploy: `server/` builds with `tsc` to `dist/`, and `server/api/index.ts` wraps
`dist/app.js` for Vercel with a 60 second limit. Git deploys are disabled in the root
`vercel.json`, so every deploy is manual.

There are no automated tests. Every check so far has been a manual call or a throwaway
script.
