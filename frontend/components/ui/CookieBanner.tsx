'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const consent = localStorage.getItem('shamar_cookie_consent')
      if (!consent) {
        setVisible(true)
      }
    } catch {}
  }, [])

  const accept = () => {
    try {
      localStorage.setItem('shamar_cookie_consent', 'accepted')
    } catch {}
    setVisible(false)
  }

  const decline = () => {
    try {
      localStorage.setItem('shamar_cookie_consent', 'essential_only')
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 p-5 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-[var(--shadow-card)] text-label transition-all"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h2
            className="text-sm font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Cookie and storage preferences
          </h2>
          <button
            onClick={decline}
            aria-label="Dismiss banner"
            className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 inline-flex items-center justify-center text-muted hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className="type-footnote leading-relaxed text-label-2">
          We use local storage strictly for essential authentication tokens. We
          do not use third-party marketing or tracking cookies. Read our{' '}
          <Link
            href="/cookies"
            className="font-medium text-label underline hover:text-accent-text transition-colors"
          >
            cookie policy
          </Link>{' '}
          for details.
        </p>
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={accept}
            className="touch-target min-h-[40px] px-5 rounded-full type-footnote font-semibold text-on-accent bg-accent hover:bg-accent-hover shadow-xs transition-colors"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={decline}
            className="touch-target min-h-[40px] px-4 rounded-full type-footnote font-semibold text-label-2 border border-separator bg-surface-2 hover:bg-surface transition-colors"
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  )
}
