// ---------------------------------------------------------------------------
// Subscription Service Registry
//
// Single source of truth for subscription detection. Drives:
//   - The Gmail `from:` query (pre-filters at API level)
//   - Merchant normalization (consistent naming)
//   - Billing-domain allowlist (sender-based detection)
//   - Category metadata (used by SAM's intelligence/grouping layer)
//
// To add a service, add an entry below. Everything else is auto-derived.
// ---------------------------------------------------------------------------

export type SubscriptionCategory =
  | 'streaming'
  | 'music'
  | 'ai'
  | 'dev'
  | 'design'
  | 'productivity'
  | 'communication'
  | 'storage'
  | 'marketing'
  | 'education'
  | 'vpn'
  | 'security'
  | 'news'
  | 'gaming'
  | 'office'
  | 'fitness'
  | 'other'

export type SubscriptionService = {
  name: string
  domains: string[]
  category: SubscriptionCategory
  // Match against the full sender string (display name + email) for disambiguation
  // — e.g. distinguishing "Google One" from generic "Google".
  aliases?: string[]
}

export const SUBSCRIPTION_REGISTRY: SubscriptionService[] = [
  // ── Video Streaming ──────────────────────────────────────────────────────
  { name: 'Netflix', domains: ['netflix.com', 'nflx.com'], category: 'streaming' },
  { name: 'Disney+', domains: ['disneyplus.com', 'mail.disneyplus.com'], category: 'streaming' },
  { name: 'Hulu', domains: ['hulu.com', 'hulumail.com'], category: 'streaming' },
  { name: 'Max', domains: ['hbomax.com', 'max.com', 'mail.max.com'], category: 'streaming' },
  { name: 'Paramount+', domains: ['paramountplus.com'], category: 'streaming' },
  { name: 'Peacock', domains: ['peacocktv.com'], category: 'streaming' },
  { name: 'Amazon Prime Video', domains: ['primevideo.com'], category: 'streaming', aliases: ['prime video'] },
  { name: 'DAZN', domains: ['dazn.com'], category: 'streaming' },
  { name: 'Crunchyroll', domains: ['crunchyroll.com'], category: 'streaming' },
  { name: 'Mubi', domains: ['mubi.com'], category: 'streaming' },
  { name: 'Showmax', domains: ['showmax.com'], category: 'streaming' },
  { name: 'iROKOtv', domains: ['iroko.tv', 'irokotv.com'], category: 'streaming' },
  { name: 'Curiosity Stream', domains: ['curiositystream.com'], category: 'streaming' },
  { name: 'BritBox', domains: ['britbox.com'], category: 'streaming' },
  { name: 'Funimation', domains: ['funimation.com'], category: 'streaming' },

  // ── Music Streaming ──────────────────────────────────────────────────────
  { name: 'Spotify', domains: ['spotify.com', 'emails.spotify.com'], category: 'music' },
  { name: 'Tidal', domains: ['tidal.com'], category: 'music' },
  { name: 'Deezer', domains: ['deezer.com'], category: 'music' },
  { name: 'Boomplay', domains: ['boomplay.com'], category: 'music' },
  { name: 'SoundCloud', domains: ['soundcloud.com'], category: 'music' },
  { name: 'Audible', domains: ['audible.com'], category: 'music' },
  { name: 'Pandora', domains: ['pandora.com'], category: 'music' },

  // ── AI Tools ─────────────────────────────────────────────────────────────
  { name: 'ChatGPT Plus', domains: ['openai.com'], category: 'ai', aliases: ['chatgpt'] },
  { name: 'Claude Pro', domains: ['anthropic.com'], category: 'ai' },
  { name: 'Midjourney', domains: ['midjourney.com'], category: 'ai' },
  { name: 'ElevenLabs', domains: ['elevenlabs.io'], category: 'ai' },
  { name: 'Perplexity Pro', domains: ['perplexity.ai'], category: 'ai' },
  { name: 'Gamma', domains: ['gamma.app'], category: 'ai' },
  { name: 'Suno', domains: ['suno.com', 'suno.ai'], category: 'ai' },
  { name: 'Runway', domains: ['runwayml.com'], category: 'ai' },
  { name: 'Cursor', domains: ['cursor.com', 'cursor.sh'], category: 'ai' },
  { name: 'Replicate', domains: ['replicate.com'], category: 'ai' },
  { name: 'Hugging Face', domains: ['huggingface.co'], category: 'ai' },
  { name: 'Character.AI', domains: ['character.ai'], category: 'ai' },
  { name: 'Poe', domains: ['poe.com'], category: 'ai' },
  { name: 'Pika', domains: ['pika.art'], category: 'ai' },
  { name: 'DeepSeek', domains: ['deepseek.com'], category: 'ai' },
  { name: 'GitHub Copilot', domains: [], category: 'ai', aliases: ['github copilot'] },
  { name: 'Google AI Pro', domains: [], category: 'ai', aliases: ['google ai pro', 'gemini advanced'] },

  // ── Dev Tools / Hosting ──────────────────────────────────────────────────
  { name: 'GitHub', domains: ['github.com', 'noreply.github.com'], category: 'dev' },
  { name: 'GitLab', domains: ['gitlab.com'], category: 'dev' },
  { name: 'Vercel', domains: ['vercel.com'], category: 'dev' },
  { name: 'Netlify', domains: ['netlify.com'], category: 'dev' },
  { name: 'Render', domains: ['render.com'], category: 'dev' },
  { name: 'Railway', domains: ['railway.app'], category: 'dev' },
  { name: 'Heroku', domains: ['heroku.com'], category: 'dev' },
  { name: 'DigitalOcean', domains: ['digitalocean.com'], category: 'dev' },
  { name: 'AWS', domains: ['aws.amazon.com', 'amazonaws.com'], category: 'dev', aliases: ['amazon web services'] },
  { name: 'Google Cloud', domains: ['cloud.google.com'], category: 'dev', aliases: ['google cloud'] },
  { name: 'Cloudflare', domains: ['cloudflare.com'], category: 'dev' },
  { name: 'Fly.io', domains: ['fly.io'], category: 'dev' },
  { name: 'Akamai/Linode', domains: ['linode.com', 'akamai.com'], category: 'dev' },
  { name: 'Sentry', domains: ['sentry.io'], category: 'dev' },
  { name: 'LogRocket', domains: ['logrocket.com'], category: 'dev' },
  { name: 'Datadog', domains: ['datadoghq.com'], category: 'dev' },
  { name: 'New Relic', domains: ['newrelic.com'], category: 'dev' },
  { name: 'JetBrains', domains: ['jetbrains.com'], category: 'dev' },
  { name: 'CodePen', domains: ['codepen.io'], category: 'dev' },

  // ── Databases / Backend ──────────────────────────────────────────────────
  { name: 'Supabase', domains: ['supabase.io', 'supabase.com'], category: 'dev' },
  { name: 'PlanetScale', domains: ['planetscale.com'], category: 'dev' },
  { name: 'Neon', domains: ['neon.tech'], category: 'dev' },
  { name: 'Upstash', domains: ['upstash.com'], category: 'dev' },
  { name: 'MongoDB Atlas', domains: ['mongodb.com'], category: 'dev' },
  { name: 'Redis Cloud', domains: ['redis.com'], category: 'dev' },
  { name: 'CockroachDB', domains: ['cockroachlabs.com'], category: 'dev' },

  // ── Design ───────────────────────────────────────────────────────────────
  { name: 'Figma', domains: ['figma.com'], category: 'design' },
  { name: 'Canva', domains: ['canva.com'], category: 'design' },
  { name: 'Adobe Creative Cloud', domains: ['adobe.com'], category: 'design' },
  { name: 'Framer', domains: ['framer.com'], category: 'design' },
  { name: 'Webflow', domains: ['webflow.com'], category: 'design' },
  { name: 'Sketch', domains: ['sketch.com'], category: 'design' },
  { name: 'InVision', domains: ['invisionapp.com'], category: 'design' },
  { name: 'Procreate', domains: ['procreate.com'], category: 'design' },

  // ── Productivity ─────────────────────────────────────────────────────────
  { name: 'Notion', domains: ['notion.so', 'notion.com'], category: 'productivity', aliases: ['notion labs'] },
  { name: 'Airtable', domains: ['airtable.com'], category: 'productivity' },
  { name: 'Linear', domains: ['linear.app'], category: 'productivity' },
  { name: 'Miro', domains: ['miro.com'], category: 'productivity' },
  { name: 'Loom', domains: ['loom.com'], category: 'productivity' },
  { name: 'Grammarly', domains: ['grammarly.com'], category: 'productivity' },
  { name: 'Todoist', domains: ['todoist.com'], category: 'productivity' },
  { name: 'Asana', domains: ['asana.com'], category: 'productivity' },
  { name: 'Monday.com', domains: ['monday.com'], category: 'productivity' },
  { name: 'ClickUp', domains: ['clickup.com'], category: 'productivity' },
  { name: 'Trello', domains: ['trello.com'], category: 'productivity' },
  { name: 'Evernote', domains: ['evernote.com'], category: 'productivity' },
  { name: 'Obsidian', domains: ['obsidian.md'], category: 'productivity' },
  { name: 'Things', domains: ['culturedcode.com'], category: 'productivity' },
  { name: 'Bear', domains: ['bear.app'], category: 'productivity' },
  { name: 'Typeform', domains: ['typeform.com'], category: 'productivity' },

  // ── Communication ────────────────────────────────────────────────────────
  { name: 'Slack', domains: ['slack.com'], category: 'communication' },
  { name: 'Zoom', domains: ['zoom.us'], category: 'communication' },
  { name: 'Discord Nitro', domains: ['discord.com'], category: 'communication' },

  // ── Cloud Storage ────────────────────────────────────────────────────────
  { name: 'Dropbox', domains: ['dropbox.com'], category: 'storage' },
  { name: 'Google One', domains: ['googleone.google.com'], category: 'storage', aliases: ['google one'] },
  { name: 'iCloud+', domains: ['icloud.com'], category: 'storage', aliases: ['icloud+'] },
  { name: 'Backblaze', domains: ['backblaze.com'], category: 'storage' },
  { name: 'pCloud', domains: ['pcloud.com'], category: 'storage' },
  { name: 'Box', domains: ['box.com'], category: 'storage' },
  { name: 'Sync', domains: ['sync.com'], category: 'storage' },
  { name: 'Mega', domains: ['mega.nz', 'mega.io'], category: 'storage' },

  // ── Marketing / Analytics ────────────────────────────────────────────────
  { name: 'Mailchimp', domains: ['mailchimp.com'], category: 'marketing' },
  { name: 'ConvertKit', domains: ['convertkit.com'], category: 'marketing' },
  { name: 'Beehiiv', domains: ['beehiiv.com'], category: 'marketing' },
  { name: 'Zapier', domains: ['zapier.com'], category: 'marketing' },
  { name: 'Make', domains: ['make.com'], category: 'marketing' },
  { name: 'Buffer', domains: ['buffer.com'], category: 'marketing' },
  { name: 'Hootsuite', domains: ['hootsuite.com'], category: 'marketing' },
  { name: 'Mixpanel', domains: ['mixpanel.com'], category: 'marketing' },
  { name: 'Amplitude', domains: ['amplitude.com'], category: 'marketing' },
  { name: 'Hotjar', domains: ['hotjar.com'], category: 'marketing' },
  { name: 'SEMrush', domains: ['semrush.com'], category: 'marketing' },
  { name: 'Ahrefs', domains: ['ahrefs.com'], category: 'marketing' },

  // ── Education ────────────────────────────────────────────────────────────
  { name: 'Duolingo', domains: ['duolingo.com'], category: 'education' },
  { name: 'Coursera', domains: ['coursera.org'], category: 'education' },
  { name: 'Udemy', domains: ['udemy.com'], category: 'education' },
  { name: 'Skillshare', domains: ['skillshare.com'], category: 'education' },
  { name: 'MasterClass', domains: ['masterclass.com'], category: 'education' },
  { name: 'Brilliant', domains: ['brilliant.org'], category: 'education' },
  { name: 'LeetCode', domains: ['leetcode.com'], category: 'education' },
  { name: 'Khan Academy', domains: ['khanacademy.org'], category: 'education' },
  { name: 'Pluralsight', domains: ['pluralsight.com'], category: 'education' },
  { name: 'Codecademy', domains: ['codecademy.com'], category: 'education' },
  { name: 'Frontend Masters', domains: ['frontendmasters.com'], category: 'education' },
  { name: 'DataCamp', domains: ['datacamp.com'], category: 'education' },

  // ── VPN ──────────────────────────────────────────────────────────────────
  { name: 'NordVPN', domains: ['nordvpn.com'], category: 'vpn' },
  { name: 'ExpressVPN', domains: ['expressvpn.com'], category: 'vpn' },
  { name: 'ProtonVPN', domains: ['protonvpn.com'], category: 'vpn' },
  { name: 'Surfshark', domains: ['surfshark.com'], category: 'vpn' },
  { name: 'Mullvad', domains: ['mullvad.net'], category: 'vpn' },
  { name: 'CyberGhost', domains: ['cyberghost.com'], category: 'vpn' },
  { name: 'Private Internet Access', domains: ['privateinternetaccess.com'], category: 'vpn' },

  // ── Security / Privacy ───────────────────────────────────────────────────
  { name: 'Proton', domains: ['proton.me', 'protonmail.com'], category: 'security' },
  { name: '1Password', domains: ['1password.com'], category: 'security' },
  { name: 'Bitwarden', domains: ['bitwarden.com'], category: 'security' },
  { name: 'Dashlane', domains: ['dashlane.com'], category: 'security' },
  { name: 'LastPass', domains: ['lastpass.com'], category: 'security' },
  { name: 'Tutanota', domains: ['tutanota.com', 'tuta.com'], category: 'security' },

  // ── News / Reading ───────────────────────────────────────────────────────
  { name: 'Medium', domains: ['medium.com'], category: 'news' },
  { name: 'Substack', domains: ['substack.com'], category: 'news' },
  { name: 'Patreon', domains: ['patreon.com'], category: 'news' },
  { name: 'The New York Times', domains: ['nytimes.com'], category: 'news' },
  { name: 'The Wall Street Journal', domains: ['wsj.com'], category: 'news' },
  { name: 'Bloomberg', domains: ['bloomberg.com'], category: 'news' },
  { name: 'The Economist', domains: ['economist.com'], category: 'news' },
  { name: 'Financial Times', domains: ['ft.com'], category: 'news' },
  { name: 'The Athletic', domains: ['theathletic.com'], category: 'news' },

  // ── Gaming ───────────────────────────────────────────────────────────────
  { name: 'Xbox Game Pass', domains: ['xbox.com'], category: 'gaming', aliases: ['xbox game pass', 'game pass'] },
  { name: 'PlayStation Plus', domains: ['playstation.com'], category: 'gaming', aliases: ['playstation plus', 'ps plus'] },
  { name: 'Nintendo Online', domains: ['nintendo.com'], category: 'gaming', aliases: ['nintendo switch online'] },
  { name: 'Steam', domains: ['steampowered.com'], category: 'gaming' },
  { name: 'EA Play', domains: ['ea.com'], category: 'gaming' },
  { name: 'Ubisoft+', domains: ['ubisoft.com'], category: 'gaming' },
  { name: 'Roblox', domains: ['roblox.com'], category: 'gaming' },

  // ── Office / OS Bundles ──────────────────────────────────────────────────
  // NB: Apple, Google, Microsoft mega-brands cover multiple products; classified
  // as 'office' since the subject usually identifies the specific service.
  { name: 'Microsoft 365', domains: ['microsoft.com', 'office.com', 'office365.com'], category: 'office', aliases: ['office365', 'microsoft 365'] },
  { name: 'Google Workspace', domains: ['workspace.google.com'], category: 'office', aliases: ['google workspace'] },
  { name: 'Apple', domains: ['apple.com', 'email.apple.com', 'noreply.apple.com'], category: 'office' },
  // NB: bare google.com / accounts.google.com are intentionally NOT listed — they
  // are overwhelmingly non-billing (security alerts, sign-ins). Paid Google
  // products are covered by Google One / Workspace / AI Pro entries above.

  // ── Fitness / Health ─────────────────────────────────────────────────────
  { name: 'Strava', domains: ['strava.com'], category: 'fitness' },
  { name: 'Calm', domains: ['calm.com'], category: 'fitness' },
  { name: 'Headspace', domains: ['headspace.com'], category: 'fitness' },
  { name: 'Whoop', domains: ['whoop.com'], category: 'fitness' },
  { name: 'Fitbit Premium', domains: ['fitbit.com'], category: 'fitness' },
  { name: 'Peloton', domains: ['onepeloton.com'], category: 'fitness' },
  { name: 'MyFitnessPal', domains: ['myfitnesspal.com'], category: 'fitness' },

  // ── Other ────────────────────────────────────────────────────────────────
  { name: 'Twitch', domains: ['twitch.tv'], category: 'other' },
  { name: 'YouTube Premium', domains: ['youtube.com'], category: 'streaming', aliases: ['youtube premium'] },
]

// ---------------------------------------------------------------------------
// Auto-derived lookup structures
// ---------------------------------------------------------------------------

function extractDomainFromSender(senderHeader: string): string {
  const address = senderHeader.replace(/^.*</, '').replace(/>.*$/, '').trim().toLowerCase()
  const match = address.match(/@([\w.-]+\.\w+)/)
  return match ? match[1] : address
}

function rootOf(domain: string): string {
  const parts = domain.split('.')
  return parts.length >= 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : domain
}

// All domains (incl subdomains) that signal "this is a billing-capable sender"
export const KNOWN_BILLING_DOMAINS: Set<string> = new Set(
  SUBSCRIPTION_REGISTRY.flatMap((s) => s.domains).map(rootOf)
)

// Pre-built Gmail `from:` clause for the search query
export const REGISTRY_FROM_QUERY: string = Array.from(
  new Set(SUBSCRIPTION_REGISTRY.flatMap((s) => s.domains).map(rootOf))
)
  .map((d) => `from:${d}`)
  .join(' OR ')

/**
 * Resolve a sender header to a known service, returning {name, category} or null.
 *
 * Resolution order:
 *   1. Alias match on the full sender string (handles display names like "Google One")
 *   2. Exact domain match against any registry domain (handles subdomains)
 *   3. Root domain match (handles unknown subdomains of known services)
 */
export function lookupService(senderHeader: string): { name: string; category: SubscriptionCategory } | null {
  const senderLower = senderHeader.toLowerCase()

  // 1. Alias match — most specific
  for (const service of SUBSCRIPTION_REGISTRY) {
    if (service.aliases?.some((a) => senderLower.includes(a))) {
      return { name: service.name, category: service.category }
    }
  }

  const fullDomain = extractDomainFromSender(senderHeader)
  if (!fullDomain) return null

  // 2. Exact domain match (subdomain or root)
  for (const service of SUBSCRIPTION_REGISTRY) {
    if (service.domains.includes(fullDomain)) {
      return { name: service.name, category: service.category }
    }
  }

  // 3. Root domain match
  const root = rootOf(fullDomain)
  for (const service of SUBSCRIPTION_REGISTRY) {
    if (service.domains.some((d) => rootOf(d) === root)) {
      return { name: service.name, category: service.category }
    }
  }

  return null
}
