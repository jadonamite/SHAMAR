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
  duolingo: { file: 'duolingo', tile: '#58CC02', glyph: '#FFFFFF', image: '/logos/duolingo.webp' },
  dropbox: { file: 'dropbox', tile: '#0061FF', glyph: '#FFFFFF' },
  canva: { file: 'canva', tile: '#00C4CC', glyph: '#FFFFFF' },
  adobe: { file: 'adobe', tile: '#FA0F00', glyph: '#FFFFFF' },
  telegram: { file: 'telegram', tile: '#26A5E4', glyph: '#FFFFFF' },
  gmail: { file: 'gmail', tile: '#FFFFFF', glyph: '#EA4335' },
  googlecalendar: { file: 'googlecalendar', tile: '#FFFFFF', glyph: '#4285F4' },
}

export type BrandName = keyof typeof BRANDS | 'figma'

function FigmaMark() {
  return (
    <svg viewBox="0 0 38 57" aria-hidden style={{ height: '58%' }}>
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE" />
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83" />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E" />
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF" />
    </svg>
  )
}

export default function BrandLogo({ name, size = 40, label }: { name: BrandName; size?: number; label?: string }) {
  const brand = name === 'figma' ? null : BRANDS[name]
  const tileBg = brand ? brand.tile : '#1E1E1E'
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-black/[0.06]"
      style={{ width: size, height: size, borderRadius: size * 0.26, background: tileBg }}
    >
      {brand?.image ? (
        // biome-ignore lint/performance/noImgElement: tiny static icon, no optimisation needed
        <img src={brand.image} alt="" width={size} height={size} className="size-full object-cover" />
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
      ) : (
        <FigmaMark />
      )}
    </span>
  )
}
