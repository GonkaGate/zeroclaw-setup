# Repo Context Routing

Use this file to choose only the repository context that materially changes the
generated context handoff prompt.

Do not dump the whole repo summary into the output. Pull only the relevant
points.

## Always-True Defaults

- The downstream agent already works inside this repository.
- Do not explain how to inspect files, edit code, create folders, or run
  ordinary repo commands.
- `zeroclaw-setup` is currently a TypeScript/Node scaffold for configuring
  local ZeroClaw to use GonkaGate.
- Canonical surfaces today are `PRD.md`, `README.md`, `AGENTS.md`, `src/cli.ts`,
  `src/install/`, `src/constants/`, `docs/`, `test/package-contract.test.ts`,
  `test/docs-contract.test.ts`, `test/skills-contract.test.ts`,
  `scripts/run-tests.mjs`, `.github/workflows/`, `package.json`,
  `release-please-config.json`, `.claude/skills/`, and `.agents/skills/`.
- `README.md`, `AGENTS.md`, `PRD.md`, and the files under `docs/` are the main
  current contract surfaces for product and security behavior.
- Avoid generic tool instructions like "inspect the repo" unless the request
  explicitly needs them.

## Use Repo Constraints Selectively

Include a repository constraint only when it changes the task:

- the target public UX is `npx zeroclaw-setup`, and the current CLI is
  scaffolded rather than a shipped end-to-end installer
- follow-up verification UX is `npx zeroclaw-setup verify`
- planned config target is `~/.zeroclaw/config.toml`
- active config resolution is expected to involve `ZEROCLAW_CONFIG_DIR`,
  `ZEROCLAW_WORKSPACE`, persisted workspace markers, and the default home path
- the managed provider key is `custom:https://api.gonkagate.com/v1`
- the stable managed config surface is top-level `default_provider`, `api_key`,
  and `default_model`
- provider-related env overrides such as `ZEROCLAW_PROVIDER`,
  `ZEROCLAW_MODEL_PROVIDER`, `MODEL_PROVIDER`, `PROVIDER`,
  `ZEROCLAW_MODEL`, `MODEL`, `ZEROCLAW_API_KEY`, and `API_KEY` are
  correctness risks
- ZeroClaw-native onboarding and save semantics are preferred over hand-rolled
  TOML mutation
- stable scripted property mutation currently lives under `zeroclaw props`,
  while newer prerelease `providers.*` config-v2 work should be treated as a
  watchlist rather than the default target
- secrets should not go into repo-local files, shell profiles, or `.env`
- if public behavior changes, `README.md`, `AGENTS.md`, `docs/`, and
  `CHANGELOG.md` may need updates to stay truthful

## Routing By Task Signal

### CLI, Package, Release, Public UX

Use when the request mentions CLI flags, help output, package entrypoints,
release automation, publish flow, or user-facing onboarding.

Useful context:

- `src/cli.ts`
- `bin/zeroclaw-setup.js`
- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release-please.yml`
- `.github/workflows/publish.yml`
- `README.md`
- `CHANGELOG.md`

### Provider Architecture, Config Resolution, Secret Handling

Use when the request mentions `~/.zeroclaw/config.toml`,
`ZEROCLAW_CONFIG_DIR`, `ZEROCLAW_WORKSPACE`, `default_provider`,
`default_model`, `api_key`, `custom:https://api.gonkagate.com/v1`,
`ZEROCLAW_PROVIDER`, `ZEROCLAW_MODEL_PROVIDER`, `MODEL_PROVIDER`,
`PROVIDER`, `ZEROCLAW_MODEL`, `MODEL`, `ZEROCLAW_API_KEY`, `API_KEY`,
onboarding, or secret-handling boundaries.

Useful context:

- `PRD.md`
- `README.md`
- `AGENTS.md`
- `docs/how-it-works.md`
- `docs/security.md`
- `docs/troubleshooting.md`
- `docs/specs/zeroclaw-setup-prd/spec.md`
- `src/constants/gateway.ts`
- `src/install/managed-contract.ts`
- `src/install/environment-overrides.ts`
- `test/docs-contract.test.ts`

Relevant reminders:

- the runtime under `src/install/` is still scaffolded
- config and provider rules already live in docs, constants, and tests
- prompts should inspect existing scaffold seams before proposing new ones

### Docs, Product Messaging, Truthfulness

Use when the task is mainly about repository documentation, public flow
description, security wording, troubleshooting, changelog accuracy, or PRD
alignment.

Useful context:

- `PRD.md`
- `README.md`
- `AGENTS.md`
- `docs/how-it-works.md`
- `docs/security.md`
- `docs/troubleshooting.md`
- `docs/specs/zeroclaw-setup-prd/spec.md`
- `CHANGELOG.md`
- `src/cli.ts`

Relevant reminders:

- docs should distinguish scaffold behavior from future product intent
- product-surface changes are not just copy edits; they may imply architecture
  or implementation work

### Tests, Tooling, Contract Integrity

Use when the request mentions test coverage, repository contract checks, CI,
formatting, or package quality.

Useful context:

- `test/package-contract.test.ts`
- `test/docs-contract.test.ts`
- `test/skills-contract.test.ts`
- `scripts/run-tests.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- `.nvmrc`

Relevant reminders:

- repository tests protect scaffold truth and doc-contract expectations
- `npm run ci` is the primary local verification command

### Skills, Prompts, Agent Workflow

Use when the request is about local skills, prompt rewriting, agent
instructions, or repo-local workflow assets.

Useful context:

- `.claude/skills/`
- `.agents/skills/`
- the specific local skill folder touched by the request
- `test/skills-contract.test.ts` when the repo should enforce the new
  expectation

Relevant reminders:

- many skill assets are mirrored under both `.claude` and `.agents`
- prompt assets should stay aligned with the actual current repo state
- if a skill is repo-specific, examples and literals should point to ZeroClaw
  and current repo surfaces rather than stale OpenCode or Codex paths

## Output Discipline

When you include repo context in the final handoff prompt:

- prefer short bullets or short paragraphs
- name the most relevant docs or code areas first
- keep background only if it changes the downstream agent's first decisions
- avoid repeating repo facts unless they change the downstream agent's first
  decisions
