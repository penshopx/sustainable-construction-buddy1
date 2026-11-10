function createPublicChatRateLimiter({
  windowMs = 5 * 60 * 1000,
  maxRequests = 20,
  maxIps = 5000,
} = {}) {
  const entries = new Map();

  function exceedsLimit(ip, now = Date.now()) {
    const key = typeof ip === "string" && ip ? ip : "unknown";
    const current = entries.get(key);

    if (!current || current.resetAt <= now) {
      if (entries.size >= maxIps) {
        for (const [entryKey, value] of entries) {
          if (value.resetAt <= now) entries.delete(entryKey);
        }
      }
      if (entries.size >= maxIps && !entries.has(key)) return true;

      entries.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }

    current.count += 1;
    return current.count > maxRequests;
  }

  return {
    exceedsLimit,
    size: () => entries.size,
  };
}

module.exports = { createPublicChatRateLimiter };