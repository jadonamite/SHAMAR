'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import BrandLogo, { type BrandName } from '@/components/ui/BrandLogo'
import NotificationCascade from '@/components/landing/NotificationCascade'
import { useMiniPay } from '@/components/providers/MiniPayProvider'
import { PrimaryButton } from '@/components/landing/primitives'

const KNOWN: Array<{ name: BrandName; label: string }> = [
  { name: 'netflix', label: 'Netflix' },
  { name: 'spotify', label: 'Spotify' },
  { name: 'claude', label: 'Claude' },
  { name: 'figma', label: 'Figma' },
  { name: 'youtube', label: 'YouTube' },
  { name: 'chatgpt', label: 'ChatGPT' },
  { name: 'notion', label: 'Notion' },
  { name: 'duolingo', label: 'Duolingo' },
]

export function useStart() {
  const { ready, authenticated, login } = usePrivy()
  const { isMiniPay } = useMiniPay()
  const router = useRouter()
  const [entering, setEntering] = useState(false)

  useEffect(() => {
    if ((entering || isMiniPay) && authenticated) router.push('/dashboard')
  }, [entering, isMiniPay, authenticated, router])

  function start() {
    if (!ready || isMiniPay) return
    if (authenticated) router.push('/dashboard')
    else {
      setEntering(true)
      login()
    }
  }

  return { start, loading: entering && !authenticated }
}

export default function Hero() {
  const { start, loading } = useStart()

  return (
    <section className="relative isolate flex min-h-[calc(100svh-32px)] flex-col overflow-hidden rounded-[var(--radius-section)] bg-surface p-3">
      {/* The owner's blob language, spelling SHAMAR in pale red strokes */}
      <Image src="/brand/hero-pattern.svg" alt="" fill priority className="-z-10 object-cover" />

      <header className="flex items-center justify-between gap-4 px-3 pt-2 md:px-6">
        <Link href="/" aria-label="SHAMAR home" className="touch-target text-label">
          <Logo variant="lockup" size={22} priority />
        </Link>
        <div className="flex items-center gap-2">
          <a
            href="#how"
            className="type-footnote hidden min-h-[44px] items-center px-3 font-semibold text-label hover:underline sm:inline-flex"
          >
            See how it works
          </a>
          <PrimaryButton onClick={start} loading={loading} size="sm">
            <span className="whitespace-nowrap sm:hidden">Get started</span>
            <span className="hidden whitespace-nowrap sm:inline">Find my subscriptions</span>
          </PrimaryButton>
        </div>
      </header>

      <div className="grid flex-1 items-center gap-10 px-3 py-10 md:grid-cols-[1fr_minmax(0,27rem)] md:gap-12 md:px-6 lg:grid-cols-[1fr_minmax(0,29rem)]">
        <div className="flex flex-col gap-6">
          <h1 className="max-w-[14ch] text-[clamp(2.25rem,1.3rem+3.3vw,4.25rem)] font-[600] leading-[1] tracking-[-0.045em]">
            Forgot you&rsquo;re paying for it? <span className="em-claim text-accent-text">SHAMAR didn&rsquo;t.</span>
          </h1>
          <p className="type-callout max-w-[38ch] font-[450] text-label md:text-[1.0625rem] md:leading-[1.5]">
            It finds every subscription in your inbox, messages you before each one renews, and cancels the ones you
            ignore. You don&rsquo;t lift a finger.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <div className="flex -space-x-1.5">
              {KNOWN.map((b) => (
                <span key={b.name} className="rounded-[9px] ring-2 ring-surface">
                  <BrandLogo name={b.name} size={30} label={b.label} />
                </span>
              ))}
            </div>
            <p className="type-caption text-label">Knows 165 services, and counting.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-card)] bg-inverse p-3 shadow-[var(--shadow-float)] md:p-4">
          <NotificationCascade />
        </div>
      </div>
    </section>
  )
}
