import type { Metadata } from 'next'
import AppFooter from '@/components/app/AppFooter'
import TopNav from '@/components/app/TopNav'

export const metadata: Metadata = {
  title: 'Privacy policy — SHAMAR',
  description:
    'How SHAMAR handles Gmail tokens, subscription data, calendar events, and on-chain records.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav title="Privacy Policy" />

      <main className="flex-1 px-4 sm:px-6 py-10 md:py-12 max-w-3xl w-full mx-auto">
        <header className="mb-10 pb-6 border-b border-separator/80">
          <h1 className="type-title-1 font-[600] text-label tracking-tight mb-2">
            Privacy policy
          </h1>
          <p className="type-caption text-label-3 font-mono">
            Last updated: 24 September 2026.
          </p>
        </header>

        <div className="space-y-8 type-callout leading-relaxed text-label-2">
          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Data we collect and why
            </h2>
            <p>
              SHAMAR accesses only what is necessary to detect subscriptions and
              protect you from unintended charges:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                <strong className="text-label">
                  Gmail receipts (read-only):
                </strong>{' '}
                When you connect Google, we request the gmail.readonly scope.
                The scanner asks Gmail only for receipt-like mail from the last
                year (messages in Purchases, or with subjects such as receipt,
                invoice, subscription or renewal). From each receipt we keep the
                sender&apos;s service name, the amount, the currency, the date
                and the subject line. We do not store the rest of the message,
                and we never read or store your contacts.
              </li>
              <li>
                <strong className="text-label">
                  Google Calendar (events):
                </strong>{' '}
                We request calendar.events permission solely to add upcoming
                renewal warnings and post-cancellation verification reminders.
              </li>
              <li>
                <strong className="text-label">Account identity:</strong> Your
                Privy DID or EVM wallet address is used to associate your active
                subscriptions and policy grants.
              </li>
              <li>
                <strong className="text-label">Audit signatures:</strong> When
                SHAMAR executes an action, the agent signs an EIP-191
                cryptographic hash containing the merchant, amount, and
                timestamp, preserving a verifiable log.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Token storage and security
            </h2>
            <p>
              Your Google access token is kept only on SHAMAR&apos;s server, in
              our Postgres database hosted by Neon, which encrypts its storage.
              It is never sent to your browser. You can remove SHAMAR&apos;s
              access at any time from your Google Account&apos;s security
              settings, or by deleting your SHAMAR account.
            </p>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Third-party services
            </h2>
            <p>We interface with specific service providers:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong className="text-label">Neon:</strong> Managed PostgreSQL
                hosting for database state.
              </li>
              <li>
                <strong className="text-label">Resend:</strong> Transactional
                email dispatch for cancellation requests.
              </li>
              <li>
                <strong className="text-label">Google:</strong> Gmail
                (read-only) to find receipts, and Calendar to add renewal and
                confirmation reminders.
              </li>
              <li>
                <strong className="text-label">Privy:</strong> Sign-in with
                email, Google or a wallet.
              </li>
              <li>
                <strong className="text-label">Groq and NVIDIA:</strong> The AI
                models that make decisions. They receive a subscription&apos;s
                name, category, price and charge dates, never email content.
              </li>
              <li>
                <strong className="text-label">Telegram:</strong> Renewal
                messages and approval buttons, sent only to the chat you link
                yourself. Nothing is sent if you haven&apos;t linked one.
              </li>
              <li>
                <strong className="text-label">Vercel:</strong> Hosting for the
                website and server.
              </li>
              <li>
                <strong className="text-label">Etherscan:</strong> Reading
                payments from a wallet you connect, if you choose to scan it.
              </li>
              <li>
                <strong className="text-label">Base RPC:</strong> Reading
                on-chain policy authorizations on Base mainnet.
              </li>
            </ul>
            <p className="mt-2">
              We do not sell user data, share personal records with advertisers,
              or use third-party behavioral analytics.
            </p>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Google API Limited Use Disclosure
            </h2>
            <p>
              SHAMAR&apos;s use and transfer of information received from Google
              APIs to any other app will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline font-medium"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="mt-2">Specifically:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                We only use Gmail data to detect recurring subscriptions and
                their billing receipts.
              </li>
              <li>
                We do not transfer or disclose your Google user data to third
                parties, except as strictly necessary to operate subscription
                tracking or as required by law.
              </li>
              <li>
                We do not use your Google data for serving advertisements,
                retargeting, or personalized marketing.
              </li>
              <li>
                We do not allow humans to read your email messages unless you
                have given explicit consent for debugging specific issues, or
                where required for security investigation or legal compliance.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Deleting your account
            </h2>
            <p>
              You can delete your account yourself at the bottom of the Agent
              page. This permanently removes your subscriptions, decisions,
              action history, rules, Telegram link and saved Gmail access, and
              asks Google to cancel SHAMAR&apos;s access. Permissions you
              granted on Base are public blockchain records that SHAMAR cannot
              erase; revoke them on the Agent page before deleting.
            </p>
          </section>

          <section className="pt-6 border-t border-separator/80">
            <p className="type-caption text-label-3">
              For privacy questions, see{' '}
              <a href="/support" className="text-accent underline font-medium">
                Support
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
