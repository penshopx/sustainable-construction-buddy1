# LMS quiz HTTP authority

`scripts/test-lms-quiz-authority-http.py` complements the role-level SQL test
`aspekindo_lms_quiz_authority.sql`. It runs in `assessment-concurrency.yml`
after all repository migrations are applied to a disposable local Supabase.

Run from `.migration-backup`, with local Supabase already started:

```sh
export TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Use ONLY the keys reported by `supabase --workdir <disposable-project> status`.
# Set TEST_SUPABASE_URL=http://127.0.0.1:54321,
# TEST_SUPABASE_ANON_KEY and TEST_SUPABASE_SERVICE_ROLE_KEY from that output.
python3 scripts/test-lms-quiz-authority-http.py
```

The shared local-only transport rejects hosted URLs, connection query overrides,
redirects and environment proxies before sending credentials. It does not read
application database URLs or application secrets. The service key is used only
to create/delete disposable Auth users; all tested REST/RPC requests use real
owner/stranger password sessions, or only the local anon API key with no user
Authorization header.

Coverage:

- Real Auth sessions with distinct identities; anonymous RPC execution denied.
- An unenrolled stranger cannot submit or complete the owner's lesson.
- Extra forged score fields and invalid choices are rejected without writes.
- Server-weighted scores (30 fail / 70 pass), saved choices and correctness
  match the HTTP result; failure cannot unlock lesson completion.
- The owner can read their actual results/answers; stranger and anon cannot.
- Attempts/answers cannot be inserted, patched or deleted directly; completed
  progress cannot be manufactured by inserting or patching a real in-progress row.
- Answer keys/explanations remain private, including embedded PostgREST reads;
  published question text/options are readable by the enrolled owner.
- A passing quiz unlocks completion with the correct owner/enrollment/lesson.

Every rejected write is checked against complete privileged database snapshots,
not just an RLS-filtered view or an HTTP status. Fixtures are run-specific and
cleaned up even after assertions fail. Existing schema, seed data, RLS policies,
grants and triggers are not replaced or disabled. This is not the separate
concurrent-quiz-submission test.
