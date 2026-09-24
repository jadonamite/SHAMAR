import Image from 'next/image'

// The mark's trimmed aspect ratio (1189 x 810).
const MARK_RATIO = 1189 / 810

type LogoProps = {
  // mark: the faceted A alone. lockup: mark + wordmark. wordmark: type alone.
  variant?: 'mark' | 'lockup' | 'wordmark'
  // Height of the mark in px. The wordmark scales from it.
  size?: number
  priority?: boolean
  className?: string
}

function Mark({ size, priority }: { size: number; priority?: boolean }) {
  const width = Math.round(size * MARK_RATIO)
  return (
    <Image
      src={
        size > 64
          ? '/brand/shamar-mark-512.webp'
          : '/brand/shamar-mark-160.webp'
      }
      alt=""
      width={width}
      height={size}
      priority={priority}
      style={{ width, height: size }}
    />
  )
}

function Wordmark({ size }: { size: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-wordmark), var(--font-sans)',
        fontVariationSettings: '"wdth" 125',
        fontWeight: 700,
        fontSize: Math.round(size * 1),
        letterSpacing: '-0.05em',
        textTransform: 'uppercase',
        lineHeight: 1.3,
        color: 'currentColor',
      }}
    >
      SHAMAR
    </span>
  )
}

export default function Logo({
  variant = 'lockup',
  size = 18,
  priority,
  className,
}: LogoProps) {
  return (
    <span
      role="img"
      aria-label="SHAMAR"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.2),
      }}
    >
      {variant !== 'wordmark' && <Mark size={size} priority={priority} />}
      {variant !== 'mark' && <Wordmark size={size} />}
    </span>
  )
}
