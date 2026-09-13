import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
  allowedDevOrigins: ['localhost:3000', '127.0.0.1:3000'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.SAM_SERVER_URL ?? 'http://localhost:3001'}/:path*`,
      },
    ]
  },
}

export default config
