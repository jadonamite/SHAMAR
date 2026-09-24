'use client'

import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import {
  CookieIcon,
  GitHubIcon,
  TelegramIcon,
  XIcon,
} from '@/components/ui/SocialIcons'

const LEGAL = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/faq', label: 'FAQ' },
  { href: '/support', label: 'Support' },
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
    href: 'https://t.me/shamar_agent_bot',
    label: 'SHAMAR on Telegram',
    icon: <TelegramIcon />,
  },
]

export default function AppFooter() {
  return (
    <footer className="mt-auto w-full border-t border-separator/40 bg-surface/60 backdrop-blur-xs">
      <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 px-4 py-4 sm:py-3 sm:px-6 md:px-8">
        {/* Row 1 on mobile: Logo + Social Links / Left on desktop: Logo */}
        <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-4">
          <Link
            href="/"
            aria-label="SHAMAR home"
            className="touch-target inline-flex items-center text-label transition-opacity hover:opacity-80"
          >
            <Logo variant="lockup" size={16} />
          </Link>

          {/* Social Links on mobile right next to logo */}
          <div className="flex items-center gap-1 sm:hidden">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="inline-flex size-8 items-center justify-center rounded-full text-label-3 transition-colors hover:bg-surface-2 hover:text-label"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Center / Row 2 on mobile: Subtle Legal Links */}
        <nav
          aria-label="Legal navigation"
          className="flex items-center gap-x-5"
        >
          {LEGAL.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="type-caption touch-target text-label-3 hover:text-label transition-colors font-medium"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/cookies"
            className="type-caption touch-target inline-flex items-center gap-1.5 text-label-3 hover:text-label transition-colors font-medium"
          >
            <CookieIcon size={12} />
            <span>Cookies</span>
          </Link>
        </nav>

        {/* Desktop Social Links */}
        <div className="hidden sm:flex items-center gap-1">
          {SOCIAL.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              aria-label={s.label}
              className="inline-flex size-8 items-center justify-center rounded-full text-label-3 transition-colors hover:bg-surface-2 hover:text-label"
            >
              {s.icon}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
