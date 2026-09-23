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
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 p-4 rounded border shadow-lg transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)',
        color: 'var(--text-primary)',
      }}
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
        <p
          className="text-xs leading-relaxed text-secondary"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          We use local storage for authentication tokens and your theme
          preference. We do not use third-party marketing or tracking cookies.
          Read our{' '}
          <Link
            href="/cookies"
            className="underline hover:text-white transition-colors"
          >
            cookie policy
          </Link>{' '}
          for details.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={accept}
            className="min-h-[44px] px-5 py-2 text-xs font-semibold uppercase tracking-wider rounded text-white bg-sam-red hover:bg-sam-dim transition-colors"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Accept
          </button>
          <button
            onClick={decline}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded border border-subtle text-secondary hover:text-white transition-colors"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  )
}
