'use client'

import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import {
  CookieIcon,
  GitHubIcon,
  TelegramIcon,
  XIcon,
} from '@/components/ui/SocialIcons'

const PRODUCT = [
  { href: '/run', label: 'Watch it run' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/audit', label: 'Audit' },
  { href: 'https://github.com/jadonamite/SHAMAR', label: 'Source' },
]

const LEGAL = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
]

const SOCIAL = [
  {
    href: 'https://x.com/jadonamite',
    label: 'SHAMAR on X',
    icon: <XIcon />,
  },
  {
    href: 'https://github.com/jadonamite/SHAMAR',
    label: 'SHAMAR on GitHub',
    icon: <GitHubIcon />,
  },
  {
    href: 'https://t.me/jadonamite',
    label: 'SHAMAR on Telegram',
    icon: <TelegramIcon />,
  },
]

export default function AppFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto w-full border-t border-separator/60 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 md:px-8 md:flex-row md:items-center md:justify-between">
        {/* Left: Branding, Chain Status & Year */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            aria-label="SHAMAR home"
            className="touch-target inline-flex items-center text-label transition-opacity hover:opacity-80"
          >
            <Logo variant="lockup" size={18} />
          </Link>

          <span className="text-label-3">·</span>

          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-separator/80 bg-surface-2 px-2.5 py-0.5 type-caption font-semibold text-label"
            title="Smart contracts and session keys live on Base mainnet"
          >
            <span className="size-1.5 rounded-full bg-[#0052FF] animate-pulse" />
            <span>Base Mainnet</span>
          </div>

          <span className="text-label-3 type-caption hidden sm:inline">
            © {currentYear} SHAMAR
          </span>
        </div>

        {/* Center: Navigation & Legal Links */}
        <nav
          aria-label="Footer navigation links"
          className="flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          {PRODUCT.map((item) => {
            const external = item.href.startsWith('http')
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                className="type-footnote touch-target text-label-2 hover:text-label transition-colors font-medium"
              >
                {item.label}
              </Link>
            )
          })}
          <span className="text-label-3 hidden md:inline">·</span>
          {LEGAL.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="type-footnote touch-target text-label-2 hover:text-label transition-colors font-medium"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/cookies"
            className="type-footnote touch-target inline-flex items-center gap-1.5 text-label-2 hover:text-label transition-colors font-medium"
          >
            <CookieIcon size={14} />
            <span>Cookies</span>
          </Link>
        </nav>

        {/* Right: Circular Social Icon Buttons */}
        <div className="flex items-center gap-1.5">
          {SOCIAL.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              aria-label={s.label}
              className="inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-label shadow-2xs transition-all hover:bg-inverse hover:text-white"
            >
              {s.icon}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
