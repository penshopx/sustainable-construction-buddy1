# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### Active multi-artifact workspace versus this archive

This directory is the archived single-app project. Its `npm run release`
command and `.replit` build hook below describe that legacy path, not the
active workspace's deployment command.

The active root `.replit` uses `deployment.router = "application"`. Production
builds and serving commands are defined per service in
`artifacts/*/.replit-artifact/artifact.toml`; no root `deployment.build` is
required. In particular, PUB ASPEKINDO builds to static files and the API server
has its own build and Node run command. Do not add the archived release command
to the root configuration merely to satisfy a single-app test.

The archived tests are still used: `.github/workflows/insight-validation.yml`
runs `npm run test:insight:validate` from this directory. That validator runs
both contract and publication-gate tests. The publication suite checks the
legacy guarded release chain **and** the active workspace service manifests,
including rejected configurations with missing builds or API run commands.
The same workflow separately typechecks and builds the active frontend.
None of those checks publishes the Edge Function: publisher subprocess tests
use a fake npm executable, and `--check-config` must start no subprocess.
The active artifact builds do not invoke this archive's Edge Function publisher;
passing CI or a manifest check is not evidence that the function was deployed.

### Archived single-app release

Use the guarded release command so the production application and the
`competency-insight` Edge Function are released together:

```sh
npm run release
```

Set `SUPABASE_PROJECT_REF` in the production release environment to the
expected Supabase project reference, independently of `supabase/config.toml`.
The publisher refuses to deploy if the release ref is missing, invalid, or
different from the TOML `project_id`. Do not derive this release setting from
the TOML file.

Set `SUPABASE_URL` independently to `https://<SUPABASE_PROJECT_REF>.supabase.co`
(one trailing slash is allowed). Both publication and the standalone live probe
reject any other destination before making requests. Credentials, query strings,
fragments, ports, and additional paths are not accepted in this URL. The probe
also requires the expected `SUPABASE_PROJECT_REF`; it never infers it from the URL.

The release owner must confirm the production destination and authorize setting
`SUPABASE_PROJECT_REF` in the **production** environment. This environment
setting is managed independently of the Supabase TOML file; development/shared
values are not substituted by the publisher. Changing the production destination
requires a fresh owner confirmation. Configuration approval is not approval to
publish.

To validate the configuration without publishing, run this in the release
environment (where `SUPABASE_PROJECT_REF` is already set):

```sh
npm run check:release-config
```

This uses the same ref checks as the publisher, but does not run Supabase CLI,
deploy, or the live probe. A successful result says `deployment: "not_started"`;
it is not proof of a production publication. Wrong, invalid, or missing refs
still return a non-zero exit status. Unknown CLI flags are rejected rather than
falling through to deployment. Configuration checks require no production
credentials; automated publication-gate tests use isolated synthetic credentials.

### Verification evidence and limits

The latest configuration inspection read only the non-secret
`SUPABASE_PROJECT_REF` through the environment-management interface, filtered
to the `production` environment. It returned `yidlglstzvizsszrpobi`, matching
the owner-approved destination, `.replit`'s production setting, and
`supabase/config.toml`'s `project_id`. No environment settings were changed.

The publisher's `--check-config` path reads and compares the refs, then reports
`deployment: "not_started"` and `liveProbe: "not_run"`. It does not invoke the
deployment or live-probe paths, and does not validate `SUPABASE_URL`.

A local attempt to run `npm run check:release-config` with a clean environment
containing only `PATH` and the production ref failed before configuration
validation: `@iarna/toml` is not installed for this backup project. This attempt
does not renew the earlier successful local check, and is not a release-runtime
check. No dependencies were installed and no credentials were read.

Deployment metadata reports an active Autoscale deployment with a successful
build. That metadata does not establish which ref the running application uses.
This inspection was performed in the assigned task's workspace copy; a branch
named `main` does not establish access to the main project's post-merge state.
No execution interface into the existing release environment was available.
Consequently, post-merge verification on the main project and execution of the
configuration check inside the release environment remain **unverified**.
No publication, live probe, or production data access was performed.

To close those evidence gaps after merging, repeat the filtered production
variable read on the main project and run only `npm run check:release-config`
from this directory in an independently available release environment with its
existing dependencies. Record the actual execution context and result; do not
substitute a local run or deployment metadata for release-runtime evidence, and
do not publish merely to perform this check.

The release runs the standard insight validator, TypeScript check, and
frontend build, then invokes `npm run publish:insight`. The standard validator
covers the local contract tests and publication gate. That publisher deploys
the Edge Function and runs the live contract probe. A validation, deployment,
or probe failure returns a non-zero status and blocks the release; failure
summaries are sanitized JSON retained in the release log. Do not deploy
`competency-insight` directly with the Supabase CLI.

## Quality checks

Run the standard competency insight validation before releasing. It runs both
the insight contract checks and the deterministic publication gate; either
failure stops the validation with a non-zero status:

```sh
npm run test:insight:validate
```

`npm run validate:insight` remains available as a compatibility alias. Run the
full TypeScript check independently when checking the frontend:

```sh
npm run typecheck
```

`npm run build` runs this check automatically before Vite creates the production bundle.

Every pull request runs the same standard validation in
`.github/workflows/insight-validation.yml`. The workflow's source-of-truth
command is `npm run test:insight:validate`; because that command includes both
the insight contract checks and the deterministic publication gate, either
failure makes the pull request check fail.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
