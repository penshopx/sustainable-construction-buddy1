const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { createPublicChatRateLimiter } = require("../public-chat-rate-limit.cjs");

test("trusted proxy isolates visitors and ignores spoofed leftmost addresses", async (t) => {
  const app = express();
  app.set("trust proxy", 1);
  const limiter = createPublicChatRateLimiter({ maxRequests: 2, windowMs: 60_000, maxIps: 10 });

  app.get("/limited", (req, res) => {
    const limited = limiter.exceedsLimit(req.ip);
    res.status(limited ? 429 : 200).json({ ip: req.ip });
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const request = (forwardedFor) =>
    fetch(`http://127.0.0.1:${port}/limited`, {
      headers: { "x-forwarded-for": forwardedFor },
    });

  assert.equal((await request("203.0.113.10")).status, 200);
  assert.equal((await request("203.0.113.10")).status, 200);
  assert.equal((await request("203.0.113.10")).status, 429);
  assert.equal((await request("198.51.100.20")).status, 200);

  const spoofedChain = await request("192.0.2.99, 198.51.100.20");
  assert.equal(spoofedChain.status, 200);
  assert.equal((await spoofedChain.json()).ip, "198.51.100.20");
});

test("limiter bounds retained IP entries", () => {
  const limiter = createPublicChatRateLimiter({ maxRequests: 2, windowMs: 60_000, maxIps: 2 });

  assert.equal(limiter.exceedsLimit("203.0.113.1", 1_000), false);
  assert.equal(limiter.exceedsLimit("203.0.113.2", 1_000), false);
  assert.equal(limiter.exceedsLimit("203.0.113.3", 1_000), true);
  assert.equal(limiter.size(), 2);
});