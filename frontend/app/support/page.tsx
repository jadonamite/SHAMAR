import type { Metadata } from 'next'
import Link from 'next/link'
import AppFooter from '@/components/app/AppFooter'
import TopNav from '@/components/app/TopNav'

export const metadata: Metadata = {
  title: 'Support — SHAMAR',
  description:
    'How to get help with SHAMAR, report a problem, or stop the agent right away.',
}

const linkClass = 'text-accent underline font-medium'

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav title="Support" />

      <main className="flex-1 px-4 sm:px-6 py-10 md:py-12 max-w-3xl w-full mx-auto">
        <header className="mb-10 pb-6 border-b border-separator/80">
          <h1 className="type-title-1 font-[600] text-label tracking-tight mb-2">
            Support
          </h1>
          <p className="type-callout text-label-2">
            Most questions are answered in the{' '}
            <Link href="/faq" className={linkClass}>
              FAQ
            </Link>
            .
          </p>
        </header>

        <div className="space-y-8 type-callout leading-relaxed text-label-2">
          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Stop SHAMAR right now
            </h2>
            <p>
              Send <strong className="text-label">stop</strong> to{' '}
              <a
                href="https://t.me/shamar_agent_bot"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                @shamar_agent_bot
              </a>{' '}
              from the Telegram chat you linked. Nothing more happens until you
              send <strong className="text-label">resume</strong>. The bot
              answers commands only; it can&apos;t reply to support questions.
            </p>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Report a problem or ask a question
            </h2>
            <p>
              Open an issue on{' '}
              <a
                href="https://github.com/jadonamite/SHAMAR/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                GitHub
              </a>
              . Say what you did, what you expected, and what happened instead.
              Issues are public, so never include your email address, wallet
              key, or anything from your inbox.
            </p>
            <p className="mt-2">
              For anything private, send a direct message to{' '}
              <a
                href="https://x.com/jadonamite"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                @jadonamite on X
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Something was cancelled that shouldn&apos;t have been
            </h2>
            <p>
              Contact the company to restart the subscription, then check the{' '}
              <Link href="/audit" className={linkClass}>
                Audit page
              </Link>
              : every action SHAMAR took is listed there with the reason, and
              the ones that can be undone have an Undo button. Tell us what
              happened so we can fix the cause.
            </p>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Delete your data
            </h2>
            <p>
              You can do this yourself at the bottom of the{' '}
              <Link href="/agent" className={linkClass}>
                Agent page
              </Link>
              . The{' '}
              <Link href="/privacy" className={linkClass}>
                privacy policy
              </Link>{' '}
              explains what is removed.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
