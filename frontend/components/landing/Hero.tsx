'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
      {/* The owner's blob pattern, recoloured to SHAMAR red, faded and zoomed in */}
      <Image
        src="/brand/hero-bg.webp"
        alt=""
        fill
        priority
        className="-z-10 scale-[1.6] object-cover opacity-[0.14]"
      />

      <header className="flex items-center justify-between gap-4 px-3 pt-2 md:px-6">
        <Link
          href="/"
          aria-label="SHAMAR home"
          className="touch-target text-label"
        >
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
            <span className="hidden whitespace-nowrap sm:inline">
              Find my subscriptions
            </span>
          </PrimaryButton>
        </div>
      </header>

      <div className="grid flex-1 items-center gap-10 px-3 py-10 md:grid-cols-[1fr_minmax(0,27rem)] md:gap-12 md:px-6 lg:grid-cols-[1fr_minmax(0,29rem)]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6"
        >
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-[14ch] text-[clamp(2.25rem,1.3rem+3.3vw,4.25rem)] font-[600] leading-[1] tracking-[-0.045em]"
          >
            Forgot you&rsquo;re paying for it?{' '}
            <span className="em-claim text-accent-text">
              SHAMAR didn&rsquo;t.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="type-callout max-w-[38ch] font-[450] text-label md:text-[1.0625rem] md:leading-[1.5]"
          >
            It finds every subscription in your inbox, messages you before each
            one renews, and cancels the ones you ignore. You don&rsquo;t lift a
            finger.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center gap-3.5 pt-4"
          >
            <div className="flex items-center gap-1.5">
              {KNOWN.map((b, idx) => (
                <motion.span
                  key={b.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.35 + idx * 0.04,
                    type: 'spring',
                    stiffness: 350,
                    damping: 25,
                  }}
                  whileHover={{ y: -3, scale: 1.15 }}
                  className="inline-flex cursor-pointer"
                >
                  <BrandLogo name={b.name} size={28} label={b.label} />
                </motion.span>
              ))}
            </div>
            <p className="type-caption font-medium text-label">
              Knows 165 services, and counting.
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-[var(--radius-card)] bg-inverse p-3 shadow-[var(--shadow-float)] md:p-4"
        >
          <NotificationCascade />
        </motion.div>
      </div>
    </section>
  )
}
