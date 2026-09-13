import OpenAI from 'openai'

const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: 'https://integrate.api.nvidia.com/v1',
})

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: 'https://api.groq.com/openai/v1',
})

export type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function complete(
  messages: AIMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 512, temperature = 0.3 } = opts

  try {
    const res = await nvidia.chat.completions.create({
      model: 'meta/llama-3.1-70b-instruct',
      messages,
      max_tokens: maxTokens,
      temperature,
    })
    return res.choices[0]?.message?.content ?? ''
  } catch (err) {
    console.warn('[AI] NVIDIA NIM failed, falling back to Groq:', (err as Error).message)

    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: maxTokens,
      temperature,
    })
    return res.choices[0]?.message?.content ?? ''
  }
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
        'You are SAM, a subscription intelligence agent. Generate a single concise insight (1-2 sentences) about a subscription based on usage signals. Be direct, specific, and confidence-calibrated. Never alarmist.',
    },
    {
      role: 'user',
      content: `Subscription: ${sub.name} — $${sub.amount}/${sub.cadence}
Signals: ${sub.signals.join(', ')}
Generate insight:`,
    },
  ]
  return complete(messages, { maxTokens: 120, temperature: 0.4 })
}
