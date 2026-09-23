# SHAMAR design foundations

Last updated 2026-09-23 (light only). Values live in `app/globals.css`; this file says what they mean and
the rules for using them. Structure and behaviour follow Apple's Human Interface Guidelines,
ported to the web. Visual identity comes from the reference layout the owner supplied
(`public/NewReferencedesign.jpeg`): a light canvas, rounded bento cards, one black slab per
page, huge type, pill chips, a single hot accent.

## Brand

The mark is the faceted red A in `public/brand/`. Use it through `components/ui/Logo.tsx`,
never as a raw `<img>`.

| Variant | Where |
|---|---|
| `lockup` (mark + wordmark) | Landing nav, app top bar, footer, anywhere the name is not already on screen |
| `mark` | Favicon, touch icon, collapsed nav, the hero, anywhere space is under 120px wide |
| `wordmark` | Over the black slab or a photo, where the mark would compete with the image |

The mark is glossy red on transparency. It sits on the canvas, on white cards and on the
black slab. It never sits on the accent colour, and it is never recoloured or outlined.
Minimum mark height is 16px. In the lockup the wordmark is Archivo (variable) at weight 700, width
axis `"wdth" 125`, -0.08em tracking, uppercase, line-height 1.3, sized at 0.72 of the mark
height (16px beside a 22px mark). Archivo is for the wordmark only.

## Type

One family, Switzer (variable, with a true italic), self-hosted from `app/fonts/`.
Monospace is the system stack and is only for addresses, hashes and code.

| Role | Utility | Size | Line height | Weight |
|---|---|---|---|---|
| Hero wordmark | `type-hero` | clamp 80 to 304px | 0.82 | 600 |
| Display | `type-display` | clamp 36 to 64px | 1.02 | 560 |
| Title 1 | `type-title-1` | 34px | 1.1 | 560 |
| Title 2 | `type-title-2` | 28px | 1.12 | 560 |
| Title 3 | `type-title-3` | 19px | 1.2 | 600 |
| Headline | `type-headline` | 16px | 1.25 | 600 |
| Body | `type-body` | 16px | 1.5 | 400 |
| Callout | `type-callout` | 15px | 1.45 | 400 |
| Footnote | `type-footnote` | 13px | 1.35 | 450 |
| Caption | `type-caption` | 12px | 1.3 | 500 |
| Eyebrow | `type-eyebrow` | 12px, uppercase, 0.08em | 1.3 | 560 |

12px is the floor for anything a person has to read. Hierarchy comes from weight and colour
before size: Headline and Body are the same size.

**Italic.** `em-claim` sets italic at weight 380. Use it on the one phrase in a headline
that carries the claim ("It decides *what cancelling costs*"), and on quoted speech. One
italic phrase per headline, never in labels, buttons, numbers or body copy.

## Colour

Semantic tokens only. Components never carry a raw hex value.

| Token | Value | | Role |
|---|---|---|---|
| `canvas` | #EEEEF2 | | Page background |
| `surface` | #FFFFFF | #161618 | Cards |
| `surface-2` | #F5F5F8 | #1E1E21 | Tiles inside a card, inputs |
| `inverse` | #0B0B0C | #000000 | The black slab |
| `on-inverse` | #FFFFFF | #FFFFFF | Text on the slab |
| `inverse-raised` | #1C1C1F | #1C1C1F | A tile floating on the slab |
| `success-on-inverse` | #3DD17A | #3DD17A | Success text on the slab (8.9:1 on #0B0B0C) |
| `label` | #0B0B0C | #F5F5F7 | Primary text |
| `label-2` | #5C5C66 | #A1A1AA | Secondary text |
| `label-3` | #6B6B73 | #8E8E96 | Captions, timestamps |
| `separator` | 8% ink | 8% white | Hairlines |
| `accent` | #D90012 | #E0101F | Fills: primary buttons, the highlighted row |
| `accent-text` | #D90012 | #FF5C68 | Red text and focus rings |
| `success`, `warning` | #107C3A, #A15C00 | #3DD17A, #F0A93B | Status, always paired with a label |

The accent is sampled from the mark (#D80010 to #E80018). Measured contrast: white on
accent 5.3:1 (light) and 4.9:1 (dark); `label-2` on canvas 5.7:1; `label-3` on canvas
4.6:1 and on white 5.3:1; dark `accent-text` on surface 6.0:1.

Red means "the agent acts or is about to". It is not decoration. One accent-filled element
per viewport where possible.

**Light only.** The owner dropped the dark theme on 2026-09-23. This departs from the HIG's
expectation that interfaces support both appearances; it is a surface decision, so taste
wins. The Dark column above is historical. Contrast and target rules are unaffected.

## Service logos

Real marks only, from Simple Icons (`public/logos/`), through `components/ui/BrandLogo.tsx`,
which draws each as an app-icon tile in the brand's own colours. Figma uses its five-colour
mark. They show which services SHAMAR recognises; never recolour them into SHAMAR red, and
never invent a logo for a service that isn't in the set.

## Voice on the site

`MESSAGING.md` rules the landing page. No chain, contract, scope or model vocabulary.

## Space

`4 8 12 16 20 24 32 40 48 64 96`. Nothing else. 16px is the phone gutter; cards use 24px
padding on phone and 32px from `md` up. Sections are 12px apart on phone, 16px from `md`,
the way the reference stacks its cards.

## Shape and depth

| Radius | Value | Used for |
|---|---|---|
| `control` | 10px | Inputs, small buttons |
| `tile` | 16px | Tiles inside a card, images inside a card |
| `card` | 24px | Cards |
| `section` | 32px | Full-width section cards, the slab |
| full | 9999px | Pills, round icon buttons, primary buttons |

Depth is colour first: a white card on the grey canvas needs no shadow. `--shadow-float` is
for things that genuinely float above content (menus, sheets, the cookie banner) and nothing
else. Glass (`.glass`) is for the sticky navigation bar only, with a solid fallback and a
solid surface under Reduce Transparency.

## Targets and input

Every interactive element has a 44 by 44px hit region (`touch-target`), with at least 8px
between neighbours. Round icon buttons are drawn at 44px or larger. Every control has a
`:focus-visible` ring in `accent-text`. Nothing is reachable by hover alone.

## Motion

`quick` 150ms for state changes, `base` 250ms for transitions, `enter` 350ms for things
arriving. `ease-out` when something arrives, `ease-in` when it leaves. Motion explains where
something came from; anything that can't be described that way is cut. Under Reduce Motion,
durations drop to near zero.

## Components and states

Every interactive component ships with default, hover, focus-visible, active, disabled and
loading states before it ships at all. Lists ship with an empty state. Anything that fetches
ships with an error state that says what failed and what to do.
