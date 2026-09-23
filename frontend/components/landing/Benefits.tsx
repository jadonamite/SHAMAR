import BrandLogo, { type BrandName } from '@/components/ui/BrandLogo'
import { Card, Pill } from '@/components/landing/primitives'

const KEPT: Array<{ brand: BrandName; name: string; reason: string }> = [
  { brand: 'dropbox', name: 'Dropbox Plus', reason: 'Your files live here' },
  { brand: 'spotify', name: 'Spotify Family', reason: 'Your family shares it' },
  {
    brand: 'netflix',
    name: 'Netflix Standard',
    reason: 'You’d pay more to come back',
  },
]

function Regret() {
  return (
    <Card as="article" className="flex flex-col gap-6 p-6 md:col-span-2 md:p-7">
      <div className="flex flex-col gap-3">
        <h3 className="type-title-1 max-w-[18ch]">
          It won&rsquo;t cancel{' '}
          <span className="em-claim">what you&rsquo;d regret</span>.
        </h3>
        <p className="type-callout max-w-[46ch] text-label-2">
          Before anything goes, SHAMAR checks what you&rsquo;d lose. Deleted
          files, a plan other people rely on, a price you&rsquo;d never get
          again. If it would hurt, it just reminds you.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {KEPT.map((k) => (
          <li
            key={k.name}
            className="flex flex-col gap-4 rounded-[var(--radius-tile)] bg-surface-2 p-4"
          >
            <div className="flex items-center justify-between">
              <BrandLogo name={k.brand} size={40} />
              <span className="type-caption rounded-full bg-surface px-2.5 py-1 font-semibold text-success">
                Kept
              </span>
            </div>
            <div>
              <p className="type-headline">{k.name}</p>
              <p className="type-footnote text-label-2">{k.reason}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Silence() {
  return (
    <Card
      as="article"
      tone="accent"
      className="flex flex-col justify-between gap-8 p-6 md:p-7"
    >
      <h3 className="type-title-2">
        Silence means <span className="em-claim">cancel</span>.
      </h3>
      <div>
        <p className="flex items-baseline gap-2">
          <span className="text-[6rem] font-[600] leading-none tracking-[-0.06em] tabular">
            36
          </span>
          <span className="type-title-3">hours</span>
        </p>
        <p className="type-callout mt-2 text-on-accent/85">
          It asks three times. If you never answer, it cancels a day and a half
          before you&rsquo;re charged.
        </p>
      </div>
    </Card>
  )
}

function Calendar() {
  const days = [
    { d: 'Fri 4', brand: 'netflix' as const, name: 'Netflix', price: '$15.49' },
    {
      d: 'Thu 9',
      brand: 'claude' as const,
      name: 'Claude Pro',
      price: '$20.00',
    },
  ]
  return (
    <Card
      as="article"
      className="flex flex-col justify-between gap-5 p-6 md:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="type-title-2 max-w-[16ch]">
          No more <span className="em-claim">surprise</span> charges.
        </h3>
        <BrandLogo name="googlecalendar" size={44} label="Google Calendar" />
      </div>
      <div className="flex flex-col gap-2">
        {days.map((x) => (
          <div
            key={x.d}
            className="flex items-center gap-3 rounded-[12px] bg-surface-2 px-3 py-2"
          >
            <span className="type-caption w-10 text-label-3">{x.d}</span>
            <span className="h-8 w-1 rounded-full bg-accent" aria-hidden />
            <BrandLogo name={x.brand} size={28} />
            <span className="type-footnote flex-1 font-semibold">
              {x.name} renews
            </span>
            <span className="type-footnote tabular text-label-2">
              {x.price}
            </span>
          </div>
        ))}
      </div>
      <p className="type-callout text-label-2">
        Every renewal lands on your Google Calendar, two days&rsquo; warning
        included.
      </p>
    </Card>
  )
}

function InCharge() {
  return (
    <Card
      as="article"
      tone="inverse"
      className="flex flex-col justify-between gap-8 p-6 md:col-span-2 md:p-7"
    >
      <ul className="flex flex-wrap gap-2">
        {[
          'Nothing happens without your say-so',
          'Pause it from your phone',
          'Take back access any time',
        ].map((x) => (
          <li key={x}>
            <Pill tone="inverse">{x}</Pill>
          </li>
        ))}
      </ul>
      <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <div className="flex max-w-[26rem] flex-col gap-3">
          <h3 className="type-title-1">
            You&rsquo;re <span className="em-claim">always</span> in charge.
          </h3>
          <p className="type-callout text-on-inverse/70">
            SHAMAR only does what you&rsquo;ve allowed, and you can take that
            back whenever you like. Changed your mind halfway through? Send one
            word.
          </p>
        </div>
        <div className="flex w-full max-w-[22rem] flex-col gap-2" aria-hidden>
          <div className="type-callout self-end rounded-[18px] rounded-br-[6px] bg-accent px-4 py-2.5 font-semibold text-on-accent">
            /stop
          </div>
          <div className="type-callout max-w-[18rem] rounded-[18px] rounded-bl-[6px] bg-inverse-raised px-4 py-3 text-on-inverse">
            Paused. Nothing gets cancelled until you send /resume.
          </div>
          <div className="flex items-center gap-2 pt-1">
            <BrandLogo name="telegram" size={20} />
            <span className="type-caption text-on-inverse/60">
              SHAMAR on Telegram
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function Benefits() {
  return (
    <section
      aria-labelledby="why"
      className="flex min-h-[calc(100svh-32px)] flex-col justify-center gap-6"
    >
      <div className="flex flex-col gap-4 px-2 md:flex-row md:items-end md:justify-between md:px-4">
        <div className="flex flex-col gap-4">
          <p className="type-eyebrow inline-flex items-center gap-2 text-label-2">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" /> Why
            SHAMAR
          </p>
          <h2 id="why" className="type-display max-w-[18ch]">
            Made for people who{' '}
            <span className="em-claim">never get round to it</span>.
          </h2>
        </div>
        <p className="type-callout max-w-[34ch] text-label-2">
          Careful where it counts, relentless where you&rsquo;d rather not think
          about it.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3 md:gap-5">
        <Regret />
        <Silence />
        <Calendar />
        <InCharge />
      </div>
    </section>
  )
}
