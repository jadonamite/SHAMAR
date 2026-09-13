import { handle } from '@hono/node-server/vercel'

// Import from compiled output (dist/ created by `npm run build`)
// @ts-ignore
import app from '../dist/app.js'

export const config = { runtime: 'nodejs' }

export default handle(app)
