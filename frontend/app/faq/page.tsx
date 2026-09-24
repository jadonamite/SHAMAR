import type { Metadata } from 'next'
import Link from 'next/link'
import AppFooter from '@/components/app/AppFooter'
import TopNav from '@/components/app/TopNav'

export const metadata: Metadata = {
  title: 'FAQ — SHAMAR',
  description:
    'What SHAMAR reads, when it cancels, how to stop it, and how to delete your account.',
}

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'What does SHAMAR do?',
    a: (
      <p>
        It finds the subscriptions you pay for by reading your billing receipts
        in Gmail, works out what cancelling each one would cost you as well as
        what it would save, asks you on Telegram before a renewal, and cancels
        the ones you don&apos;t want. It only acts with a permission you give it
        and can take back at any time.
      </p>
    ),
  },
  {
    q: 'What does SHAMAR read in my Gmail?',
    a: (
      <>
        <p>
          Only receipt-like mail from the last year: messages Gmail files under
          Purchases, or with subjects such as receipt, invoice, subscription or
          renewal. SHAMAR reads those to find the service, the price and the
          date. After the first scan it only looks at mail newer than the last
          one.
        </p>
        <p className="mt-2">
          For each receipt it keeps the service name, the amount, the currency,
          the date and the subject line. It does not keep the rest of the email,
          and it never sends email content to the AI that makes decisions. That
          only sees the service name, its category, the price and when it was
          last charged.
        </p>
      </>
    ),
  },
  {
    q: 'Will SHAMAR cancel something without asking me?',
    a: (
      <>
        <p>
          Not without asking first. Before a renewal, SHAMAR sends you three
          Telegram messages with Cancel and Keep buttons: five days, three days
          and two days before the charge. If you answer none of them, it cancels
          36 hours before the charge and tells you it did.
        </p>
        <p className="mt-2">
          It only does that when all three messages actually reached your own
          linked Telegram chat, you have given it permission, and you
          haven&apos;t paused it. If cancelling would delete your data for good,
          or it is less than 85% sure about a cancel that can&apos;t be undone,
          it only reminds you.
        </p>
      </>
    ),
  },
  {
    q: 'Why do I need to link Telegram?',
    a: (
      <p>
        Telegram is how SHAMAR asks before it acts. Until you link your own chat
        from the Agent page, SHAMAR sends you nothing on Telegram and never
        cancels anything on its own. Every Telegram message goes only to the
        chat you linked.
      </p>
    ),
  },
  {
    q: 'How does SHAMAR cancel a subscription?',
    a: (
      <p>
        It emails a cancellation request to the company&apos;s billing address.
        Companies don&apos;t always act on these, so SHAMAR also puts a reminder
        on your Google Calendar to check for their written confirmation. Keep an
        eye on your next statement until it arrives.
      </p>
    ),
  },
  {
    q: 'Why do I need a wallet?',
    a: (
      <p>
        Your permission for SHAMAR lives in a public contract on Base, the
        network SHAMAR uses. Anyone can check what you allowed, and only your
        wallet can grant it or take it back. Granting costs a small network fee
        in ETH on Base. SHAMAR checks this permission before every cancel.
      </p>
    ),
  },
  {
    q: 'How do I stop SHAMAR?',
    a: (
      <p>
        Send <strong className="text-label">stop</strong> to @shamar_agent_bot
        on Telegram, and nothing more happens until you send{' '}
        <strong className="text-label">resume</strong>. To take the permission
        back for good, press Revoke on the{' '}
        <Link href="/agent" className="text-accent underline font-medium">
          Agent page
        </Link>{' '}
        and confirm in your wallet.
      </p>
    ),
  },
  {
    q: 'Why does Google warn me that the app is not verified?',
    a: (
      <p>
        Google reviews every app that reads Gmail, and SHAMAR&apos;s review is
        still in progress. Until it finishes, Google shows a warning before the
        permission screen. Choose Advanced, then Go to SHAMAR, to continue. The
        permission SHAMAR asks for is read-only: it can&apos;t send, change or
        delete your mail.
      </p>
    ),
  },
  {
    q: 'Which currencies does SHAMAR understand?',
    a: (
      <p>
        Naira, US dollars, euros and pounds. Totals across currencies are
        converted at fixed rates, so treat them as estimates.
      </p>
    ),
  },
  {
    q: 'How do I delete my account?',
    a: (
      <p>
        At the bottom of the{' '}
        <Link href="/agent" className="text-accent underline font-medium">
          Agent page
        </Link>
        , type DELETE and confirm. SHAMAR removes your subscriptions, decisions,
        history, rules, Telegram link and saved Gmail access, and asks Google to
        cancel its access. Permissions on Base are public records that SHAMAR
        can&apos;t erase, so press Revoke before you delete.
      </p>
    ),
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav title="FAQ" />

      <main className="flex-1 px-4 sm:px-6 py-10 md:py-12 max-w-3xl w-full mx-auto">
        <header className="mb-10 pb-6 border-b border-separator/80">
          <h1 className="type-title-1 font-[600] text-label tracking-tight mb-2">
            Frequently asked questions
          </h1>
          <p className="type-callout text-label-2">
            Something not covered here?{' '}
            <Link href="/support" className="text-accent underline font-medium">
              Get support
            </Link>
            .
          </p>
        </header>

        <div className="space-y-8 type-callout leading-relaxed text-label-2">
          {QUESTIONS.map(({ q, a }) => (
            <section key={q}>
              <h2 className="type-headline font-semibold text-label mb-2">
                {q}
              </h2>
              {a}
            </section>
          ))}
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
