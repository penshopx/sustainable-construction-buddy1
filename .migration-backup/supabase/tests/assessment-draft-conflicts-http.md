# Draft conflicts on the full local Supabase stack

`scripts/test-assessment-draft-conflicts-http.py` exercises the deployed SQL
functions through **real Auth password sessions and PostgREST**, not the minimal
PostgreSQL schema or a mocked browser API. It needs Python 3 (standard library
only), `psql`, Supabase CLI, and a working local Supabase runtime.

## Run

From `.migration-backup`, use an empty disposable directory:

```sh
python3 scripts/test-draft-conflicts-runner.py
python3 scripts/prepare-supabase-test-project.py /tmp/aspekindo-draft-conflicts
supabase --workdir /tmp/aspekindo-draft-conflicts start
export TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Pass only the disposable stack's keys directly to the child process.
# Do not print status JSON or use the application's hosted environment values.
supabase --workdir /tmp/aspekindo-draft-conflicts status -o json |
python3 -c '
import json, os, subprocess, sys
s = json.load(sys.stdin)
env = {**os.environ, "TEST_SUPABASE_URL": s["API_URL"],
       "TEST_SUPABASE_ANON_KEY": s["ANON_KEY"],
       "TEST_SUPABASE_SERVICE_ROLE_KEY": s["SERVICE_ROLE_KEY"]}
sys.exit(subprocess.call(
    ["python3", "scripts/test-assessment-draft-conflicts-http.py"], env=env))
'
supabase --workdir /tmp/aspekindo-draft-conflicts stop --no-backup
```

Do not run against shared development data. The runner accepts only
`127.0.0.1:54321` for HTTP and `postgres@127.0.0.1:54322/postgres` for SQL;
connection query overrides and fragments are forbidden. It ignores application
database settings, strips libpq overrides, disables HTTP proxies and redirects,
and never reads project credentials. Privileged access is only for fixtures,
schema prerequisites, and before/after assertions; attacks use the anon API key
and real user tokens. Generated users and the fixture domain are removed even
after an assertion failure. A missing migration or unavailable Auth service is a
failure, never a skipped/passing security test.

The staging helper includes every repository migration, grouping legacy duplicate
timestamps only in the disposable copy. The HTTP runner verifies the complete
migration ledger and active draft RLS/grants. Existing seed questions remain
intact; a valid four-per-domain roster accommodates the later question-authority
migration.

## Assertions

- Two separate Auth sessions for the same owner read revision zero.
- A successful save returns the full draft and increments its revision once.
- A stale revision returns HTTP 200 with `saved:false` and the current server
  snapshot; no row or timestamp changes. Explicit resolution can save revision
  two and becomes visible in both owner sessions.
- Two owner requests released together with the same revision have exactly one
  winner. The loser receives that winner's snapshot.
- A legacy request without `revision` gets an actual HTTP 400 / `P0001`, not a
  success body an old bundle might ignore, and does not mutate stored state.
- Another member and a real admin cannot read the owner's draft through the
  active-draft RPC or overwrite it through save, including the conflict path.
- Direct table SELECT/INSERT/UPDATE/DELETE is denied to owner, stranger, admin,
  and anonymous callers. The unversioned internal start RPC is not executable.
- Anonymous callers cannot invoke public draft RPCs.
- After real assessment completion and after a server-side expired deadline,
  both owner sessions are denied for current and stale revisions with unchanged
  privileged state.

The existing isolated SQL suite remains a fast unit-level check. This suite
does not test LMS quizzes, assessment result visibility, or browser conflict UI.
CI runs the HTTP suite after starting the fully migrated local stack in
`.github/workflows/assessment-concurrency.yml`.

## Runtime failures are not passing test results

If the local container runtime reports `OCI runtime exec failed` during database
health checks, Auth and PostgREST may never start. Retrying
`supabase start --ignore-health-check` against a partially running stack can exit
zero with only a database URL and all API services stopped. Neither outcome
verifies this suite. Use a functioning disposable local Supabase runtime (such
as the CI Ubuntu runner); do not substitute hosted data or the minimal SQL suite.
