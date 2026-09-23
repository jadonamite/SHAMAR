# Owner feedback on the redesign

Every complaint the owner raised during the 2026-09-23 redesign, in the order it was raised,
with what changed in response. Read this before touching the landing page again; most of
these are rules, not one-off fixes.

## Round 1: direction

- The build should use the supplied reference layout (`public/NewReferencedesign.jpeg`) as
  the design system and layout structure.
- Change the font to Switzer, with italics in places.
- Replace every instance of the old logo with the new upscaled mark, and make a logo
  component with mark-only and mark-plus-wordmark versions.

Done: Switzer self-hosted with its italic; `components/ui/Logo.tsx`; old SAM files removed.

## Round 2: "this is a website pitch, not a technical architecture"

- **Dark theme.** Disliked. Drop it or fix it. Dropped; the site is light only.
- **No technical language on the site.** No Base mainnet, contracts, scopes. The audience is
  people who forget subscriptions and can't be bothered to cancel them. The page should say
  what makes SHAMAR good, not how it is built. `MESSAGING.md` now governs all copy and lists
  banned words.
- **Real logos.** Use the actual Claude, Figma and other service logos, not invented ones.
  `BrandLogo` now draws official marks in brand colours.
- **Keep the old animations and illustrations.** The notification cascade and the
  strike-through lines came back.
- **Keep the old icons** for X, GitHub and the cookie link. Restored in `SocialIcons`.
- **The four-step scroll animation was dropped and not replaced.** Restored as a pinned
  horizontal scroll.
- **The hero was bad.** Rebuilt around the cascade.
- **The hero logo should be the image only**, not the wordmark (later reversed, see round 4).

## Round 3: details

- Use the supplied Duolingo icon (`public/duolingo.jpeg`), not the generic one.
- Remove "For everyone with one subscription too many".
- The four-step horizontal scroll was broken. Two causes, both fixed: React switched the
  layout after ScrollTrigger measured it, and ScrollTrigger drops pin spacing under a flex
  parent.
- Replace LinkedIn with Telegram in the footer.
- The footer SHAMAR text should be a faint background watermark (later replaced, round 6).
- The logo's font and size were unpleasant and needed investigating.
- "Coming up this month" should slide its subscriptions in from the card's own edge.

## Round 4: sizes and structure

- The logo was too big, and so was the text. Both reduced.
- Put the wordmark back next to the mark.
- Drop "How it works" and "Sign in" from the nav; move "Find my subscriptions" and "See how
  it works" into the top bar.
- The hero should be taller than 80% of the viewport.
- Sections were cramped; they need real spacing.
- Make a light, red-accented version of the supplied purple blob background
  (`public/Purple Background.jpeg`) for behind the hero.

## Round 5: "you are not getting what I want"

- **Wordmark spec, exactly:** `font-variation-settings: "wdth" 125; letter-spacing: -.08em;
  text-transform: uppercase; font-weight: 700; font-size: 1rem; line-height: 1.3`. That needs
  the variable Archivo font, which has the width axis. Archivo Black does not.
- **"Hug" means fit the content.** The "Coming up this month" card should wrap its own
  content, not stretch to fill the hero.
- **The top-bar buttons go to the far right edge.**
- **The background didn't show and wasn't refined.** Now it spells SHAMAR abstractly in
  pale red monoline strokes, visible, with no veil over it.
- **Each section should own the viewport**, and the page shouldn't feel like cards cut and
  joined together.

## Round 6

- "Sound familiar?" should not fill the whole screen. It is back to its natural height with
  generous padding.
- The footer should be about 45% of the viewport and use the same SHAMAR background as the
  hero. The watermark text is gone; the pattern replaces it.

## Standing rules drawn from all of the above

1. Pitch, not specs. If a sentence needs a technical term to make sense, it belongs in the
   README.
2. Real brand assets only. Never draw a stand-in for a real company's logo.
3. Keep what the owner made unless they say otherwise; restyle it rather than replace it.
4. When the owner gives exact CSS, use exactly that CSS.
5. "Hug" means fit the content.
6. Light theme only.
7. Check the result in a browser at desktop and phone widths before calling anything done.
