import OpenAI from 'openai'

// Clients are built on first use, not at import. Constructing them eagerly
// meant an absent key threw during module load and took the whole server down
// rather than degrading the one feature that needed it.

// A provider that never answers is worse than one that errors: without this the
// request hangs until the whole function is killed, and the deterministic
// fallback never gets a chance to run.
const PROVIDER_TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS ?? 12_000)

export type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export class NoModelAvailable extends Error {
  constructor(detail: string) {
    super(`No model provider available: ${detail}`)
    this.name = 'NoModelAvailable'
  }
}

type Provider = {
  name: string
  model: string
  client: OpenAI
}

// Model ids are configurable because pinning them in source is how this broke:
// the original default reached end of life and every call started failing with
// no code change on our side.
function providers(): Provider[] {
  const out: Provider[] = []
  if (process.env.GROQ_API_KEY) {
    out.push({
      name: 'groq',
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: PROVIDER_TIMEOUT_MS,
        maxRetries: 0,
      }),
    })
  }
  if (process.env.NVIDIA_API_KEY) {
    out.push({
      name: 'nvidia',
      model: process.env.NVIDIA_MODEL ?? 'nvidia/llama-3.1-nemotron-70b-instruct',
      client: new OpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        timeout: PROVIDER_TIMEOUT_MS,
        maxRetries: 0,
      }),
    })
  }
  return out
}

export function modelAvailable(): boolean {
  return providers().length > 0
}

export async function complete(
  messages: AIMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 512, temperature = 0.3 } = opts
  const available = providers()

  if (available.length === 0) {
    throw new NoModelAvailable('set NVIDIA_API_KEY or GROQ_API_KEY')
  }

  const failures: string[] = []
  for (const provider of available) {
    try {
      const res = await provider.client.chat.completions.create({
        model: provider.model,
        messages,
        max_tokens: maxTokens,
        temperature,
      })
      return res.choices[0]?.message?.content ?? ''
    } catch (err) {
      const detail = (err as Error).message
      failures.push(`${provider.name}: ${detail}`)
      console.warn(`[AI] ${provider.name} failed, trying next:`, detail)
    }
  }

  throw new NoModelAvailable(failures.join(' | '))
}

export async function generateSubscriptionInsight(sub: {
  name: string
  amount: number
  cadence: string
  signals: string[]
}): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        'You are SHAMAR, a subscription intelligence agent. Generate a single concise insight (1-2 sentences) about a subscription based on usage signals. Be direct, specific, and confidence-calibrated. Never alarmist.',
    },
    {
      role: 'user',
      content: `Subscription: ${sub.name} — $${sub.amount}/${sub.cadence}
Signals: ${sub.signals.join(', ')}
Generate insight:`,
    },
  ]
  try {
    return await complete(messages, { maxTokens: 120, temperature: 0.4 })
  } catch {
    return ''
  }
}
