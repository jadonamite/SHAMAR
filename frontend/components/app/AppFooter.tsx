'use client'

import Link from 'next/link'
import Logo from '@/components/ui/Logo'

const PRODUCT = [
  { href: '/run', label: 'Watch it run' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: 'https://github.com/jadonamite/SHAMAR', label: 'Source' },
]

const LEGAL = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
]

const SOCIAL = [
  {
    name: 'X',
    href: 'https://x.com/jadonamite',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: 'GitHub',
    href: 'https://github.com/jadonamite',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/in/jadonamite',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
]

export default function AppFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto w-full border-t border-separator bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-3.5 sm:px-8 md:flex-row md:items-center md:justify-between">
        {/* Left: Branding, Chain Status & Year */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            aria-label="SHAMAR home"
            className="touch-target inline-flex items-center text-label transition-colors hover:text-accent-text"
          >
            <Logo variant="lockup" size={18} />
          </Link>

          <span className="text-label-3">·</span>

          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 type-caption font-mono text-success"
            title="Policy contracts live on Base"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <span>Base Mainnet</span>
          </div>

          <span className="text-label-3 type-caption font-mono hidden sm:inline">
            © {currentYear}
          </span>
        </div>

        {/* Center: Navigation & Legal Links */}
        <nav aria-label="Footer links" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {PRODUCT.map((item) => {
            const external = item.href.startsWith('http')
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                className="type-footnote touch-target text-label-2 hover:text-label transition-colors"
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
              className="type-footnote touch-target text-label-2 hover:text-label transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right: Social Icon Links */}
        <div className="flex items-center gap-1">
          {SOCIAL.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              aria-label={s.name}
              className="touch-target inline-flex items-center justify-center rounded-full text-label-2 hover:text-label hover:bg-surface-2 transition-colors"
            >
              {s.icon}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
