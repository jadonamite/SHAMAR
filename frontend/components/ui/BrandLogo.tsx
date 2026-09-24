// Official marks from Simple Icons (public/logos), shown as app-icon tiles in each
// brand's own colours. Used only to show which services SHAMAR recognises.

type Brand = {
  file: string
  tile: string
  glyph: string
  // A full-bleed raster app icon, used instead of a masked glyph
  image?: string
}

const BRANDS: Record<string, Brand> = {
  claude: { file: 'claude', tile: '#F4EFE6', glyph: '#D97757' },
  netflix: { file: 'netflix', tile: '#000000', glyph: '#E50914' },
  spotify: { file: 'spotify', tile: '#000000', glyph: '#1ED760' },
  youtube: { file: 'youtube', tile: '#FFFFFF', glyph: '#FF0000' },
  notion: { file: 'notion', tile: '#FFFFFF', glyph: '#000000' },
  chatgpt: { file: 'openai', tile: '#FFFFFF', glyph: '#000000' },
  duolingo: {
    file: 'duolingo',
    tile: '#58CC02',
    glyph: '#FFFFFF',
    image: '/logos/duolingo.webp',
  },
  dropbox: { file: 'dropbox', tile: '#0061FF', glyph: '#FFFFFF' },
  canva: { file: 'canva', tile: '#00C4CC', glyph: '#FFFFFF' },
  adobe: { file: 'adobe', tile: '#FA0F00', glyph: '#FFFFFF' },
  telegram: { file: 'telegram', tile: '#26A5E4', glyph: '#FFFFFF' },
  gmail: { file: 'gmail', tile: '#FFFFFF', glyph: '#EA4335' },
  googlecalendar: { file: 'googlecalendar', tile: '#FFFFFF', glyph: '#4285F4' },
  github: { file: 'github', tile: '#181717', glyph: '#FFFFFF' },
}

export type BrandName = keyof typeof BRANDS | 'figma' | 'vercel' | 'google'

function VercelMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" style={{ height: '50%', width: '50%' }} className="text-white">
      <path d="M12 2L2 22h20L12 2z" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden style={{ height: '56%', width: '56%' }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

function FigmaMark() {
  return (
    <svg viewBox="0 0 38 57" aria-hidden style={{ height: '58%' }}>
      <path
        d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z"
        fill="#1ABCFE"
      />
      <path
        d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z"
        fill="#0ACF83"
      />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
      <path
        d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z"
        fill="#F24E1E"
      />
      <path
        d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z"
        fill="#A259FF"
      />
    </svg>
  )
}

export default function BrandLogo({
  name,
  size = 40,
  label,
}: {
  name: BrandName
  size?: number
  label?: string
}) {
  const isSpecial = name === 'figma' || name === 'vercel' || name === 'google'
  const brand = isSpecial ? null : BRANDS[name]
  const tileBg =
    name === 'vercel'
      ? '#000000'
      : name === 'google'
        ? '#FFFFFF'
        : brand
          ? brand.tile
          : '#1E1E1E'

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-black/[0.06]"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: tileBg,
      }}
    >
      {brand?.image ? (
        // biome-ignore lint/performance/noImgElement: tiny static icon, no optimisation needed
        <img
          src={brand.image}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
        />
      ) : brand ? (
        <span
          style={{
            width: '56%',
            height: '56%',
            background: brand.glyph,
            WebkitMask: `url(/logos/${brand.file}.svg) center / contain no-repeat`,
            mask: `url(/logos/${brand.file}.svg) center / contain no-repeat`,
          }}
        />
      ) : name === 'vercel' ? (
        <VercelMark />
      ) : name === 'google' ? (
        <GoogleMark />
      ) : (
        <FigmaMark />
      )}
    </span>
  )
}
