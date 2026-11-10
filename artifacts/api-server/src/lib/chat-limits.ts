export function createWindowLimiter(windowMs: number, maxRequests: number, maxKeys = 5000) {
  const entries = new Map<string, { count: number; resetAt: number }>();
  const consume = (key: string, now = Date.now()): number => {
    const current = entries.get(key);
    if (current && current.resetAt > now) {
      if (current.count >= maxRequests) return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      current.count += 1;
      return 0;
    }
    if (entries.size >= maxKeys) {
      for (const [id, value] of entries) if (value.resetAt <= now) entries.delete(id);
    }
    if (entries.size >= maxKeys && !entries.has(key)) return Math.ceil(windowMs / 1000);
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  };
  const inspect = (key: string, now = Date.now()) => {
    const current = entries.get(key);
    const live = current && current.resetAt > now ? current : undefined;
    // A full map refuses new keys, but never exposes other members' counts.
    const capacity = !live && !entries.has(key) && entries.size >= maxKeys &&
      [...entries.values()].every(value => value.resetAt > now);
    const resetAt = live?.resetAt ?? (capacity ? now + windowMs : null);
    const remaining = capacity ? 0 : Math.max(0, maxRequests - (live?.count ?? 0));
    return {
      limit: maxRequests, remaining,
      resetAt: resetAt === null ? null : new Date(resetAt).toISOString(),
      retryAfterSeconds: remaining === 0 && resetAt !== null ? Math.max(1, Math.ceil((resetAt - now) / 1000)) : 0,
    };
  };
  return Object.assign(consume, { inspect });
}

// Preserve Ruang Simpan's rolling-minute policy rather than replacing it with
// a fixed window when adding a read-only snapshot.
export function createSlidingLimiter(windowMs: number, maxRequests: number) {
  const entries = new Map<string, number[]>();
  const recent = (key: string, now: number) => (entries.get(key) ?? []).filter(t => t > now - windowMs);
  const inspect = (key: string, now = Date.now()) => {
    const times = recent(key, now);
    const reset = times.length ? times[0] + windowMs : null;
    return {
      limit: maxRequests, remaining: Math.max(0, maxRequests - times.length),
      resetAt: reset === null ? null : new Date(reset).toISOString(),
      retryAfterSeconds: times.length >= maxRequests ? Math.max(1, Math.ceil((reset! - now) / 1000)) : 0,
    };
  };
  return Object.assign((key: string, now = Date.now()) => {
    const wait = inspect(key, now).retryAfterSeconds;
    if (wait) return wait;
    entries.set(key, [...recent(key, now), now]);
    if (entries.size > 5000) {
      for (const [id, times] of entries) if (!times.some(t => t > now - windowMs)) entries.delete(id);
    }
    return 0;
  }, { inspect });
}
