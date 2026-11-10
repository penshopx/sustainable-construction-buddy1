# Vite test cache regression

Run from the workspace root:

```sh
pnpm --filter @workspace/pub-aspekindo run test:cache-isolation
pnpm --filter @workspace/pub-aspekindo run test:cache-policy
```

The normal `test` command runs the policy check **before** starting any test
suite. The policy scans all `src/lib/*.integration.test.ts`, including newly
added files, without importing or running them.

Each Vite `createServer` call must use an inline configuration with a unique,
literal `cacheDir` of the form `node_modules/.vite-<suite>-tests`. Static named
imports (including aliases) and namespace imports are supported. Indirect
factories/configurations, dynamic imports, spreads and computed config keys
fail closed because they could hide or overwrite the cache path. If the test
harness changes, extend the policy and its negative controls together.

The runtime regression creates its own tiny CommonJS dependency and Vite
preview in an OS temporary directory on an ephemeral loopback port. A second
SSR server performs dependency optimization with a different optimizer config.
Isolated caching must preserve the preview metadata byte-for-byte, the
versioned dependency URL, and the dependency response. Sharing the cache must
trip the same metadata assertion (the negative control).

Both fixture servers and their temporary files are cleaned up in `finally`.
No application Vite config, application preview cache, or running preview
workflow is used or restarted. These are Node tests; no browser is required.
