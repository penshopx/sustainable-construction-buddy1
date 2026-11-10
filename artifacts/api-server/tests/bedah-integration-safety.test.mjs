import test from "node:test";
import assert from "node:assert/strict";
import { localUrl } from "./helpers/bedah-integration.mjs";

test("real-Auth integration refuses hosted services before provisioning", () => {
  for (const value of [
    "https://example.supabase.co", "http://127.0.0.1.evil.test",
    "http://localhost.evil.test", "https://example.test@evil.test",
    "http://127.0.0.1?target=hosted", "file:///tmp/supabase",
  ]) assert.throws(() => localUrl(value));
  assert.equal(localUrl("http://127.0.0.1:54321").hostname, "127.0.0.1");
  assert.equal(localUrl("https://localhost:54321").hostname, "localhost");
  assert.throws(() => localUrl("postgresql://user:password@hosted.example/postgres", ["postgresql:"]));
  assert.equal(localUrl("postgresql://test:local@127.0.0.1:54322/postgres", ["postgresql:"]).hostname, "127.0.0.1");
});
