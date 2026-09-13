import type { Context } from 'hono'

// Reading the request body through the Vercel node adapter can hang rather
// than reject when the body is absent or already consumed, and a hung read
// takes the whole function down with it. Every handler goes through here.
export async function readBody<T extends object>(c: Context, ms = 2000): Promise<Partial<T>> {
  const parse = (async () => {
    try {
      const raw = await c.req.text()
      if (!raw) return {}
      return JSON.parse(raw) as Partial<T>
    } catch {
      return {}
    }
  })()

  return Promise.race([
    parse,
    new Promise<Partial<T>>((resolve) => setTimeout(() => resolve({}), ms)),
  ])
}
