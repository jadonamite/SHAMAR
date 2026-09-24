'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  CookieIcon,
  GitHubIcon,
  TelegramIcon,
  XIcon,
} from '@/components/ui/SocialIcons'
import { PrimaryButton } from '@/components/landing/primitives'
import { useStart } from '@/components/landing/Hero'

const SOCIAL = [
  { href: 'https://x.com/jadonamite', label: 'SHAMAR on X', icon: <XIcon /> },
  {
    href: 'https://github.com/jadonamite/SHAMAR',
    label: 'SHAMAR on GitHub',
    icon: <GitHubIcon />,
  },
  {
    href: 'https://t.me/shamar_agent_bot',
    label: 'SHAMAR on Telegram',
    icon: <TelegramIcon />,
  },
]

const LEGAL = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
]

export default function Footer() {
  const { start, loading } = useStart()
  return (
    <section className="relative isolate flex min-h-[45svh] flex-col justify-between gap-8 overflow-hidden rounded-[var(--radius-section)] bg-surface px-6 py-8 md:px-10 md:py-10">
      {/* 3D sculptural fluid ribbon pattern in SHAMAR red */}
      <Image
        src="/brand/red-pattern.jpg"
        alt=""
        fill
        className="-z-10 object-cover opacity-15"
      />

      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col items-start gap-5">
          <h2 className="type-display max-w-[15ch]">
            Stop paying for <span className="em-claim">what you forgot</span>.
          </h2>
          <PrimaryButton onClick={start} loading={loading}>
            Find my subscriptions
          </PrimaryButton>
        </div>
        <ul className="flex gap-2">
          {SOCIAL.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="inline-flex size-12 items-center justify-center rounded-full bg-surface text-label shadow-[var(--shadow-float)] transition-colors duration-[var(--motion-quick)] hover:bg-label hover:text-surface"
              >
                {s.icon}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 rounded-full bg-surface/80 px-4 md:flex-row md:items-center md:justify-between md:px-6">
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5">
          {LEGAL.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="type-footnote inline-flex min-h-[44px] min-w-[44px] items-center text-label hover:underline"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/cookies"
            className="type-footnote inline-flex min-h-[44px] items-center gap-1.5 text-label hover:underline"
          >
            <CookieIcon size={16} />
            Cookies
          </Link>
        </nav>
        <p className="type-caption pb-3 text-label md:pb-0">
          © {new Date().getFullYear()} SHAMAR
        </p>
      </div>
    </section>
  )
}
