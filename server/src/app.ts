import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import subscriptions from './routes/subscriptions.js'
import gmail from './routes/gmail.js'
import intelligence from './routes/intelligence.js'
import wallet from './routes/wallet.js'
import recommendations from './routes/recommendations.js'
import agent from './routes/agent.js'
import self from './routes/self.js'
import reminders from './routes/reminders.js'
import actions from './routes/actions.js'
import policies from './routes/policies.js'
import execute from './routes/execute.js'
import renewals from './routes/renewals.js'
import telegram from './routes/telegram.js'
import account from './routes/account.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return '*'
      if (
        origin.includes('namite.xyz') ||
        origin.includes('vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return origin
      }
      return process.env.FRONTEND_URL ?? origin
    },
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'authorization',
      'x-user-id',
      'x-wallet-address',
      'x-wallet-signature',
      'x-wallet-timestamp',
      'x-cron-secret',
    ],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.get('/health', (c) => c.json({ status: 'ok', service: 'sam-server' }))

app.route('/subscriptions', subscriptions)
app.route('/gmail', gmail)
app.route('/intelligence', intelligence)
app.route('/wallet', wallet)
app.route('/recommendations', recommendations)
app.route('/agent', agent)
app.route('/self', self)
app.route('/reminders', reminders)
app.route('/actions', actions)
app.route('/policies', policies)
app.route('/execute', execute)
app.route('/renewals', renewals)
app.route('/telegram', telegram)
app.route('/account', account)

export default app
