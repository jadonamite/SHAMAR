'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { apiFetch } from '@/lib/api'

type Phase = 'hidden' | 'idle' | 'starting' | 'waiting' | 'error'

// Quiet, persistent prompt for people who haven't linked Telegram. Without a
// linked chat SHAMAR can't ask before acting, so it never cancels on its own.
export default function TelegramLinkBar() {
  const { ready, authenticated } = usePrivy()
  const [phase, setPhase] = useState<Phase>('hidden')
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

  // While waiting for /start in Telegram, check every few seconds.
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

  if (phase === 'hidden') return null

  const message =
    phase === 'waiting'
      ? 'Press Start in Telegram to finish. This bar goes away once you do.'
      : phase === 'error'
        ? "We couldn't start the link. Try again."
        : 'Link Telegram so SHAMAR can ask you before it cancels anything.'

  return (
    <div role="status" className="border-b border-separator/60 bg-surface-2/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 md:px-8">
        <p className="type-footnote text-label-2">{message}</p>
        {phase === 'waiting' && linkUrl ? (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="touch-target type-footnote inline-flex items-center self-start font-semibold text-accent-text underline sm:self-auto"
          >
            Open Telegram again
          </a>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={startLink}
            disabled={phase === 'starting'}
            className="self-start sm:self-auto"
          >
            {phase === 'starting' ? 'Opening…' : 'Link Telegram'}
          </Button>
        )}
      </div>
    </div>
  )
}
