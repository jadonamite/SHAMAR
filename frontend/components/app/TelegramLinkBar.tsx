'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { TelegramIcon } from '@/components/ui/SocialIcons'
import { apiFetch } from '@/lib/api'

export type LinkPhase = 'hidden' | 'idle' | 'starting' | 'waiting' | 'error'

// Quiet, persistent prompt for people who haven't linked Telegram. Without a
// linked chat SHAMAR can't ask before acting, so it never cancels on its own.
export default function TelegramLinkBar() {
  const { ready, authenticated } = usePrivy()
  const [phase, setPhase] = useState<LinkPhase>('hidden')
  const [linkUrl, setLinkUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || !authenticated) return
    let cancelled = false
    apiFetch('/api/telegram/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setPhase(data.configured && !data.linked ? 'idle' : 'hidden')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [ready, authenticated])

  // While waiting for Start in Telegram, check every few seconds.
  useEffect(() => {
    if (phase !== 'waiting') return
    const timer = setInterval(async () => {
      try {
        const res = await apiFetch('/api/telegram/status')
        const data = res.ok ? await res.json() : null
        if (data?.linked) setPhase('hidden')
      } catch {}
    }, 3000)
    return () => clearInterval(timer)
  }, [phase])

  async function startLink() {
    setPhase('starting')
    try {
      const res = await apiFetch('/api/telegram/link-code', { method: 'POST' })
      const data = res.ok ? await res.json() : null
      const url: string | undefined = data?.url ?? data?.link_url
      if (!url) throw new Error('no link')
      setLinkUrl(url)
      window.open(url, '_blank', 'noopener,noreferrer')
      setPhase('waiting')
    } catch {
      setPhase('error')
    }
  }

  return (
    <TelegramLinkBarView phase={phase} linkUrl={linkUrl} onLink={startLink} />
  )
}

const COPY: Record<
  Exclude<LinkPhase, 'hidden'>,
  { long: string; short: string }
> = {
  idle: {
    long: 'Link Telegram so SHAMAR can ask you before it cancels anything.',
    short: 'Link Telegram to get renewal alerts.',
  },
  starting: {
    long: 'Opening Telegram…',
    short: 'Opening Telegram…',
  },
  waiting: {
    long: 'Press Start in Telegram to finish linking.',
    short: 'Press Start in Telegram.',
  },
  error: {
    long: "We couldn't start the link.",
    short: "Couldn't start the link.",
  },
}

const pill =
  'touch-target inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-separator bg-surface px-4 type-footnote font-semibold text-label shadow-2xs transition-colors hover:bg-surface-2 disabled:opacity-40'

export function TelegramLinkBarView({
  phase,
  linkUrl,
  onLink,
}: {
  phase: LinkPhase
  linkUrl: string | null
  onLink: () => void
}) {
  if (phase === 'hidden') return null
  const copy = COPY[phase]
  const dot =
    phase === 'error'
      ? 'bg-accent'
      : phase === 'waiting'
        ? 'bg-warning motion-safe:animate-pulse'
        : 'bg-warning'

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-separator/80 bg-surface px-4 py-2 sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 text-label-2" aria-hidden>
          <TelegramIcon size={16} />
        </span>
        <span className="hidden shrink-0 type-eyebrow text-[9px] tracking-[0.14em] text-label-3 sm:inline">
          TELEGRAM
        </span>
        <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <p className="min-w-0 type-footnote text-label-2">
          <span className="sm:hidden">{copy.short}</span>
          <span className="hidden sm:inline">{copy.long}</span>
        </p>
      </div>

      {phase === 'waiting' && linkUrl ? (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={pill}
        >
          Open again
        </a>
      ) : (
        <button
          type="button"
          onClick={onLink}
          disabled={phase === 'starting'}
          className={pill}
        >
          {phase === 'error' ? 'Try again' : 'Link Telegram'}
          <span aria-hidden>→</span>
        </button>
      )}
    </div>
  )
}
