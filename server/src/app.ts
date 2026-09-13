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

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    allowHeaders: ['Content-Type', 'x-user-id'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
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

export default app
