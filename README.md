# zeroclaw-setup

Set up local ZeroClaw to use GonkaGate in one `npx` command.

```bash
npx zeroclaw-setup
```

![Package](https://img.shields.io/badge/package-zeroclaw--setup-6E63FF?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D22.14.0-4DA2FF?style=flat-square)
![ZeroClaw](https://img.shields.io/badge/ZeroClaw-v0.6.9-35D6FF?style=flat-square)
![License](https://img.shields.io/badge/license-Apache--2.0-2A2A2A?style=flat-square)

[![Website](https://img.shields.io/badge/Website-gonkagate.com-111827?style=flat-square)](https://gonkagate.com/en?utm_source=github&utm_medium=referral&utm_campaign=zeroclaw_setup&utm_content=readme_badge_website)
[![Docs](https://img.shields.io/badge/Docs-API%20Guides-2563EB?style=flat-square)](https://gonkagate.com/en/docs?utm_source=github&utm_medium=referral&utm_campaign=zeroclaw_setup&utm_content=readme_badge_docs)
[![API%20Key](https://img.shields.io/badge/API%20Key-Dashboard-F97316?style=flat-square)](https://gonkagate.com/en/register?utm_source=github&utm_medium=referral&utm_campaign=zeroclaw_setup&utm_content=readme_badge_api_key)
[![Telegram](https://img.shields.io/badge/Telegram-%40gonkagate-229ED9?style=flat-square&logo=telegram&logoColor=white)](https://t.me/gonkagate)
[![X](https://img.shields.io/badge/X-%40gonkagate-000000?style=flat-square&logo=x&logoColor=white)](https://x.com/gonkagate)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-GonkaGate-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/gonkagate)

## Overview

Onboarding-first ZeroClaw utility for configuring GonkaGate as the primary
custom provider.

The repository is still intentionally narrow: it owns only the GonkaGate
provider contract, delegates persistence to ZeroClaw-native seams, and stays
on the audited stable ZeroClaw `v0.6.9` config contract.

Follow-up verification command:

```bash
npx zeroclaw-setup verify
```

Current status:

- repository infrastructure is ready for active development and publishing
- install now performs real Phase 2 mutation work on audited ZeroClaw
  `v0.6.9`
- first-run setup uses a proven two-step native path:
  `zeroclaw onboard --quick --provider custom:https://api.gonkagate.com/v1 --model <curated-model-id>`
  followed by the hidden native `zeroclaw props set api-key` prompt
- first-run mutation stays intentionally limited to that hidden native prompt
  path; stdin-fed secret transport remains blocked because it is not part of
  the shipped proof on audited `v0.6.9`
- existing-config updates use a split native write seam:
  `default-provider` and `default-model` go through
  `zeroclaw props set --no-interactive`, while `api-key` stays on the hidden
  native `zeroclaw props set api-key` path
- after hidden GonkaGate key entry, install calls
  `GET https://api.gonkagate.com/v1/models`, validates the response shape, and
  requires every in-repo curated model to be present before any model prompt or
  ZeroClaw config mutation
- live catalog entries outside the curated registry are never exposed as
  selectable models
- install refuses mutation when the runtime is active or ambiguous, when the
  config contains unknown top-level keys, or when the installed ZeroClaw
  runtime is missing, unparseable, or older than `v0.6.9`
- `verify` now performs the shipped Phase 3 read-only verdict flow: minimum
  version gating, active config resolution, saved-config
  contract checks, runtime summary through `zeroclaw status`, and advisory
  `zeroclaw doctor` output
- `verify` returns explicit `pass`, `warn-shadowed`, and `fail` results, with
  the exact warning `saved config is correct but inactive` when env overrides
  shadow an otherwise-correct saved GonkaGate contract

## Quick Start

```bash
npm install
npm run ci
npm run dev -- --help
```

Development entrypoints:

- `npm run dev`
- `npm run dev -- verify`
- `npm run build`
- `npm run lint`
- `npm test`
- `npm run ci`

## What Is Already Set Up

- TypeScript ESM project structure with separate typecheck and build configs
- ESLint + Prettier wired into local scripts and CI
- packaged CLI binary at `zeroclaw-setup`
- GitHub Actions for CI, release-please, and npm publish
- release metadata files aligned with sibling `*-setup` repositories
- mirrored `.agents` and `.claude` skill packs copied from `opencode-setup`
- starter docs under `docs/`
- node:test coverage for version gating, config resolution, first-run proof,
  native write sequencing, restore boundaries, model catalog, docs, and
  package metadata

## Repository Layout

```text
bin/                    packaged CLI entrypoint
docs/                   docs, security notes, implementation plan, specs mirror
scripts/                repository utility scripts
src/constants/          fixed provider and model registry data
src/install/            install and verify runtime seams
test/                   fast node:test coverage for install, verify, and repo contracts
.agents/skills/         mirrored local skill pack for agent workflows
.claude/skills/         mirrored local skill pack for Claude-compatible workflows
```

## Product Contract Seeded In Code

The code hard-codes the GonkaGate contract from the PRD:

- provider base URL: `https://api.gonkagate.com/v1`
- provider key: `custom:https://api.gonkagate.com/v1`
- managed config fields:
  - `default_provider`
  - `api_key`
  - `default_model`
- shipped first-run path:
  - `zeroclaw onboard --quick --provider custom:https://api.gonkagate.com/v1 --model <curated-model-id>`
  - hidden native `zeroclaw props set api-key`
  - first-run mutation stays blocked when the API key would need stdin or
    another unproven transport
- shipped existing-config path:
  - `zeroclaw props set --no-interactive default-provider custom:https://api.gonkagate.com/v1`
  - `zeroclaw props set --no-interactive default-model <curated-model-id>`
  - hidden native `zeroclaw props set api-key`
  - runtime-quiesced sequencing with non-secret restore after pre-secret and
    post-secret failures
  - explicit secret remediation because stable native read-back does not expose
    the prior `api-key`
  - saved-config confirmation uses `api_key` set/unset evidence only; literal
    secret read-back is not part of the wrapper contract
- chosen v1 verify shadowing behavior:
  - explicit `saved config is correct but inactive` warning when env overrides
    mask the saved GonkaGate contract
- shipped verify evidence split:
  - `zeroclaw status` informs the effective runtime verdict
  - `zeroclaw doctor` remains advisory troubleshooting context
- curated model catalog:
  - `qwen3-235b` -> `qwen/qwen3-235b-a22b-instruct-2507-fp8`
  - `kimi-k2.6` -> `moonshotai/Kimi-K2.6` (recommended default)
  - `minimax-m2.7` -> `minimaxai/minimax-m2.7`
- live model catalog gate:
  - endpoint: `GET https://api.gonkagate.com/v1/models`
  - auth: `Authorization: Bearer <gp-...>`
  - response trust boundary: root object with a `data` array of objects whose
    `id` fields are non-empty strings
  - install requires all curated model IDs to be present before model
    selection or native writes
  - arbitrary live entries are ignored unless they are also in the curated
    registry
- public install flag surface:
  - optional `--model <curated-key>`
- env override checks:
  - `ZEROCLAW_PROVIDER`
  - `ZEROCLAW_MODEL_PROVIDER`
  - `MODEL_PROVIDER`
  - `PROVIDER`
  - `ZEROCLAW_MODEL`
  - `MODEL`
  - `ZEROCLAW_API_KEY`
  - `API_KEY`
- ZeroClaw runtime gate:
  - minimum supported version: audited stable ZeroClaw `v0.6.9`
  - newer versions are not blocked solely because they are newer

## CLI Status

The package exposes these public commands:

```bash
npx zeroclaw-setup
npx zeroclaw-setup verify
```

Current shipped behavior:

- `npx zeroclaw-setup` performs real Phase 2 install mutation when the
  installed ZeroClaw runtime is at least audited `v0.6.9` and read-only gating
  passes
- install asks for a hidden GonkaGate API key after the chosen mutation path is
  known and the runtime quiesce gate has passed, checks the live
  `GET /v1/models` catalog, then prompts for a curated model when `--model` is
  omitted
- the wrapper-collected key is used for the live catalog check; public native
  storage paths still let ZeroClaw collect the persisted `api-key` through
  `zeroclaw props set api-key`, so first-run stdin secret persistence remains
  blocked
- first-run install is shipped only when ZeroClaw can collect the secret
  through its hidden native `zeroclaw props set api-key` prompt
- install does not place the GonkaGate API key on argv in the shipped happy
  path
- `npx zeroclaw-setup verify` now performs shipped read-only verification,
  including final `pass` / `warn-shadowed` / `fail` verdicts
- verify and saved-config confirmation use `api_key` set/unset evidence only;
  they do not claim literal saved secret read-back

## Docs

- [docs/README.md](docs/README.md) current-truth documentation index
- [docs/how-it-works.md](docs/how-it-works.md)
- [docs/implementation-plan.md](docs/implementation-plan.md) historical
  execution record
- [docs/prd-task-breakdown.md](docs/prd-task-breakdown.md) historical planning
  checklist
- [docs/security.md](docs/security.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)
- [docs/specs/zeroclaw-setup-prd/spec.md](docs/specs/zeroclaw-setup-prd/spec.md)

## Release Flow

The repository follows the same release automation pattern as neighboring
GonkaGate CLI utilities:

1. `CI` runs on push and pull request
2. `Release Please` opens and updates release PRs from conventional commits
3. tags dispatch `Publish (npm)` with OIDC-based provenance publishing

## License

Apache-2.0
