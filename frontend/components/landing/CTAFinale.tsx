import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

const handleLogin = (login, setEntering, router, authenticated) => {
  if (authenticated) {
    router.push('/dashboard');
  } else {
    setEntering(true);
    login();
  }
};

export default function CTAFinale() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    if (entering && authenticated) router.push('/dashboard');
  }, [entering, authenticated, router]);

  function handleCTA() {
    if (!ready) return;
    handleLogin(login, setEntering, router, authenticated);
  }

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#0D0D0D' }}
    >
      {/* Breathing red glow */}
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(229,9,20,0.35) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative z-10 text-center px-5 sm:px-8 max-w-3xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-muted uppercase mb-6"
          style={{
            fontFamily: 'var(--font-dm-mono)',
            fontSize: '10px',
            letterSpacing: '0.16em',
          }}
        >
          Ciphergon · Subscription Intelligence
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-white font-extrabold mb-10 leading-none"
          style={{
            fontFamily: 'var(--font-syne)',
            fontSize: 'clamp(40px, 6vw, 80px)',
            letterSpacing: '-0.03em',
          }}
        >
          Stop losing money
          <br />
          <span style={{ color: '#E50914' }}>to silence.</span>
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Button size="lg" onClick={handleCTA}>Get Early Access</Button>
        </motion.div>
      </div>
    </section>
  );
}
