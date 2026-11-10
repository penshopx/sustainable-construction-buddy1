# Assessment question authority on full Supabase

`scripts/test-assessment-question-authority-http.py` tests the migration
`20261031100000_assessment_question_authority.sql` through real Auth password
sessions and PostgREST. It is separate from both the minimal PostgreSQL scorer
suite (`test-assessment-question-authority.sh`) and LMS quiz-authority tests.

## Run

Requires Python 3 (standard library only), `psql`, Supabase CLI and a functioning
local container runtime. From `.migration-backup`, stage a new disposable project:

```sh
python3 scripts/test-question-authority-runner.py
python3 scripts/prepare-supabase-test-project.py /tmp/aspekindo-roster
supabase --workdir /tmp/aspekindo-roster start
export TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Pass local keys directly to the child without printing credentials.
supabase --workdir /tmp/aspekindo-roster status -o json |
python3 -c '
import json, os, subprocess, sys
s = json.load(sys.stdin)
env = {**os.environ, "TEST_SUPABASE_URL": s["API_URL"],
       "TEST_SUPABASE_ANON_KEY": s["ANON_KEY"],
       "TEST_SUPABASE_SERVICE_ROLE_KEY": s["SERVICE_ROLE_KEY"]}
sys.exit(subprocess.call(
    ["python3", "scripts/test-assessment-question-authority-http.py"], env=env))
'
supabase --workdir /tmp/aspekindo-roster stop --no-backup
```

CI runs the suite in `.github/workflows/assessment-concurrency.yml` after every
repository migration is installed. Legacy timestamp collisions are grouped only
in the staging copy. A CI-only prerequisite commits the legacy `super_admin`
enum label before the original migration uses it (PostgreSQL forbids using a new
label in the transaction that added it). Original migration files and versions
are unchanged. The runner refuses an incomplete migration ledger, missing
RLS/ACL boundaries, hosted targets, URL overrides and absent local keys. It shares
the local-only transport with the draft-conflict suite (no proxies, redirects or
libpq environment overrides); application credentials are never used.

## Evidence required to pass

- Actual Auth-created accounts and successful public start/save/read RPCs.
  A successful PostgREST read first proves the roster column is in the schema
  cache and the authenticated owner can see the row.
- `authenticated` PATCH cannot replace or clear `authorized_question_ids`, even
  with a matching `total_questions`; direct INSERT cannot forge a new roster.
- Both internal scorers return HTTP 403 / SQLSTATE `42501`, including for valid
  answer arrays. Only the public submission RPC is executable.
- Additional known questions, additional duplicates, same-length duplicates,
  substitutions authorized only in another assessment, omissions, invented IDs,
  empty arrays, objects and null submissions are rejected with the exact
  `Invalid assessment questions` error. Repeat after deadline expiry.
- An actual second assessment authorizes the replacement question. Neither its
  owner nor the first owner can submit the other user's assessment. The public
  draft save cannot replace the original question list.
- After **every** denied request a privileged deterministic snapshot confirms
  complete result, profile, answer and draft rows are unchanged for both users,
  including timestamps and historical answers. This detects hidden inserts or
  deletions that RLS might conceal from the caller.
- After forged submissions are rejected, valid submission still completes using
  the saved answer and fixed denominator, not the deliberately incorrect client
  choices or their reversed ordering. Result, stored answers and profile agree.

Random fixture users (including their results/answers/drafts) and the random
question domain are removed on failure as well as success; seed data is preserved.
Privileged SQL is only for prerequisites, fixtures, expiry and state comparison.
No attack request uses the service-role key.

An unavailable Auth/gateway or failed container startup is a failed run, not a
skip or evidence that the security assertions passed. Use a functioning local
Supabase runtime such as CI Ubuntu; do not substitute hosted data or minimal SQL.

## Verification performed — 2026-11-01

All five HTTP tests passed against the Supabase PostgreSQL 17.11 image with
**all 92 repository migration files** installed using Supabase CLI 2.122.0
(91 distinct repository versions plus the CI-only enum prerequisite).
Real GoTrue 2.197.0 password sessions and PostgREST 16.5 handled the requests;
the Storage API 1.84.19 applied its actual provider schema migrations first.
The existing isolated scorer suite and the offline runner/staging checks also
passed. All eight HTTP draft-conflict tests passed on the same fully migrated
database after the compatibility and fixture-isolation corrections below.

The workspace runtime could start containers but could not execute Docker
health checks (`OCI runtime exec failed`). Standard `supabase start` therefore
did not produce a working gateway. For this verification only, the actual
Auth, Storage and PostgREST images were started directly without health checks,
against the CLI-created disposable Supabase database. A local HTTP pass-through
forwarded `/auth/v1/` and `/rest/v1/` unchanged to those services; it did not mock
responses, interpret tokens, or replace database functions/policies. Supabase CLI
`migration up --local` applied the staged migrations and populated the ledger.
This verifies the requested Auth/PostgREST/database boundary, not Kong gateway
configuration. CI retains the standard full Supabase startup and gateway path.

PostgREST 16 adds optional GRANT hints to some ACL errors. The assertions require
the exact HTTP status, SQLSTATE and denial message, not version-specific hints.
The preceding draft-conflict suite uses the same allowance and removes each
test's unfinished draft so completion checks cannot see a prior test's fixture.
