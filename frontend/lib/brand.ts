// ---------------------------------------------------------------------------
// Domain & Real Logo Resolution
//
// Maps subscription merchants to their authoritative web domains and provides
// high-availability multi-tier logo fetching URLs.
// ---------------------------------------------------------------------------

export const MERCHANT_DOMAINS: Record<string, string> = {
  // Video & Entertainment
  netflix: 'netflix.com',
  disney: 'disneyplus.com',
  disneyplus: 'disneyplus.com',
  hulu: 'hulu.com',
  max: 'max.com',
  hbomax: 'max.com',
  paramount: 'paramountplus.com',
  paramountplus: 'paramountplus.com',
  peacock: 'peacocktv.com',
  primevideo: 'primevideo.com',
  amazonprime: 'primevideo.com',
  crunchyroll: 'crunchyroll.com',
  mubi: 'mubi.com',
  showmax: 'showmax.com',
  dazn: 'dazn.com',
  youtube: 'youtube.com',
  youtubepremium: 'youtube.com',

  // Music & Audio
  spotify: 'spotify.com',
  applemusic: 'apple.com',
  tidal: 'tidal.com',
  deezer: 'deezer.com',
  soundcloud: 'soundcloud.com',
  audible: 'audible.com',
  pandora: 'pandora.com',

  // AI & Machine Learning
  claude: 'anthropic.com',
  anthropic: 'anthropic.com',
  claudepro: 'anthropic.com',
  chatgpt: 'openai.com',
  openai: 'openai.com',
  midjourney: 'midjourney.com',
  cursor: 'cursor.com',
  perplexity: 'perplexity.ai',
  elevenlabs: 'elevenlabs.io',
  gamma: 'gamma.app',
  suno: 'suno.com',
  runway: 'runwayml.com',
  replicate: 'replicate.com',
  huggingface: 'huggingface.co',
  deepseek: 'deepseek.com',
  copilot: 'github.com',

  // Dev & Cloud Hosting
  vercel: 'vercel.com',
  github: 'github.com',
  gitlab: 'gitlab.com',
  netlify: 'netlify.com',
  render: 'render.com',
  railway: 'railway.app',
  heroku: 'heroku.com',
  digitalocean: 'digitalocean.com',
  aws: 'aws.amazon.com',
  cloudflare: 'cloudflare.com',
  fly: 'fly.io',
  flyio: 'fly.io',
  linode: 'linode.com',
  sentry: 'sentry.io',
  datadog: 'datadoghq.com',
  supabase: 'supabase.com',
  planetscale: 'planetscale.com',
  neon: 'neon.tech',
  upstash: 'upstash.com',
  mongodb: 'mongodb.com',

  // Design & Video Editing
  figma: 'figma.com',
  canva: 'canva.com',
  adobe: 'adobe.com',
  creativecloud: 'adobe.com',
  capcut: 'capcut.com',
  framer: 'framer.com',
  webflow: 'webflow.com',
  sketch: 'sketch.com',
  procreate: 'procreate.com',
  spline: 'spline.design',

  // Productivity & Work
  notion: 'notion.so',
  linear: 'linear.app',
  airtable: 'airtable.com',
  miro: 'miro.com',
  loom: 'loom.com',
  grammarly: 'grammarly.com',
  todoist: 'todoist.com',
  asana: 'asana.com',
  monday: 'monday.com',
  clickup: 'clickup.com',
  trello: 'trello.com',
  obsidian: 'obsidian.md',
  slack: 'slack.com',
  zoom: 'zoom.us',
  discord: 'discord.com',
  telegram: 'telegram.org',

  // Storage & Cloud Services
  dropbox: 'dropbox.com',
  google: 'google.com',
  googleone: 'google.com',
  gmail: 'google.com',
  googlecalendar: 'google.com',
  googleworkspace: 'google.com',
  icloud: 'apple.com',
  backblaze: 'backblaze.com',
  pcloud: 'pcloud.com',
  box: 'box.com',

  // Learning & Security
  duolingo: 'duolingo.com',
  coursera: 'coursera.org',
  udemy: 'udemy.com',
  skillshare: 'skillshare.com',
  leetcode: 'leetcode.com',
  nordvpn: 'nordvpn.com',
  expressvpn: 'expressvpn.com',
  proton: 'proton.me',
  protonmail: 'proton.me',
  protonvpn: 'protonvpn.com',
  surfshark: 'surfshark.com',
  mullvad: 'mullvad.net',
  onepassword: '1password.com',
  '1password': '1password.com',
  bitwarden: 'bitwarden.com',
}

/**
 * Resolves a merchant name to its primary domain.
 */
export function resolveMerchantDomain(merchant: string): string {
  const clean = merchant.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (MERCHANT_DOMAINS[clean]) {
    return MERCHANT_DOMAINS[clean]
  }

  // Substring search
  for (const [key, domain] of Object.entries(MERCHANT_DOMAINS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return domain
    }
  }

  // If already a domain format (e.g. app.slack.com or linear.app)
  if (merchant.includes('.') && !merchant.includes(' ')) {
    return merchant.trim().toLowerCase()
  }

  // Default heuristic: clean name + .com
  return `${clean}.com`
}

/**
 * Builds the primary real logo URL for a merchant or domain.
 * Leverages Unavatar's multi-source CDN (Clearbit, GitHub, Twitter, SVG vectors)
 * with automatic fallback to Google S2 128px official favicon CDN.
 */
export function getRealLogoUrl(merchantOrDomain: string): string {
  const domain = merchantOrDomain.includes('.')
    ? merchantOrDomain.toLowerCase()
    : resolveMerchantDomain(merchantOrDomain)

  const googleFallback = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  return `https://unavatar.io/${domain}?fallback=${encodeURIComponent(googleFallback)}`
}

/**
 * Secondary direct Google favicon URL if Unavatar is unavailable or blocked.
 */
export function getGoogleFaviconUrl(merchantOrDomain: string): string {
  const domain = merchantOrDomain.includes('.')
    ? merchantOrDomain.toLowerCase()
    : resolveMerchantDomain(merchantOrDomain)

  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
}
