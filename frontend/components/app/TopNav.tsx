'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { NAV_LINKS } from '@/lib/nav'
import MobileMenu from './MobileMenu'
import TelegramLinkBar from './TelegramLinkBar'
import { useMiniPay } from '@/components/providers/MiniPayProvider'
import Logo from '@/components/ui/Logo'

const APP_ROUTES = [
  '/dashboard',
  '/subscriptions',
  '/recommendations',
  '/policies',
  '/audit',
  '/run',
  '/agent',
]

interface TopNavProps {
  title?: string
  actions?: React.ReactNode
  rightMeta?: React.ReactNode
  scanning?: boolean
  walletScanning?: boolean
  gmailConnected?: boolean
  onScanGmail?: () => void
  onScanWallet?: () => void
}

export default function TopNav({
  title,
  actions,
  rightMeta,
  scanning,
  walletScanning,
  gmailConnected,
  onScanGmail,
  onScanWallet,
}: TopNavProps) {
  const pathname = usePathname()
  const { user, logout } = usePrivy()
  const { isMiniPay } = useMiniPay()
  // In-app screens only; the Agent page has its own Telegram section.
  const showTelegramBar =
    !!pathname &&
    APP_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-separator/60 bg-surface/90 backdrop-blur-md transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8">
          {/* Left: Brand + Breadcrumb */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              href="/dashboard"
              className="touch-target inline-flex items-center text-label transition-opacity hover:opacity-80 shrink-0"
              aria-label="SHAMAR Dashboard"
            >
              <Logo variant="lockup" size={24} priority />
            </Link>

            {title && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-label-3 font-mono">/</span>
                <span className="truncate type-headline text-label font-semibold">
                  {title}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Navigation Links: Segmented Pill Nav */}
          <nav
            aria-label="In-app navigation"
            className="hidden xl:flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-black/[0.04]"
          >
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== '/dashboard' &&
                  pathname?.startsWith(link.href + '/'))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`type-footnote relative min-h-[36px] px-3.5 py-1.5 rounded-full font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                    active
                      ? 'bg-surface text-label shadow-xs ring-1 ring-black/[0.06]'
                      : 'text-label-2 hover:text-label hover:bg-surface/50'
                  }`}
                >
                  {active && (
                    <span className="size-1.5 rounded-full bg-accent" />
                  )}
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right: Actions + User Identity */}
          <div className="hidden md:flex items-center gap-2.5">
            {actions}
            {rightMeta}

            {/* User Session Pill & Logout */}
            {user?.email?.address || user?.wallet?.address ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-separator bg-surface text-label type-caption font-mono shadow-2xs">
                  {isMiniPay && (
                    <span className="rounded-full bg-success/15 border border-success/30 px-1.5 py-0.5 text-[9px] font-bold text-success uppercase">
                      MiniPay
                    </span>
                  )}
                  <span className="text-label-2">
                    {user?.email?.address ??
                      `${user?.wallet?.address?.slice(0, 6)}…${user?.wallet?.address?.slice(-4)}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await logout()
                    window.location.href = '/'
                  }}
                  className="touch-target px-3 py-1.5 rounded-full border border-separator bg-surface text-label type-caption font-semibold hover:bg-surface-2 transition-colors cursor-pointer"
                  title="Sign out of SHAMAR"
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>

          {/* Mobile Actions & Menu */}
          <div className="flex xl:hidden items-center gap-2">
            <MobileMenu
              walletAddress={user?.wallet?.address}
              email={user?.email?.address}
              gmailConnected={gmailConnected}
              scanning={scanning}
              walletScanning={walletScanning}
              onScanGmail={onScanGmail}
              onScanWallet={onScanWallet}
            />
          </div>
        </div>
      </header>
      {showTelegramBar && <TelegramLinkBar />}
    </>
  )
}
