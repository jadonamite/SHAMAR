# SHAMAR

**An agent you can hand a recurring bill to.**

Ask people what they spend on subscriptions and they say around $86 a month. The real figure
is $219. Seven in ten have been charged for a free trial they meant to cancel, and $15.5
billion a year goes to apps nobody opens.

None of that is forgetfulness. Renewing requires nothing. Cancelling requires a login, a
retention screen and sometimes a phone call, and when the FTC tried to force click-to-cancel
in 2025 the rule was struck down. The friction is the business model, and it is now legally
protected.

You already know you should audit this. You have known for months. The reason you have not is
that cancelling the wrong thing takes a design library with it, or cuts off a teammate, or
gives up a price the service stopped offering, and no list of charges tells you which is
which.

SHAMAR makes the call. It reads your receipts, weighs what cancelling costs against what it
saves, asks you three times, and acts if you never answer.

[Live](https://shamar.namite.xyz) · [Demo video](https://www.youtube.com/watch?v=ZtTMTnJ5Ebk)

## It decides, which is the whole point

Every other tool in this category finds your subscriptions and hands you a list, which is the
easy half of the job dressed up as the whole of it. The work stays with you. A list knows the
price of a thing and nothing about the cost of losing it.

SHAMAR returns a blast radius instead. Permanent data loss. Shared access somebody else
depends on. A repurchase price higher than the one you are on. Those are the facts that
decide whether a $9 subscription is worth keeping, and no amount of spending analysis
surfaces them.

Then it enforces limits on its own reasoning. Permanent data loss turns a cancel into a
reminder. Anything irreversible below 85% confidence, the same. An amount it could not parse
is never cancelled at any confidence. Each downgrade writes its own reason into the record,
so you can watch the agent overrule itself.

## Authority you grant, and take back in one transaction

An agent that can only suggest is a newsletter. SHAMAR acts, and acting on your behalf means
holding real authority, which means you need a real way to withdraw it.

`SHAMARPolicy` is live on Base mainnet at
[`0xCcdF06aa225864B775de2bCA38403916375B6933`](https://basescan.org/address/0xCcdF06aa225864B775de2bCA38403916375B6933),
carrying five scopes: `shamar.cancel`, `shamar.pause`, `shamar.remind`, `shamar.analyze`, and
`shamar.pay`, which the card tier needs and nobody gets by default. You grant the ones you
want. They expire when you say. Revoking is a single transaction from your own
wallet, and the agent reads that grant before every action it takes.

Not a promise written in our code. A permission written in yours, and anyone can read it on
Basescan without asking us anything.

`/stop` on Telegram halts a run mid-flight. If Telegram is unreachable, the last known halt
stands, because a control channel nobody can read does not grant permission.

## It asks first, and silence is not consent

Before a renewal, a notice arrives on Telegram.

```
CLAUDE PRO renews on the 16 September.

$20.00 / monthly

Reply below. Silence means SHAMAR cancels it 36 hours before renewal.
68h remaining.

        [ Cancel it ]   [ Keep it ]
```

Keep it, and the notices stop. Cancel it, and it goes. Say nothing, and it asks again at 72
hours and at 48, each one more insistent than the last, then cancels a day and a half ahead
of the charge, early enough for the merchant to act on it, and tells you exactly what it did.

That default is deliberate. An unanswered renewal is not consent, and wrongly cancelling
something cheap costs less than silently renewing something forgotten.

## Give it a card and cancelling stops being a request

Emailing a merchant to cancel is asking. The merchant can route you to a retention screen, or
a phone line, or nothing at all, and the entire category is built on that friction.

A card removes the conversation. Each subscription gets its own virtual card with its own
ceiling, so cancelling is closing the card and the next charge simply declines. A silent
price rise declines too, and tells SHAMAR why. A free trial converting is the first charge
above zero. The blast radius of any mistake stops at one subscription.

| | Default | Card |
|---|---|---|
| Subscriptions found by | Gmail receipts | The charges themselves |
| Cancelling works by | Emailing the merchant | Closing the card |
| Certainty | The merchant has to cooperate | The next charge declines |

The card is opt-in and the default tier is a complete product without it. The pipeline that
decides does not know or care how a subscription is paid; only the last step changes.

## How it works

```
EVIDENCE          deterministic facts from Gmail receipts
    ↓
JUDGMENT          a model weighs what cancelling costs, not only what it saves
    ↓
GUARDRAILS        constraints the model cannot argue past
    ↓
AUTHORIZATION     the on-chain grant, plus the Telegram control channel
    ↓
DISPATCH          the cancellation, then a signed record
```

Evidence is never model-generated. Amounts, cadence and dates come from parsing receipts, and
cadence is the median interval between real charges rather than whatever a subject line
claims. 165 services in the registry, including iROKOtv, Showmax and Boomplay alongside
Netflix and Figma, priced across naira, dollars, euros and pounds.

Reasoning fails over from Groq to NVIDIA to a deterministic decision, and the response says
which path it took. Dry-run is the default everywhere; `apply: true` has to be asked for. A
real dispatch is recorded `reversible: false`, because an email to a merchant cannot be undone
by editing a database row.

| Service | What the agent does | Code |
|---|---|---|
| Gmail | Scans receipts for recurring charges, amounts and cadence | `server/src/routes/gmail.ts` |
| Google Calendar | Writes each renewal date, and the date a cancellation went out | `server/src/lib/calendar.ts` |
| Resend | Sends the cancellation to the merchant's billing address | `server/src/lib/dispatch.ts` |
| Telegram | Asks before each renewal, reports every dispatch, halts on `/stop` | `server/src/lib/telegram.ts` |
| Base | Reads the grant before acting | `server/src/lib/agent.ts` |

## Running it

Node 20 or later, Postgres, and a Resend account with a verified sending domain.

```bash
git clone https://github.com/jadonamite/SHAMAR && cd SHAMAR

cd server && npm install
cp .env.example .env
npx tsx src/index.ts          # http://localhost:3001

cd ../frontend && npm install
npm run dev                   # http://localhost:3000/run
```

Environment, endpoints and migrations are in `TECHNICAL_ARCHITECTURE.md`.
