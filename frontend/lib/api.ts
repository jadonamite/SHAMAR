import { getAccessToken } from '@privy-io/react-auth'

/**
 * apiFetch wraps native fetch to automatically attach Privy JWT Bearer authorization
 * and optionally include user ID headers during the auth transition.
 */
export async function apiFetch(
  input: string | URL | Request,
  init?: RequestInit & { userId?: string }
): Promise<Response> {
  const headers = new Headers(init?.headers)

  try {
    const token = await Promise.race([
      getAccessToken(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ])
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  } catch {
    // Privy not yet initialized, SSR, or no active session
  }

  if (init?.userId && !headers.has('x-user-id')) {
    headers.set('x-user-id', init.userId)
  }

  const { userId: _unusedUserId, ...restInit } = init ?? {}
  return fetch(input, {
    ...restInit,
    headers,
  })
}
