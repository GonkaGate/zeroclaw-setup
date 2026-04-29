# PRD: `zeroclaw-setup`

Status: Draft
Last updated: April 17, 2026
Language: English

## Summary

`zeroclaw-setup` is an onboarding-first utility whose job is to make GonkaGate the easiest supported custom-provider setup path for local ZeroClaw.

The product should exist, but it should not be a direct clone of `openclaw-setup`. For the current stable ZeroClaw release line (`v0.6.9` as of April 17, 2026), the safest v1 shape is a thin wrapper around ZeroClaw's own onboarding and property/config machinery, with a very small GonkaGate-managed contract and a separate read-only verification command.

## Product Decision

Recommendation: `yes with caveats`

Recommended product shape: standalone GonkaGate package, implemented as a thin ZeroClaw-aware wrapper

Stable target gate: this PRD is intentionally scoped to audited stable
ZeroClaw `v0.6.9` (the current stable tag as of April 17, 2026).

Broader `v0.6.x` compatibility should not be claimed until the relevant write
and verify seams are re-audited against those exact tags.

It does not claim compatibility with prerelease `v0.7.0-beta.*` Config V2.
If the installed ZeroClaw binary is on `v0.7+` or another unaudited config
contract, install and verify should hard-warn or fail until this PRD is
re-audited.

Primary public command:

```bash
npx zeroclaw-setup
```

Read-only verification command:

```bash
npx zeroclaw-setup verify
```

## Problem

Today, a ZeroClaw user who wants to use GonkaGate as their primary cloud model backend has to understand ZeroClaw provider selection, custom endpoint syntax, active workspace/config resolution, and how to update provider settings without damaging existing channels, memory, tunnel, hooks, or other custom configuration.

That is too much product knowledge for the happy path.

We want one short, safe, onboarding-first command that configures GonkaGate with minimal choices and no manual editing of `config.toml`, while cooperating with ZeroClaw's preferred setup model instead of fighting it.

## Why This Product Should Exist

The opportunity is real because:

- ZeroClaw explicitly supports custom OpenAI-compatible endpoints through `custom:https://...`.
- ZeroClaw already has provider-only update behavior for existing configs in interactive onboarding.
- GonkaGate still benefits from a narrower, opinionated setup flow than ZeroClaw's general-purpose onboarding.

The caveat is also real because:

- ZeroClaw already owns onboarding, config persistence, secret encryption,
  per-save atomic save semantics, transient rollback attempts, and workspace
  selection.
- Reimplementing those behaviors in a separate wrapper would add unnecessary drift and risk.
- Stable docs, stable CLI, and newer prerelease workstreams are not perfectly aligned today on some config details, so our wrapper must pin a release target and stay conservative and explicit.

## Product Goals

- Make GonkaGate the easiest supported custom-provider path for ZeroClaw.
- Reduce setup to one short public command.
- Ask for as few user decisions as possible.
- Keep API key entry interactive and hidden.
- Preserve unrelated existing user configuration.
- Avoid manual config editing.
- Avoid shell profile mutation and `.env`-driven setup.
- Respect ZeroClaw's preferred onboarding model.
- Provide a separate read-only verification path.

## Non-Goals

- Building a generic ZeroClaw provider configurator
- Supporting arbitrary custom base URLs in the public GonkaGate flow
- Supporting free-form model input in v1
- Replacing `zeroclaw onboard` as ZeroClaw's general setup path
- Rewriting channel, memory, hook, tunnel, or workspace setup
- Owning ZeroClaw installation
- Managing shell environment variables or startup files
- Supporting project-local scope in v1

## Target User

A developer who already has local ZeroClaw, wants to use GonkaGate as the primary provider, and does not want to manually edit `~/.zeroclaw/config.toml` or reason about ZeroClaw provider semantics.

## User Stories

1. As a new ZeroClaw user, I can run one command, enter my GonkaGate API key, choose a curated model, and end up with a working GonkaGate-backed ZeroClaw setup.
2. As an existing ZeroClaw user, I can switch only the AI provider settings to GonkaGate without losing channels, tunnel, memory, hooks, or other unrelated settings.
3. As a cautious user, I can run a separate read-only verify command later to confirm that the active config still points at GonkaGate and that ZeroClaw is loading it.

## Recommended UX

### Install Flow

Public entrypoint:

```bash
npx zeroclaw-setup
```

Happy-path prompts in v1:

- hidden prompt for a GonkaGate API key
- curated model picker

Things the user should not be asked:

- custom provider type
- custom base URL
- custom model ID
- config path
- workspace path, unless ZeroClaw itself requires that as part of its normal onboarding

The wrapper should not send the default v1 path through the full interactive
`zeroclaw onboard` wizard, because that flow asks broader setup questions about
workspace, channels, tunnel, memory, and other surfaces outside the GonkaGate
happy path.

### Verify Flow

Public follow-up command:

```bash
npx zeroclaw-setup verify
```

This command must be read-only.

## Core Product Positioning

This product is not "ZeroClaw onboarding rewritten in Node."

It is "the easiest GonkaGate setup path for ZeroClaw users, built on top of ZeroClaw's native setup and config model."

## v1 Product Contract

### Fixed GonkaGate Decisions

- GonkaGate base URL is fixed to `https://api.gonkagate.com/v1`
- provider choice is fixed by product design
- model choice comes only from a code-owned curated registry
- API key entry remains interactive and hidden
- the wrapper writes ZeroClaw config, not shell env and not shell rc files

### Recommended Provider Shape

Use an explicit custom provider:

```toml
default_provider = "custom:https://api.gonkagate.com/v1"
api_key = "..."
default_model = "..."
```

Why this is the right default:

- it matches ZeroClaw's current stable documented custom-provider contract
- it matches ZeroClaw's current stable onboarding, status, doctor, and props behavior
- it avoids pretending GonkaGate is a native OpenAI account
- it keeps the GonkaGate flow aligned with ZeroClaw's provider model

### Provider Shapes We Should Avoid In v1

- native `openai`
- beta-only `providers.fallback` / `providers.models` assumptions until they ship in a stable ZeroClaw release we explicitly target
- a GonkaGate-specific named provider profile not already represented in ZeroClaw's public provider model

## Active Config Resolution

The wrapper should not invent an independent config-path source of truth.

When the wrapper must inspect or verify the active ZeroClaw config directly, it should follow current ZeroClaw source-level runtime behavior rather than docs shorthand:

1. `ZEROCLAW_CONFIG_DIR`
2. `ZEROCLAW_WORKSPACE`, resolved through ZeroClaw's actual workspace-path
   mapping logic:
   - use `<workspace>/config.toml` when that workspace-root config already
     exists
   - fall back to legacy `~/.zeroclaw/config.toml` when an existing legacy
     layout is detected for that workspace path
   - otherwise treat the workspace path as the config dir and use a nested
     `workspace/`
3. persisted active workspace marker
4. default `~/.zeroclaw/config.toml`

The wrapper should surface the resolved config path and workspace path during
verify so users can understand which config is actually active.

Precedence alone is not enough for correctness here. If the wrapper mirrors
ZeroClaw locally instead of delegating resolution to ZeroClaw itself, it should
mirror the exact `ZEROCLAW_WORKSPACE` branching logic rather than assuming one
fixed path shape.

## Managed Config Surface

The wrapper should own only this narrow surface:

- `default_provider`
- `api_key`
- `default_model`

The wrapper should preserve:

- known stable `v0.6.9` sections such as:
  - `channels`
  - `memory`
  - `hooks`
  - `tunnel`
  - `workspace`
  - `reliability`
  - `model_routes`
  - `embedding_routes`
  - other unrelated keys already represented in the audited stable schema

Because stable `v0.6.9` saves still deserialize into ZeroClaw's known config
schema and then rewrite TOML, the wrapper should not claim preservation for
unknown or unaudited top-level keys. If read-only preflight detects unknown
top-level keys or another unsupported config shape, the mutating path should
refuse and direct the user to native/manual remediation instead of risking
silent key loss.

The wrapper should avoid writing in v1:

- `api_url`
- unrelated security, autonomy, or observability settings
- workspace marker files directly unless ZeroClaw itself performs that operation

## Model Strategy

v1 model selection should be curated, not free-form.

Rules:

- the picker should expose only GonkaGate-supported models
- v1 should ship exact curated entries:
  - `qwen3-235b` -> `qwen/qwen3-235b-a22b-instruct-2507-fp8`
  - `kimi-k2.6` -> `moonshotai/Kimi-K2.6`
- `kimi-k2.6` is the recommended default
- optional `--model <curated-key>` should be part of v1, but only for curated
  keys
- when `--model` is omitted, install should keep the interactive curated picker
- adding more curated entries later requires explicit docs, test, and
  release-note updates
- arbitrary model IDs should not be part of the public happy path

## Implementation Strategy

Recommended strategy: hybrid

### What We Should Delegate To ZeroClaw

- first-run workspace/config initialization through the chosen stable native seam
- native config loading
- native config saving
- secret encryption behavior
- native atomic replace / transient rollback behavior for each config save
- active workspace marker persistence

### What The Wrapper Should Own

- GonkaGate-specific prompts
- curated model registry
- the GonkaGate managed config contract
- environment-override checks relevant to GonkaGate correctness
- the public install and verify UX

### Safe Technical Shape

For first-run setup:

- use a stable non-destructive ZeroClaw seam that preserves the GonkaGate
  one-command UX
- do not route the default v1 flow through the full interactive
  `zeroclaw onboard` wizard
- do not use `zeroclaw onboard --api-key <KEY>` as the default wrapper path in
  v1, because it places the secret on argv and violates the hidden-entry
  contract
- preferred first-run proof target is a two-phase native flow that avoids
  secret-on-argv:
  - initialize config plus non-secret provider/model state through a stable
    native seam
  - persist `api_key` through a hidden native secret-input seam such as
    `zeroclaw props set api-key`, if disposable-workspace proof shows the
    wrapper can orchestrate it without wider UX drift
- if no stable first-run path can satisfy both hidden secret entry and the
  narrow GonkaGate UX, v1 should remain scaffolded for first-run mutation
  rather than silently relaxing the secrecy guarantee

For existing-config updates:

- stable `zeroclaw props set --no-interactive` is acceptable for the non-secret
  GonkaGate fields when using the actual stable prop paths
- use targeted scripted updates for:
  - `default-provider` for config key `default_provider`
  - `default-model` for config key `default_model`
- do not pass `api_key` through argv-based
  `zeroclaw props set --no-interactive`; that breaks the hidden-entry contract
- preferred stable candidate for the secret field is a hidden native
  secret-input path such as `zeroclaw props set api-key`
- because stable `v0.6.9` does not expose an atomic multi-field update seam,
  treat the three managed fields as a runtime-quiesced best-effort ordered
  write:
  - only mutate while ZeroClaw runtime processes are stopped or otherwise
    quiesced, because stable channel runtime reloads can hot-apply
    `default_provider`, `default_model`, and `api_key`
  - snapshot the current `default_provider` and `default_model` state through
    read-only native inspection
  - treat `api_key` snapshotting as set/unset evidence only unless a stronger
    native seam is proven; do not claim native read-back of the prior secret
    value
  - on any failed step before the secret write, attempt automatic restore of
    the prior non-secret state
  - on any failed step after the secret write, restore the prior non-secret
    state and surface explicit secret-remediation guidance instead of claiming
    the previous `api_key` was automatically restored
- keep interactive `zeroclaw onboard` provider-only update mode as a native
  fallback for existing-config remediation, not as a first-run seam
- do not use a destructive full overwrite path

For writes:

- do not implement a naive TOML text mutator in v1
- do not bypass ZeroClaw's secret-encrypting save path unless we are forced to and can prove parity
- preserve ZeroClaw's native atomic temp-file replace and transient rollback
  behavior for each individual save
- do not describe temporary `.bak` rollback files as a durable user backup
  strategy
- do not claim comment preservation on stable `v0.6.9` unless we verify it against that exact release

## Verification Scope

Separate verification is viable and worthwhile.

### `verify` Should Check

- ZeroClaw is installed and callable
- the active config/workspace path resolved by ZeroClaw
- GonkaGate-managed provider fields are present and correct
- the saved provider is `custom:https://api.gonkagate.com/v1`
- the saved model is from the curated registry
- the saved API key field is present, acknowledging that stable ZeroClaw CLI exposes secret fields as set/unset status rather than raw values
- risky environment overrides are absent or surfaced clearly
- `zeroclaw status` reports the expected active runtime config and
  provider/model summary
- `zeroclaw doctor` output is surfaced as advisory troubleshooting signal only,
  not as the primary source of the verify verdict

### `verify` Result Semantics

v1 should distinguish between:

- `pass`: saved GonkaGate contract is correct and no provider-related env override is shadowing it
- `warn-shadowed`: saved GonkaGate contract is correct, but active runtime is being shadowed by env overrides
- `fail`: required saved contract fields are missing or incorrect, ZeroClaw cannot be inspected, or the active config cannot be resolved safely

The `warn-shadowed` state should be phrased explicitly as:

`saved config is correct but inactive`

Why this is the right default:

- provider env overrides can be intentional, so the user needs diagnosis rather than a generic hard failure
- the command is read-only and should explain both saved state and active runtime state in one run
- this avoids a misleading clean pass while still preserving useful troubleshooting signal

The verify verdict should be driven by the resolved saved config plus effective
runtime evidence, with `zeroclaw status` as the primary native runtime summary.
`zeroclaw doctor` should contribute troubleshooting notes and local health
context, but it should not independently flip a GonkaGate contract check from
`pass` to `fail` unless the wrapper explicitly ties a specific doctor finding
to a required GonkaGate invariant.

### `verify` Should Not Do By Default

- mutate config
- rerun onboarding
- rely on `zeroclaw doctor models` or `zeroclaw models refresh` as a default
  check, because those paths are online or mutation-prone rather than a stable
  local verify contract for v1
- treat `zeroclaw models status` as optional cache/context evidence only rather
  than authoritative runtime-health proof

### Optional Future Extension

An explicit opt-in online check could be added later, for example:

```bash
npx zeroclaw-setup verify --online
```

That mode could perform a GonkaGate-authenticated network probe, but it should not be required for the default local verify path.

## Environment Override Policy

The wrapper must treat provider-related env overrides as a real correctness risk.

Relevant overrides include:

- `ZEROCLAW_PROVIDER`
- `ZEROCLAW_MODEL_PROVIDER`
- `MODEL_PROVIDER`
- `PROVIDER`
- `ZEROCLAW_MODEL`
- `MODEL`
- `ZEROCLAW_API_KEY`
- `API_KEY`

Expected v1 behavior:

- detect them during install and verify
- warn during install that they may shadow or alter the effective GonkaGate
  runtime contract
- during verify, emit an explicit `warn-shadowed` result rather than collapsing the situation into a generic failure
- explain that the saved config may be valid while the active runtime is still using env overrides instead
- do not report a clean pass while shadowing is present

Important stable nuance:

- `ZEROCLAW_PROVIDER` wins when non-empty
- `ZEROCLAW_MODEL_PROVIDER` / `MODEL_PROVIDER` are also provider-shaping
  overrides
- legacy `PROVIDER` is not equivalent to `ZEROCLAW_PROVIDER`; on stable
  `v0.6.9`, it is only honored when the saved config still uses the default
  provider path rather than an explicit non-default provider such as
  `custom:https://api.gonkagate.com/v1`
- `ZEROCLAW_MODEL` / `MODEL` can change the active model even when the saved
  GonkaGate config is otherwise correct

## Safety Requirements

- no shell profile mutation
- no `.env` writing
- no recommendation to export credentials as the primary setup path
- no destructive overwrite of existing config for provider-only updates
- no loss of channels, tunnel, memory, hooks, or other unrelated sections
- no claims of verification that depend on ambiguous or non-stable upstream output without explicit caveats

## Key Upstream Realities This PRD Must Respect

- ZeroClaw's preferred setup flow is `zeroclaw onboard`
- current stable ZeroClaw (`v0.6.9`) still exposes custom-provider config through top-level `default_provider`, `default_model`, and `api_key`
- stable scripted property mutation lives under `zeroclaw props`, while
  `zeroclaw config` is still schema export in `v0.6.9`
- the `zeroclaw props` CLI is part of the audited `v0.6.9` contract and
  should not be assumed to exist across the whole earlier `v0.6.x` line
- stable `zeroclaw props` paths are kebab-case, so the relevant scripted paths
  are `default-provider`, `api-key`, and `default-model`
- secret fields are masked when using interactive `zeroclaw props set <path>`,
  while `zeroclaw props set --no-interactive <path> <value>` requires the value
  on argv
- existing `config.toml` already has an interactive provider-only update mode
- ZeroClaw uses TOML, not JSON or JSON5
- current runtime config resolution is driven by ZeroClaw, not by this wrapper
- ZeroClaw stable save paths already handle secret encryption and per-save
  atomic replace / transient rollback, but not a durable user-facing backup
  history for ordinary updates
- stable `zeroclaw models status` exists in `v0.6.9`, but it reports current
  model configuration and cache status rather than authoritative provider
  health
- comment preservation should not be treated as a stable `v0.6.9` guarantee unless we verify it explicitly

## Main Risks And Blockers

### 1. First-Run Seam Proof

The product contract requires a one-command GonkaGate-first UX, while stable
ZeroClaw's full interactive onboarding wizard asks broader setup questions.

The first-run implementation therefore needs bounded proof for a stable native
seam that preserves the narrow GonkaGate UX. The preferred candidate is the
non-argv two-phase flow, but it must be proven against the GonkaGate custom
provider contract before we treat it as the default runtime path.

If that candidate fails the proof, v1 should fall back to native
config-initialization plus a hidden native secret-write path instead of routing
users through the full interactive wizard or pushing secrets onto argv.

### 2. Existing-Config Write Proof

The v1 write seam decision is now made: existing-config updates should use
stable native seams, but not a single argv-based command path, for the
GonkaGate-managed three-field contract.

The remaining blocker is implementation proof rather than product ambiguity. We
still need disposable-workspace evidence that:

- repeated targeted updates preserve known stable unrelated config sections
- the mutating path refuses configs with unknown top-level keys or other
  unaudited shapes instead of claiming full preservation it cannot prove
- the wrapper refuses or quiesces live ZeroClaw runtime processes before
  running the split write path, so hot-applied intermediate states do not leak
  into a running daemon or channel process
- `api_key` stays off argv and remains encrypted through ZeroClaw's native save
  path
- a mid-sequence failure before the secret step restores the prior non-secret
  state
- a mid-sequence failure after the secret step surfaces explicit secret
  remediation instead of pretending the prior secret was restored

v1 should not silently fall back to full overwrite behavior if that proof fails.

### 3. Docs/Code Drift Upstream

Stable ZeroClaw `v0.6.9` public docs and stable source are centered on top-level `default_provider`, `default_model`, and `api_key`, while newer prerelease release notes point toward a future Config V2 and `providers.*` migration.

The wrapper should explicitly pin the current stable release line it targets and treat `providers.*` as a prerelease watchlist until that contract stabilizes.

### 4. Config Resolution Ambiguity

Workspace/config resolution depends on ZeroClaw's own runtime behavior and
markers. Public docs often summarize this more simply than current source does,
and current source includes `ZEROCLAW_CONFIG_DIR` ahead of
`ZEROCLAW_WORKSPACE`. In addition, `ZEROCLAW_WORKSPACE` is not a simple
one-path override: it branches between workspace-root and legacy config layouts
depending on what already exists. The wrapper should not invent an independent
source of truth unless absolutely necessary.

### 5. Env Override Shadowing

A valid saved GonkaGate config may not be the active runtime config when env
overrides are set. The wrapper must detect this and message it clearly, and it
must not treat `ZEROCLAW_PROVIDER`, `ZEROCLAW_MODEL_PROVIDER`,
`MODEL_PROVIDER`, `PROVIDER`, `ZEROCLAW_MODEL`, and `MODEL` as equivalent.

### 6. Secret Handling

ZeroClaw encrypts secrets by default when saving config. Any wrapper-owned write
path that bypasses native save semantics, or that chooses argv transport for
secret convenience, risks violating the product's hidden-entry contract even if
the saved file ends up encrypted at rest.

### 7. Verify Evidence Limits

Stable ZeroClaw property tooling exposes encrypted secrets as set/unset status rather than raw values. That means a local read-only `verify` command can confirm presence of the configured API key field, but should not claim it has revalidated the literal saved key value or prefix unless a future upstream seam makes that possible.

### 8. Dynamic Provider Keys

Custom providers use dynamic keys like `custom:https://api.gonkagate.com/v1`. This makes generic property-setting flows more awkward than static config paths and increases the chance of brittle implementation if we try to fake it.

## Success Criteria

A v1 launch is successful when:

- a new user can reach GonkaGate-backed ZeroClaw with one public command
- the happy path asks only for API key and curated model
- existing users can switch provider settings without losing unrelated config
- the product has a separate read-only verify command
- the wrapper's docs stay truthful to the actual managed config contract

## Out Of Scope For v1

- arbitrary custom provider setup
- arbitrary model entry
- model routing setup beyond the primary selected model
- migration of existing OpenAI or OpenRouter routes into GonkaGate-specific routing
- project-local scope
- dashboard integration
- automatic online health probing by default

## Minimal Prototype Plan

1. Prove first-run setup in a temporary ZeroClaw workspace using the GonkaGate custom-provider contract.
2. Prove a split native write seam for existing-config updates that keeps `api_key` off argv while preserving unrelated sections.
3. Implement a local read-only `verify` command with `pass`, `warn-shadowed`, and `fail` result states.
4. Add fixture coverage for env-override shadowing, existing-config preservation, and invalid/unsupported upstream states.

## Resolved v1 Decisions

1. `default-provider` and `default-model` may use stable `zeroclaw props set --no-interactive`, but `api-key` must not be passed through argv-based `--no-interactive`; it requires a hidden native secret-input seam such as `zeroclaw props set api-key`.
2. Existing-config updates must run as a runtime-quiesced best-effort ordered write. Stable `v0.6.9` does not expose an atomic multi-field provider update seam, and stable native secret reads do not expose the prior `api_key` value, so automatic restore is limited to the non-secret fields.
3. `verify` should not hard-fail generically on provider env overrides. It should report an explicit `warn-shadowed` state with the message `saved config is correct but inactive`.
4. The exact v1 curated model list contains `qwen3-235b` ->
   `qwen/qwen3-235b-a22b-instruct-2507-fp8` and `kimi-k2.6` ->
   `moonshotai/Kimi-K2.6`, with `kimi-k2.6` kept as the recommended
   default.
5. v1 should support optional `--model <curated-key>` while keeping the default install UX interactive when the flag is omitted.

## Bounded Implementation Proof

Before the scaffold becomes a mutating installer, implementation should prove
all of the following in disposable ZeroClaw workspaces:

1. sequential non-secret updates through `zeroclaw props set --no-interactive` preserve known stable unrelated config sections such as channels, memory, hooks, tunnel, and routing tables
2. `api_key` can be persisted through a hidden native secret-input seam such as `zeroclaw props set api-key` without argv exposure, and read-only inspection still exposes only set/unset evidence
3. forced mid-sequence failures restore the prior non-secret state and surface explicit secret-remediation guidance when the prior `api_key` cannot be recovered from stable native seams
4. the split write path refuses or quiesces live ZeroClaw runtime processes before mutating config, so hot-applied intermediate states do not leak into a running daemon or channel process
5. the mutating path detects unknown top-level config keys and refuses mutation rather than assuming stable `v0.6.9` saves will preserve them
6. first-run setup uses a stable native seam that preserves the GonkaGate one-command UX without forcing the full interactive `zeroclaw onboard` wizard and without passing the secret on argv
7. verify can resolve the active config path using stable source-level precedence and `ZEROCLAW_WORKSPACE` layout branching, classify env-shadowed runtime state without mutating anything, and keep `zeroclaw doctor` output advisory rather than verdict-defining

## Compatibility Gate

This document is intentionally valid only for audited stable ZeroClaw `v0.6.9`.

Prerelease `v0.7.0-beta.*` and later Config V2 releases are a watchlist, not a
supported runtime target for this v1 plan. Until a fresh audit lands, install
and verify should hard-warn or fail on that newer contract rather than pretend
compatibility.

## Readiness Decision

`conditional-pass`

The stable-target v1 plan is acceptable for ZeroClaw `v0.6.9`, but readiness
is conditional rather than unconditional. The remaining work is not general
product discovery, but two bounded proofs still matter before claiming runtime
readiness:

1. first-run setup must stay on a stable native seam without violating the
   GonkaGate one-command UX
2. scripted three-field writes, unknown-key refusal, runtime-quiesce handling,
   and read-only verify must be proven against the exact stable `v0.6.9`
   contract

The installer should still avoid direct TOML mutation, and it should not claim
compatibility with `v0.7.0-beta.*` or later config-v2 contracts until they are
re-audited.
