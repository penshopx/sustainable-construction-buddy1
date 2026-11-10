# Real Node HTTPS regression check

Run from the repository root:

```sh
VAULT_LINK_REAL_TLS=1 node --test artifacts/api-server/tests/vault-link.test.mjs
```

Requires Node with automatic address-family selection (Node 20+), OpenSSL on
`PATH`, and permission to listen on ephemeral loopback ports. The normal suite
keeps its deterministic fixtures; the TLS harness is opt-in.

The parent launches a separate Node process with only `PATH` in its environment.
It bundles the **unchanged production downloader** without DNS/HTTPS module mocks,
generates a short-lived synthetic certificate in a temporary directory, and
removes the directory on completion. No application credentials, database, App
Storage, public DNS, or public HTTPS service is used.

The injected DNS boundary returns synthetic public IPv4 and IPv6 addresses.
Immediately before Node consumes the downloader's pinned lookup result, a
test-only request adapter asserts the exact pin and maps it to the matching
loopback family. The fixture port is treated as the default HTTPS port so Node
generates the original Host header. It does **not** change the hostname, SNI,
callback result shape, address family, TLS verification, or production IP policy.
Only these fixture requests trust the generated certificate.

Checks cover:

- Exact first-address pin and real socket family for both DNS answer orders.
- Real Node lookup options, including a negative control that removes `family`
  and reproduces `all: true` / `ERR_INVALID_IP_ADDRESS` with the scalar callback.
- Actual HTTP Host/SNI and authorized TLS, with certificate-chain and hostname
  mismatch failures rejected before HTTP reaches the server.
- Deadlines during a stalled TLS handshake, response headers, and partial body;
  the underlying request and socket must be destroyed.
- Production loopback rejection before the request adapter can run.

IPv4 is mandatory. IPv6 is explicitly reported as skipped only when the OS lacks
IPv6 loopback (`EAFNOSUPPORT` / `EADDRNOTAVAIL`); other errors fail. To make IPv6
mandatory on a dual-stack CI runner:

```sh
VAULT_LINK_REAL_TLS=1 VAULT_LINK_TLS_REQUIRE_IPV6=1 \
  node --test artifacts/api-server/tests/vault-link.test.mjs
```

The child has a hard process timeout in addition to test and download deadlines,
so a transport regression cannot leave the parent waiting indefinitely.
