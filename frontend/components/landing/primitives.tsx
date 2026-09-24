import Link from 'next/link'
import type { ReactNode } from 'react'

export function Eyebrow({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'inverse'
}) {
  return (
    <p
      className={`type-eyebrow inline-flex items-center gap-2 ${tone === 'inverse' ? 'text-on-inverse/70' : 'text-label-2'}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
      {children}
    </p>
  )
}

export function Pill({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'inverse' | 'accent'
}) {
  const tones = {
    default: 'bg-surface text-label border border-separator',
    inverse: 'bg-white/10 text-on-inverse border border-white/15',
    accent: 'bg-white/15 text-on-accent border border-white/25',
  }
  return (
    <span
      className={`type-caption inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function Card({
  children,
  className = '',
  tone = 'surface',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  tone?: 'surface' | 'inverse' | 'accent'
  as?: 'div' | 'section' | 'article'
}) {
  const tones = {
    surface: 'bg-surface text-label',
    inverse: 'bg-inverse text-on-inverse',
    accent: 'bg-accent text-on-accent',
  }
  const radius = className.includes('rounded-')
    ? ''
    : 'rounded-[var(--radius-card)]'
  return (
    <Tag className={`${radius} ${tones[tone]} ${className}`}>{children}</Tag>
  )
}

export function Arrow({
  direction = 'up-right',
  size = 18,
}: {
  direction?: 'up-right' | 'right'
  size?: number
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {direction === 'up-right' ? (
        <path
          d="M7 17 17 7M9 7h8v8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M5 12h14m-6-6 6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

const roundBase =
  'inline-flex items-center justify-center rounded-full transition-[background-color,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)] active:scale-95 disabled:opacity-50 disabled:pointer-events-none'

// A circular arrow button, the reference's signature control. Always 44px or larger.
export function RoundLink({
  href,
  label,
  size = 56,
}: {
  href: string
  label: string
  size?: number
}) {
  const external = href.startsWith('http')
  return (
    <Link
      href={href}
      aria-label={label}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={`${roundBase} bg-accent text-on-accent hover:bg-accent-hover`}
      style={{ width: size, height: size }}
    >
      <Arrow size={Math.round(size * 0.36)} />
    </Link>
  )
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  size = 'md',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md'
}) {
  const sm = size === 'sm'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`group inline-flex items-center rounded-full bg-accent text-on-accent transition-all duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.96] cursor-pointer shadow-sm hover:shadow-[0_8px_20px_-4px_rgba(217,0,18,0.35)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 ${
        sm
          ? 'type-footnote min-h-[44px] gap-2 pl-4 pr-1.5 font-semibold'
          : 'type-headline min-h-[48px] gap-3 pl-6 pr-2'
      }`}
    >
      {loading ? 'Opening…' : children}
      <span
        className={`inline-flex items-center justify-center rounded-full bg-white/15 transition-transform duration-200 group-hover:translate-x-0.5 group-active:translate-x-1 ${sm ? 'size-8' : 'size-9'}`}
      >
        <Arrow direction="right" size={sm ? 14 : 16} />
      </span>
    </button>
  )
}

export function TextLink({
  href,
  children,
  tone = 'default',
}: {
  href: string
  children: ReactNode
  tone?: 'default' | 'inverse'
}) {
  return (
    <Link
      href={href}
      className={`type-headline inline-flex min-h-[44px] items-center gap-2 underline-offset-4 hover:underline ${
        tone === 'inverse' ? 'text-on-inverse' : 'text-label'
      }`}
    >
      {children}
      <Arrow size={16} />
    </Link>
  )
}
