import 'dotenv/config'
import { serve } from '@hono/node-server'
import app from './app.js'
import net from 'net'

// Disable auto-select family to prevent database connection timeouts on half-configured IPv6 networks
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false)
}

const port = Number(process.env.PORT ?? 3001)

serve({ fetch: app.fetch, port }, () => {
  console.log(`SAM server running on http://localhost:${port}`)
})
