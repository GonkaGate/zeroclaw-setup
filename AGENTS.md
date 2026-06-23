# AGENTS.md

## What This Repository Is

`zeroclaw-setup` is the public open-source onboarding repository for
`zeroclaw-setup`.

Its purpose is to provide the easiest supported path for configuring local
ZeroClaw to use GonkaGate as the primary custom provider, without asking users
to hand-edit `config.toml`, export secrets through shell profiles, or reverse-
engineer ZeroClaw provider semantics by hand.

Recommended public commands:

```bash
npx zeroclaw-setup
npx zeroclaw-setup verify
```

Current honest state:

- repository infrastructure is set up and aligned with neighboring GonkaGate
  utility repos
- the public CLI exists and is buildable, testable, and publishable
- install now performs real Phase 2 mutation work on audited ZeroClaw
  `v0.6.9` through proven ZeroClaw-native seams
- newer parsed ZeroClaw versions are not blocked solely because they are newer
- `verify` now performs the shipped read-only Phase 3 verdict flow: minimum
  version gating, active config resolution,
  saved-config contract checks, runtime summary through `zeroclaw status`, and
  advisory `zeroclaw doctor` output
- install mutation now covers:
  - proven first-run setup through `zeroclaw onboard --quick` plus hidden
    native `zeroclaw props set api-key`
  - split existing-config writes through `zeroclaw props`
  - pre-write GonkaGate `GET /v1/models` validation with Bearer auth, response
    shape checks, and curated-model presence enforcement
  - refusal-oriented runtime-quiesce gating
  - non-secret restore and explicit post-secret remediation boundaries
- verify now returns final `pass`, `warn-shadowed`, and `fail` verdicts, while
  keeping `zeroclaw doctor` advisory-only
- Phase 4 proof hardening is landed:
  - first-run stays blocked when secret input would bypass the proven native
    masked prompt seam
  - regression coverage now pins audited-section preservation,
    runtime-quiesce refusal, and `api_key` set/unset-only inspection behavior

If the package behavior, implementation status, supported model registry, or
public command surface changes, this file must be updated immediately so it
stays truthful.

## Working Rules

- Prefix shell commands with `rtk`.
- Treat [RTK.md](RTK.md) as the repository-local source of truth for shell
  usage.
- Read [PRD.md](PRD.md) before making product-shape changes.
- Keep `AGENTS.md`, `README.md`, and `docs/` aligned with the actual code.
- Do not describe scaffolded behavior as shipped end-user functionality.

## Product Goal

The intended happy path is:

1. user runs `npx zeroclaw-setup`
2. installer validates local ZeroClaw availability
3. installer collects a hidden GonkaGate API key
4. installer verifies the live GonkaGate `/v1/models` catalog contains every
   curated in-repo model
5. installer offers a curated model picker
6. installer writes only the narrow ZeroClaw provider contract it owns
7. user later runs `npx zeroclaw-setup verify` for a read-only check

The repository is onboarding-first. It is not intended to become a generic
ZeroClaw provider configurator.

## Fixed Product Invariants

These are product-level decisions, not small refactors.

- the npm package is `zeroclaw-setup`
- the intended public entrypoint is `npx zeroclaw-setup`
- the follow-up verification command is `npx zeroclaw-setup verify`
- GonkaGate base URL is fixed to `https://api.gonkagate.com/v1`
- the ZeroClaw provider key is fixed to
  `custom:https://api.gonkagate.com/v1`
- model choice comes only from a curated in-repo registry
- install must require every curated model to be present in
  `GET https://api.gonkagate.com/v1/models` before model selection or mutation
- arbitrary live `/v1/models` entries must not become selectable unless they
  are also added to the curated in-repo registry
- API key entry must remain interactive and hidden in the main UX
- the wrapper should write ZeroClaw config, not shell env, shell rc files, or
  `.env` files
- the managed config surface is intentionally narrow:
  - `default_provider`
  - `api_key`
  - `default_model`
- existing-config updates in v1 should use a split native write seam instead of
  direct TOML mutation:
  - `default-provider` and `default-model` may use
    `zeroclaw props set --no-interactive`
  - `api-key` must use a hidden native secret-input seam such as
    `zeroclaw props set api-key`
  - the three-field update must run as a runtime-quiesced best-effort ordered
    write because stable `v0.6.9` does not expose an atomic provider update
    seam
  - automatic restore is limited to `default-provider` and `default-model`;
    stable native secret reads do not expose the prior `api-key` value
- mutating paths in v1 must refuse configs with unknown top-level keys or other
  unaudited shapes rather than claiming universal config preservation
- `verify` should surface env-shadowed saved config as an explicit
  `saved config is correct but inactive` warning rather than a clean pass
- `verify` verdicts should be driven by saved config plus effective runtime
  evidence; `zeroclaw doctor` is advisory troubleshooting context, not the
  primary contract verdict source
- install should stay interactive by default, but optional
  `--model <curated-key>` is part of the shipped public surface
- first-run mutation is shipped only when the API key can be collected through
  the hidden native `zeroclaw props set api-key` prompt; stdin-fed first-run
  secret transport remains blocked until explicitly re-proven
- provider-related environment overrides are correctness risks and must be
  surfaced:
  - `ZEROCLAW_PROVIDER`
  - `ZEROCLAW_MODEL_PROVIDER`
  - `MODEL_PROVIDER`
  - `PROVIDER`
  - `ZEROCLAW_MODEL`
  - `MODEL`
  - `ZEROCLAW_API_KEY`
  - `API_KEY`
- runtime support has a minimum version floor at audited ZeroClaw `v0.6.9`;
  newer parsed versions are allowed to reach the real install and verify checks
- arbitrary base URLs are out of scope for v1
- arbitrary free-form model IDs are out of scope for v1
- shell profile mutation is out of scope
- `.env` writing is out of scope

## Current Repository Truth

These are implementation facts today:

- `src/cli.ts` is the public runtime entrypoint
- `bin/zeroclaw-setup.js` is a thin wrapper over `dist/cli.js`
- the CLI now exposes a mutating install command plus a read-only `verify`
  command with shipped verdict semantics
- `src/install/install-use-case.ts` now chooses between the proven first-run
  path, the split native existing-config path, live catalog validation, and
  explicit blocked outcomes
- `src/install/verify-use-case.ts` now resolves the active config path,
  evaluates the saved GonkaGate contract, checks runtime evidence through
  `zeroclaw status`, classifies env shadowing, and renders advisory
  `zeroclaw doctor` output when ZeroClaw is available and not older than
  `v0.6.9`
- `src/install/deps.ts` now provides command, prompt, HTTP, stdin, runtime,
  and current-user process-inspection seams
- `src/install/config-resolution.ts` mirrors stable `v0.6.9` source-level
  config precedence including `ZEROCLAW_CONFIG_DIR`,
  `ZEROCLAW_WORKSPACE`, and `active_workspace.toml`
- `src/install/config-preflight.ts` pins the audited top-level `v0.6.9`
  allowlist, accepts the audited aliases `model_provider`, `model`, and
  `mcpServers`, and refuses unknown top-level keys before mutation
- `src/install/managed-contract.ts` defines the exact ZeroClaw contract the
  installer owns
- `src/install/first-run-proof.ts` records the shipped first-run proof:
  `zeroclaw onboard --quick --provider custom:https://api.gonkagate.com/v1 --model <curated-model-id>`
  followed by hidden native `zeroclaw props set api-key`, and first-run
  install remains blocked when secret input would bypass that native masked
  prompt path
- the shipped existing-config write path is a split native seam:
  - `default-provider` and `default-model` may use stable
    `zeroclaw props set --no-interactive`
  - `api-key` must use a hidden native secret-input seam such as
    `zeroclaw props set api-key`
  - the three-field contract runs behind a refusal-oriented runtime-quiesce
    gate
  - automatic restore is limited to the non-secret fields because stable
    `v0.6.9` does not expose the prior `api-key` value
- the shipped verify behavior for provider env shadowing is an explicit
  `saved config is correct but inactive` warning state
- the current managed contract is grounded in audited stable ZeroClaw `v0.6.9`,
  so it follows stable top-level provider fields rather than prerelease
  `providers.*` config-v2 work
- `src/install/environment-overrides.ts` already contains the runtime env
  shadowing checks
- the install and verify contract now treats saved `api_key` as set/unset
  evidence only; literal secret read-back is not part of the shipped proof
- `src/install/gonkagate-models.ts` owns the GonkaGate `/v1/models` trust
  boundary: canonical endpoint, Bearer auth, response-shape validation,
  503 retry handling, and the requirement that all curated models are live
- `src/constants/models.ts` contains the curated model registry
- `src/cli.ts` exposes optional `--model <key>` for curated model selection;
  when omitted, install remains interactive after the live catalog gate
- the current curated registry intentionally contains these GonkaGate-supported
  entries:
  - `qwen3-235b` -> `qwen/qwen3-235b-a22b-instruct-2507-fp8`
  - `kimi-k2.6` -> `moonshotai/Kimi-K2.6` (recommended default)
  - `minimax-m2.7` -> `minimaxai/minimax-m2.7`
- a mirrored skill pack imported from `opencode-setup` is present under
  `.agents/skills/` and `.claude/skills/`
- the repository already has CI, release-please, npm publish automation,
  TypeScript build config, ESLint, Prettier, and package validation

Important limitation:

- the repository now ships install mutation plus final read-only verify
  verdicts, but compatibility claims should stay tied to real setup and verify
  checks rather than exact-version allowlists

## What The Repo Does And Does Not Do

This repo currently does:

- define the intended product contract for ZeroClaw onboarding
- provide a real npm package skeleton and CLI binary
- mutate ZeroClaw config through proven native install seams when ZeroClaw is
  available and not older than audited `v0.6.9`
- validate the live GonkaGate `/v1/models` catalog before model selection and
  before any ZeroClaw config mutation
- provide a read-only verify verdict flow with real version gating, config
  resolution, saved-config inspection, env-shadow classification, runtime
  status checks, and advisory doctor output
- define fixed provider and model constants
- detect provider-related env overrides
- ship a mirrored local skill pack for future engineering work
- provide docs, tests, CI, release-please, and npm publish scaffolding

This repo currently does not do:

- support arbitrary custom provider URLs
- support arbitrary custom model ids

## Repository Structure

```text
.
├── AGENTS.md
├── PRD.md
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json
├── package-lock.json
├── eslint.config.mjs
├── tsconfig.json
├── tsconfig.build.json
├── .github/workflows/
├── .agents/skills/
├── .claude/skills/
├── bin/
│   └── zeroclaw-setup.js
├── docs/
│   ├── README.md
│   ├── how-it-works.md
│   ├── implementation-plan.md
│   ├── security.md
│   ├── troubleshooting.md
│   └── specs/
│       └── zeroclaw-setup-prd/spec.md
├── scripts/
│   └── run-tests.mjs
├── src/
│   ├── cli.ts
│   ├── constants/
│   │   ├── gateway.ts
│   │   └── models.ts
│   └── install/
│       ├── config-preflight.ts
│       ├── config-resolution.ts
│       ├── contracts.ts
│       ├── deps.ts
│       ├── environment-overrides.ts
│       ├── first-run-install.ts
│       ├── first-run-proof.ts
│       ├── gonkagate-models.ts
│       ├── install-render.ts
│       ├── install-use-case.ts
│       ├── managed-contract.ts
│       ├── native-write.ts
│       ├── prompts.ts
│       ├── runtime-quiesce.ts
│       ├── verify-use-case.ts
│       └── zeroclaw-command.ts
└── test/
    ├── install/
│   ├── config-preflight.test.ts
│   ├── config-resolution.test.ts
│   ├── first-run-proof.test.ts
│   ├── harness.ts
│   ├── install-write-seam.test.ts
│   └── zeroclaw-command.test.ts
    ├── docs-contract.test.ts
    ├── environment-overrides.test.ts
    ├── models.test.ts
    └── package-contract.test.ts
```

## Important Surfaces

### `PRD.md`

Primary product source of truth for the ZeroClaw wrapper shape.

### `README.md`

Primary public repository summary. Keep implementation status, supported
commands, and current limitations accurate.

### `docs/how-it-works.md`

Architecture note for the current shipped install and verify runtime.

### `docs/security.md`

Security posture and secret-handling expectations. If the auth flow or managed
config surface changes, update this file.

### `src/cli.ts`

Main public CLI entrypoint and command wiring.

### `src/constants/`

Fixed GonkaGate product constants. Changes here are high-sensitivity because
they affect public contract.

### `src/install/`

This directory now contains the shipped install and verify runtime: async
ZeroClaw command detection, source-level config resolution, native-prompt-only
first-run proof state, live GonkaGate catalog validation, runtime-quiesce
gating, split native write sequencing, saved-config inspection with set/unset
secret evidence, final verify verdict logic, and audited mutation-readiness
preflight.

### `.agents/skills/` and `.claude/skills/`

Mirrored skill pack imported from `opencode-setup` to give this repository the
same local engineering support baseline. Keep both trees aligned unless there
is an explicit reason to diverge.

### `test/`

Contract and regression tests for package metadata, docs truthfulness, curated
model registry, env override detection, fake-`zeroclaw` version gating,
config resolution, `/v1/models` catalog validation, runtime-quiesce refusal,
install mutation proof, and verify behavior.

## Change Discipline

When behavior changes:

- update `AGENTS.md`
- update `README.md`
- update relevant files under `docs/`
- update `CHANGELOG.md` when the change matters to users or contributors
- update or extend tests under `test/` when the repository contract changes
- keep mirrored `.agents` and `.claude` skill assets aligned when shared

When moving from scaffold behavior to real behavior:

- keep the public docs honest at every step
- add tests before claiming new end-user capability
- prefer narrow seams in `src/install/` over pushing business logic into
  `src/cli.ts`
- do not skip env override handling, backup strategy, or config-preservation
  concerns just to make the happy path work quickly

## Validation

Local validation baseline:

```bash
npm run ci
```

Useful narrower checks:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
```

## Release Automation

This repository follows the same release pattern as neighboring GonkaGate
utility repos:

- `CI` runs on pushes to `main` and on pull requests
- `Release Please` manages release PRs from conventional commits
- npm publishing is handled by the `publish.yml` workflow with OIDC provenance

If the goal is to ship a releasable change, use a conventional commit style
title such as `feat: ...` or `fix: ...`.

## Areas That Require Extra Caution

Pause and double-check if a change touches:

- secret handling
- managed ZeroClaw config fields
- env override behavior
- the curated model registry
- install or verify UX
- package name, bin name, or public `npx` flow

@RTK.md
