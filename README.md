# SHAMAR

**A subscription agent that treats cancelling as a one-way door.**

Most subscription tools find what you pay for and hand you a list. The decision
stays yours, because the tool has no idea what cancelling would cost you —
whether the data is deleted, whether a teammate loses access, whether the price
you re-subscribe at is the price you're on now.

SHAMAR makes that decision, and then acts on it: it reads your inbox, reasons
about blast radius, puts the renewal date on your calendar, emails the merchant
a cancellation request, and reports what it did — refusing to act at all if
authorization is absent or you've told it to stop.

---

## Demo

📹 **Video:** _link pending_

🔗 **Live:** https://shamar.namite.xyz

---

## External apps the agent interacts with

| App | Direction | What the agent does | Code |
|---|---|---|---|
| **Gmail** | read | Scans receipts to detect recurring charges, amounts, and cadence | `server/src/routes/gmail.ts` |
| **Google Calendar** | write | Writes each renewal date, and the date a cancellation was requested | `server/src/lib/calendar.ts` |
| **Resend** | send | Dispatches the cancellation request to the merchant's billing address | `server/src/lib/dispatch.ts` |
| **Telegram** | read + write | Asks before each renewal with inline Cancel/Keep buttons, reports every dispatch, and `/stop` halts the agent mid-run | `server/src/lib/telegram.ts`, `renewal.ts` |
| **Celo** (`SAMPolicy`) | read | Checks a scoped, expiring, revocable on-chain grant before acting | `server/src/lib/agent.ts` |

The contract is live on Celo mainnet at
[`0x18fbb7eec6e7a48f4a1ea265ace191e845b8ea9a`](https://celoscan.io/address/0x18fbb7eec6e7a48f4a1ea265ace191e845b8ea9a)
with four registered scopes — `sam.cancel`, `sam.pause`, `sam.remind`,
`sam.analyze`. Anyone can verify the agent's permissions without trusting this
repository.

---

## It asks before it acts

Before a subscription renews, SHAMAR sends a notice to Telegram with two
buttons:

```
CLAUDE PRO renews on the 16 September.

$20.00 / monthly

Reply below. Silence means SHAMAR cancels it 24 hours before renewal.
_68h remaining._

        [ ✕  Cancel it ]   [ ✓  Keep it ]
```

- **Keep it** — the decision is recorded and no further notices are sent
- **Cancel it** — cancelled immediately
- **Silence** — four notices go out at 120h, 72h, 48h and 36h before renewal,
  each more insistent than the last. If none is answered, SHAMAR cancels the
  subscription 24 hours before it would charge, and says so.

The default is deliberate. An unanswered renewal is not consent, and the cost
of wrongly cancelling something cheap is smaller than the cost of silently
renewing something forgotten.

Button presses are read on a separate update offset from the `/stop` control
channel, so neither consumes the other's messages, and a decision already taken
is never re-asked.

```
POST /renewals/tick          one pass of the schedule, dry-run by default
POST /renewals/poll          read pending button presses
GET  /renewals/:id           notice state for one subscription
POST /renewals/stage         position a renewal for demonstration
```

---

## How it decides

```
EVIDENCE          deterministic facts from Gmail receipts
    ↓
JUDGMENT          a model weighs what cancelling costs, not only what it saves
    ↓
GUARDRAILS        constraints the model cannot argue past
    ↓
AUTHORIZATION     on-chain grant + Telegram control channel
    ↓
DISPATCH          the cancellation email, then a signed record
```

**Evidence** is never model-generated. Amounts, cadence and dates come from
parsing receipts; cadence is inferred from the median interval between charges
rather than from subject-line keywords.

**Judgment** returns a structured blast radius — data loss, shared access,
repurchase price — not a score.

**Guardrails** run after every decision, model-sourced or not:

- permanent data loss → `cancel` is downgraded to `remind`
- irreversible below 85% confidence → downgraded to `remind`
- an amount that could not be parsed → never cancelled, at any confidence

Each downgrade writes its own reason into the decision, so the trail shows the
agent overruling itself.

---

## Reliability

Every external dependency degrades rather than failing the run, and says which
path it took.

| Failure | Behaviour |
|---|---|
| Model provider down | Fails over to the second provider, then to a deterministic decision. Response reports `fell_back: N` |
| No model configured at all | Server still boots; reasoning degrades, nothing crashes |
| Telegram unreachable | Last known halt state stands — an unreadable control channel does not grant permission |
| Cancellation already sent | `skipped_duplicate`; a dispatched, unreversed cancellation is never sent twice |
| Calendar write conflict | Deterministic event ids mean a re-run updates rather than duplicates |
| Resend rejects the send | No attestation is written — a failed send leaves no record claiming success |
| Authorization absent | `blocked_unauthorized`; nothing is dispatched |

Dry-run is the default everywhere. `apply: true` must be asked for explicitly.

A real dispatch is recorded `reversible: false`, because an email to a merchant
cannot be undone by changing a database row.

---

## Running it

Requires Node 20+, a Postgres database (Neon), and a Resend account with a
verified sending domain.

```bash
git clone https://github.com/jadonamite/SHAMAR && cd SHAMAR

# server
cd server && npm install
cp .env.example .env     # fill in the values below
npx tsx src/index.ts     # http://localhost:3001

# frontend, in a second shell
cd frontend && npm install
npm run dev              # http://localhost:3000/run
```

### Environment

```bash
# required
NEON_DATABASE_URL=          # Postgres connection string
RESEND_API_KEY=             # resend.com
RESEND_FROM=                # must be a verified sending domain

# reasoning — without these every decision falls back to deterministic logic
GROQ_API_KEY=
NVIDIA_API_KEY=             # optional second provider

# Gmail + Calendar (one OAuth client, both scopes)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://localhost:3001/gmail/callback

# Telegram control channel
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# on-chain authorization
SAM_POLICY_CONTRACT=0x18fbb7eec6e7a48f4a1ea265ace191e845b8ea9a
AGENT_ADDRESS=
AGENT_PRIVATE_KEY=

# where cancellations go during a demo, instead of real merchants
DISPATCH_RECIPIENT=
```

Apply `server/src/schema/migrations.sql` and the numbered migrations, then:

```sql
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY, value JSONB NOT NULL,
  expires_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Endpoints

```
POST /gmail/scan                detect subscriptions from receipts
GET  /intelligence/evidence     the facts reasoning runs on
POST /intelligence/reason       reason over everything, dry-run by default
POST /execute                   reason → authorize → dispatch
GET  /execute/authorization     current on-chain grant
GET  /execute/control           halt state
```

`DISPATCH_RECIPIENT` redirects every cancellation to one address. Set it before
running `apply: true` against real data unless you intend to email merchants.

---

## License

MIT
