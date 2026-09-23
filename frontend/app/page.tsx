import Hero from '@/components/landing/Hero'
import Problem from '@/components/landing/Problem'
import HowItWorks from '@/components/landing/HowItWorks'
import Benefits from '@/components/landing/Benefits'
import Footer from '@/components/landing/Footer'
import Reveal from '@/components/landing/Reveal'

// Each section owns the viewport; they read as scenes, not stacked cards.
export default function Home() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-10 p-3 md:gap-16 md:p-4">
      <Hero />
      <Reveal>
        <Problem />
      </Reveal>
      {/* Block wrapper: ScrollTrigger drops pin spacing when the pinned element's parent is flex */}
      <div>
        <HowItWorks />
      </div>
      <Reveal>
        <Benefits />
      </Reveal>
      <Reveal>
        <Footer />
      </Reveal>
    </main>
  )
}
