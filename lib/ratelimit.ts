import 'server-only'

// Fallback en memoria para rate limiting (dev y producción sin Redis)
const memMap = new Map<string, number[]>()
export function checkMemRateLimit(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const hits = (memMap.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= max) return false
  memMap.set(key, [...hits, now])
  return true
}
