// Only launched by vault-link.test.mjs with VAULT_LINK_REAL_TLS=1.
// No public network, hosted services, stored certificates, or user data.
import test from "node:test";
import assert from "node:assert/strict";
import { request, createServer } from "node:https";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../../src/lib/vault-link.ts", import.meta.url))],
  bundle: true, platform: "node", format: "cjs", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  createRequire(import.meta.url), compiled, compiled.exports,
);
const { fetchPublicFile, publicAddress } = compiled.exports;
const host = "download.vault-link.test"; // Reserved .test, never resolved externally.
const url = `https://${host}/file?token=synthetic-only`;
const body = Buffer.from("Synthetic HTTPS document");
const pins = [
  { address: "8.8.8.8", family: 4, local: "127.0.0.1" },
  { address: "2606:4700:4700::1111", family: 6, local: "::1" },
];

test("real TLS transport", { timeout: 30_000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), "vault-link-tls-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const keyPath = join(dir, "key.pem"), certPath = join(dir, "cert.pem");
  // Ephemeral, synthetic self-signed leaf explicitly trusted only by each request.
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", `/CN=${host}`, "-addext", `subjectAltName=DNS:${host}`,
    "-keyout", keyPath, "-out", certPath,
  ], { stdio: "ignore", timeout: 10_000 });
  const key = await readFile(keyPath), cert = await readFile(certPath);

  async function listen(server, local) {
    const sockets = new Set();
    server.on("connection", socket => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, local, () => { server.off("error", reject); resolve(); });
    });
    t.after(async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    });
    return server.address().port;
  }

  // Bridge ONLY the already-pinned DNS result into loopback and substitute the
  // fixture port. Preserve callback shape/family exactly: in particular, never
  // turn a scalar into an array when Node requests all:true. Node itself consumes
  // the result and creates the TCP/TLS socket; this is not a fake ClientRequest.
  function network(pin, port, { trust = true, removeFamily = false } = {}) {
    const seen = { dns: [], lookups: [], requests: [], errors: [], sockets: [] };
    return {
      seen,
      lookup: async (hostname, options) => {
        seen.dns.push({ hostname, options });
        return pins.map(p => ({ address: p.address, family: p.family }))
          .sort(a => a.family === pin.family ? -1 : 1);
      },
      request(originalUrl, options, callback) {
        assert.equal(originalUrl.hostname.endsWith(".test"), true);
        assert.equal(options.agent, false);
        assert.equal(options.rejectUnauthorized, undefined);
        const connectOptions = {
          // Treat the ephemeral fixture port as HTTPS's default port, so Node
          // generates the same Host header as the original port-443 request.
          ...options, port, defaultPort: port, ...(trust ? { ca: cert } : {}),
          lookup(hostname, lookupOptions, cb) {
            seen.lookups.push({ hostname, options: lookupOptions });
            options.lookup(hostname, lookupOptions, (error, address, family) => {
              assert.equal(error, null);
              assert.equal(address, pin.address); // Never route an arbitrary address.
              assert.equal(family, pin.family);
              cb(error, pin.local, family);
            });
          },
        };
        if (removeFamily) {
          delete connectOptions.family;
          connectOptions.autoSelectFamily = true;
        }
        const req = request(originalUrl, connectOptions, callback);
        seen.requests.push(req);
        req.on("error", error => seen.errors.push(error.code));
        req.on("socket", socket => {
          seen.sockets.push(socket);
          socket.on("secureConnect", () => {
            seen.remote = socket.remoteAddress;
            seen.authorized = socket.authorized;
          });
        });
        return req;
      },
    };
  }

  for (const pin of pins) {
    await t.test(`IPv${pin.family}: pinned connection retains original Host/SNI and verifies certificate`, async st => {
      const received = [];
      const server = createServer({ key, cert }, (req, res) => {
        received.push({ host: req.headers.host, sni: req.socket.servername, path: req.url,
          authorization: req.headers.authorization, cookie: req.headers.cookie });
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(body);
      });
      let port;
      try { port = await listen(server, pin.local); }
      catch (error) {
        if (pin.family === 6 && ["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code) &&
            !process.argv.includes("--require-ipv6")) {
          st.skip(`IPv6 loopback unavailable (${error.code}); use VAULT_LINK_TLS_REQUIRE_IPV6=1 to require it`);
          return;
        }
        throw error;
      }
      const net = network(pin, port);
      assert.deepEqual(await fetchPublicFile(url, net, 3000), body);
      assert.deepEqual(net.seen.dns, [{ hostname: host, options: { all: true, verbatim: true } }]);
      assert.equal(net.seen.lookups.length, 1);
      assert.equal(net.seen.lookups[0].hostname, host);
      assert.equal(net.seen.lookups[0].options.family, pin.family);
      assert.notEqual(net.seen.lookups[0].options.all, true);
      assert.equal(net.seen.remote, pin.local);
      assert.equal(net.seen.authorized, true);
      assert.deepEqual(received, [{
        host, sni: host, path: "/file?token=synthetic-only", authorization: undefined, cookie: undefined,
      }]);

      // Negative control: without explicit family modern Node invokes all:true.
      // The production scalar callback must then fail, reproducing the regression.
      const auto = network(pin, port, { removeFamily: true });
      await assert.rejects(fetchPublicFile(url, auto, 3000), e => e.status === 502);
      assert.equal(auto.seen.lookups[0].options.all, true);
      assert.ok(auto.seen.errors.includes("ERR_INVALID_IP_ADDRESS"));
      assert.equal(received.length, 1);

      const untrusted = network(pin, port, { trust: false });
      await assert.rejects(fetchPublicFile(url, untrusted, 3000),
        e => e.status === 502 && !e.message.includes("synthetic-only"));
      assert.ok(untrusted.seen.errors.includes("DEPTH_ZERO_SELF_SIGNED_CERT"));
      const wrongHost = network(pin, port);
      await assert.rejects(fetchPublicFile("https://wrong.vault-link.test/file", wrongHost, 3000),
        e => e.status === 502);
      assert.ok(wrongHost.seen.errors.includes("ERR_TLS_CERT_ALTNAME_INVALID"));
      assert.equal(received.length, 1, "TLS failures must not reach the HTTP handler");
    });
  }

  await t.test("real sockets abort on TLS handshake, response header and partial-body stalls", async () => {
    for (const phase of ["handshake", "headers", "body"]) {
      let reached;
      const entered = new Promise(resolve => { reached = resolve; });
      const server = phase === "handshake" ? createTcpServer(() => reached()) :
        createServer({ key, cert }, (_req, res) => {
          if (phase === "body") {
            res.writeHead(200, { "content-type": "text/plain", "content-length": "1000" });
            res.write("partial");
          }
          reached();
        });
      const port = await listen(server, pins[0].local);
      const net = network(pins[0], port);
      const start = performance.now();
      await assert.rejects(fetchPublicFile(url, net, 500), e => e.status === 504);
      await entered;
      const elapsed = performance.now() - start;
      assert.ok(elapsed >= 400 && elapsed < 2500, `${phase}: ${elapsed}ms`);
      assert.equal(net.seen.requests[0].destroyed, true, phase);
      // Wait for actual socket disposal, not only the deadline Promise winning.
      await Promise.all(net.seen.sockets.map(socket => socket.closed ? undefined :
        new Promise(resolve => socket.once("close", resolve))));
      assert.ok(net.seen.sockets.every(socket => socket.destroyed), phase);
    }
  });

  await t.test("loopback is still blocked before entering the real transport bridge", async () => {
    for (const address of ["127.0.0.1", "::1"]) {
      assert.equal(publicAddress(address), false);
      let requested = false;
      await assert.rejects(fetchPublicFile(url, {
        lookup: async () => [{ address, family: address === "::1" ? 6 : 4 }],
        request() { requested = true; throw new Error("must not connect"); },
      }), e => e.status === 400);
      assert.equal(requested, false);
    }
  });
});
