# PRD Task Breakdown (Historical Planning Document)

This document captures the original scaffold-to-runtime plan for
`zeroclaw-setup`. It intentionally preserves the planning-time checklist,
including scaffold-era wording and unchecked boxes, and should not be read as
the current shipped contract. Use `PRD.md`, `README.md`, `AGENTS.md`, and
`docs/README.md` for current repository truth.

## Overview

This document turns the current `PRD.md` into an ordered implementation task
list for `zeroclaw-setup`.

At planning time it was intentionally scoped to this repository truth:

- install and verify were still scaffold flows
- the runtime target was audited stable ZeroClaw `v0.6.9` only
- the wrapper had to stay thin and ZeroClaw-native rather than growing a custom
  TOML mutation layer

The goal was to move from scaffolded development seams to a truthful v1 runtime
without violating the product and security invariants already pinned in
`PRD.md`, `AGENTS.md`, and the existing docs.

## Architecture Decisions

- Keep the wrapper thin: delegate config loading, saving, secret persistence,
  and per-save atomic behavior to ZeroClaw-native seams whenever possible.
- Split first-run proof from existing-config mutation so one path can remain
  scaffolded if its proof fails without blocking the other.
- Treat mutating work as gated by read-only proof: version support, config
  shape, config resolution, and runtime-quiesce checks must succeed before any
  write runs.
- Keep `verify` read-only and drive its verdict from saved config plus runtime
  evidence, with `zeroclaw doctor` surfaced as advisory context only.
- Prefer vertical slices that land code, tests, and truthful UX together over
  horizontal "all docs first, all code later" work.

## Repository Truth To Preserve

- The public package and entrypoints stay:
  `npx zeroclaw-setup` and `npx zeroclaw-setup verify`.
- The managed config surface stays limited to `default_provider`, `api_key`,
  and `default_model`.
- The fixed provider key stays
  `custom:https://api.gonkagate.com/v1`.
- The wrapper stays on the explicit custom-provider shape and does not regress
  toward native `openai` or prerelease `providers.*` assumptions.
- API key entry stays interactive and hidden in the default UX.
- The default install UX asks only for the hidden API key and curated model,
  not custom provider type, custom base URL, custom model ID, or config path.
- The wrapper must not write shell profiles, shell env exports, or `.env`
  files.
- The wrapper must not write `api_url`, workspace marker files directly, or
  unrelated security, autonomy, or observability settings.
- The mutating path must refuse unknown top-level keys or other unaudited
  config shapes rather than claiming universal config preservation.
- The verify warning text for env-shadowed saved config stays:
  `saved config is correct but inactive`.
- The v1 curated catalog stays intentionally narrow:
  `qwen3-235b` -> `qwen/qwen3-235b-a22b-instruct-2507-fp8`, with
  `--model <curated-key>` limited to curated keys only.
- The default verify path stays local and read-only; automatic online probing
  and `verify --online` remain future, opt-in scope rather than v1 default
  work.
- Compatibility stays explicitly limited to audited stable ZeroClaw `v0.6.9`
  until another upstream audit lands.

## Task List

### Phase 1: Read-Only Foundations

- [ ] Task 1: Add a shared ZeroClaw command gateway and stable-target version
      gate.
- [ ] Task 2: Implement active config resolution and read-only saved-config
      inspection.
- [ ] Task 3: Add audited-config preflight and unsupported-shape refusal.

### Checkpoint: Foundation

- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] Disposable fixtures cover missing CLI, unsupported version, default
      config resolution, workspace-root layout, and legacy workspace layout.
- [ ] The repository still describes install and verify as scaffolds until
      mutating proof lands.

## Task 1: Add a Shared ZeroClaw Command Gateway and Stable-Target Version Gate

**Description:** Create a reusable execution seam for ZeroClaw CLI calls and
introduce explicit support-state classification around the audited stable target
`v0.6.9`. This gives install and verify one trustworthy way to detect missing
CLI availability, supported stable runtime, unaudited `v0.6.x` variants, and
unsupported `v0.7+` / Config V2 targets before deeper logic branches.

**Acceptance criteria:**

- [ ] A shared command layer can execute ZeroClaw read-only commands and return
      stdout, stderr, exit status, and parsed version metadata.
- [ ] Install and verify can distinguish at least these states:
      missing command, supported `v0.6.9`, unaudited other `v0.6.x`, and
      unsupported `v0.7+`.
- [ ] User-facing messaging stays truthful and does not claim compatibility
      beyond the audited target.

**Verification:**

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual check: simulate missing and unsupported `zeroclaw` versions and
      confirm the surfaced state matches the exact runtime condition.

**Dependencies:** None

**Files likely touched:**

- `src/install/zeroclaw-command.ts`
- `src/install/contracts.ts`
- `src/install/install-use-case.ts`
- `src/install/verify-use-case.ts`
- `test/cli-contract.test.ts`

**Estimated scope:** Medium: 3-5 files

## Task 2: Implement Active Config Resolution and Read-Only Saved-Config Inspection

**Description:** Add the read-only plumbing that resolves the active config path
the same way stable ZeroClaw does, including `ZEROCLAW_CONFIG_DIR`,
`ZEROCLAW_WORKSPACE` branching, the persisted active-workspace marker, and the
default legacy location. Build saved-config inspection on top of that seam so
verify can report the actual active config and workspace without mutating
anything.

**Acceptance criteria:**

- [ ] Resolution follows the PRD order:
      `ZEROCLAW_CONFIG_DIR`, then `ZEROCLAW_WORKSPACE` with ZeroClaw's
      workspace-root vs legacy branching logic, then the active workspace
      marker, then `~/.zeroclaw/config.toml`.
- [ ] The read-only inspector reports resolved config path, resolved workspace
      path, managed-field presence, and secret-field set/unset evidence without
      exposing literal secret values.
- [ ] The wrapper does not introduce a second config-path source of truth that
      conflicts with the audited ZeroClaw behavior.

**Verification:**

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual check: verify output shows the resolved config and workspace paths
      for default, workspace-root, and legacy-layout fixtures.

**Dependencies:** Task 1

**Files likely touched:**

- `src/install/contracts.ts`
- `src/install/verify-use-case.ts`
- `src/install/zeroclaw-command.ts`
- `src/install/config-resolution.ts`
- `test/config-resolution.test.ts`

**Estimated scope:** Medium: 3-5 files

## Task 3: Add Audited-Config Preflight and Unsupported-Shape Refusal

**Description:** Introduce a read-only preflight that classifies whether the
resolved config is safe for v1 mutation. This step should explicitly refuse
unknown top-level keys, unsupported upstream config shapes, and unaudited
version contracts before any install path attempts a write.

**Acceptance criteria:**

- [ ] Preflight distinguishes audited stable `v0.6.9` top-level shapes from
      unknown keys, unsupported layouts, and unaudited `v0.7+` contracts.
- [ ] Mutating flows can stop before any write when preflight marks the config
      as unsupported.
- [ ] Refusal messaging directs the user toward native/manual remediation
      instead of claiming preservation the wrapper cannot prove.

**Verification:**

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual check: an unsupported config shape fails before any provider field
      write is attempted.

**Dependencies:** Task 1, Task 2

**Files likely touched:**

- `src/install/contracts.ts`
- `src/install/install-use-case.ts`
- `src/install/verify-use-case.ts`
- `src/install/config-preflight.ts`
- `test/config-preflight.test.ts`

**Estimated scope:** Medium: 3-5 files

### Phase 2: Install Mutation Proof and Wiring

- [ ] Task 4: Prove the first-run native seam in disposable workspaces.
- [ ] Task 5: Implement the split native write adapter with runtime-quiesce and
      restore boundaries.
- [ ] Task 6: Wire install UX to the gated first-run and existing-config paths.

### Checkpoint: Install Path

- [ ] `npm run ci` passes.
- [ ] Disposable workspace checks confirm that no API key value appears on argv
      in the default install path.
- [ ] Existing-config rehearsal covers success, pre-secret failure restore, and
      post-secret failure remediation messaging.
- [ ] If first-run proof is still incomplete, the code keeps that path
      scaffolded instead of quietly broadening the UX or weakening secret
      handling.

## Task 4: Prove the First-Run Native Seam in Disposable Workspaces

**Description:** Build the bounded proof for first-run setup that the PRD
requires. The proof must show whether stable ZeroClaw `v0.6.9` exposes a
non-destructive native seam that can initialize config plus GonkaGate provider
state without forcing the full interactive `zeroclaw onboard` wizard and
without placing the secret on argv.

**Acceptance criteria:**

- [ ] The team has a disposable-workspace proof for a first-run command
      sequence that preserves the GonkaGate one-command UX or a documented
      proof that the path must remain scaffolded.
- [ ] The proof records exact command behavior, input shape, and failure
      boundaries against stable `v0.6.9`.
- [ ] The implementation path keeps first-run mutation disabled if the proof
      does not meet the hidden-secret and narrow-UX requirements.
- [ ] The candidate path does not broaden the happy path into provider type,
      base URL, custom model ID, or config-path prompts.

**Verification:**

- [ ] `npm test`
- [ ] Manual check: run the candidate first-run sequence in an isolated
      workspace and confirm the secret never appears on argv.
- [ ] Manual check: confirm the fallback is still scaffolded if the candidate
      seam fails the proof.

**Dependencies:** Task 1, Task 2, Task 3

**Files likely touched:**

- `src/install/install-use-case.ts`
- `src/install/zeroclaw-command.ts`
- `docs/implementation-plan.md`
- `test/install-first-run-proof.test.ts`
- `test/fixtures/`

**Estimated scope:** Medium: 3-5 files

## Task 5: Implement the Split Native Write Adapter With Runtime-Quiesce and Restore Boundaries

**Description:** Build the existing-config mutation seam the PRD calls for:
targeted non-secret writes through
`zeroclaw props set --no-interactive`, hidden secret input through
`zeroclaw props set api-key`, runtime-quiesced sequencing, automatic restore of
prior non-secret fields on pre-secret failure, and explicit secret-remediation
guidance after post-secret failure.

**Acceptance criteria:**

- [ ] `default-provider` and `default-model` use stable native non-interactive
      writes, while `api-key` uses a hidden native secret-input path.
- [ ] The write sequence snapshots and restores prior `default-provider` and
      `default-model` when failure occurs before the secret step.
- [ ] Failures after the secret step restore prior non-secret state and surface
      explicit secret-remediation guidance instead of claiming the prior secret
      was restored.
- [ ] The mutating path refuses or quiesces live ZeroClaw runtime processes
      before writing managed fields.
- [ ] The mutation path delegates persistence, secret encryption, and per-save
      atomic replace / transient rollback behavior to ZeroClaw-native seams
      instead of introducing a TOML text mutator, a `zeroclaw config` write
      path, or direct writes to `api_url` or workspace marker files.
- [ ] Existing-config remediation keeps the native interactive provider-only
      update mode as a fallback option, but that fallback is not used as the
      default first-run path.

**Verification:**

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual check: force a mid-sequence failure before the secret step and
      confirm non-secret restore behavior.
- [ ] Manual check: force a mid-sequence failure after the secret step and
      confirm remediation guidance is explicit.

**Dependencies:** Task 1, Task 2, Task 3

**Files likely touched:**

- `src/install/install-use-case.ts`
- `src/install/zeroclaw-command.ts`
- `src/install/native-write.ts`
- `src/install/runtime-quiesce.ts`
- `test/install-write-seam.test.ts`

**Estimated scope:** Medium: 3-5 files

## Task 6: Wire Install UX to the Gated First-Run and Existing-Config Paths

**Description:** Replace the current scaffold-only install behavior with a
truthful runtime flow that chooses between the proven first-run path, the
existing-config split-write path, or an explicit blocked/scaffolded outcome. It
must preserve the hidden API-key prompt, the curated model picker, and the
reserved `--model <curated-key>` surface without opening arbitrary provider or
model input.

**Acceptance criteria:**

- [ ] The default install flow remains interactive for hidden API-key entry and
      curated model selection when `--model` is omitted.
- [ ] `--model <curated-key>` accepts only curated keys from the in-repo
      registry and fails clearly for unsupported input.
- [ ] Install output distinguishes successful mutation, blocked mutation, and
      scaffold fallback without overstating shipped functionality.
- [ ] Env override warnings are surfaced during install without mutating shell
      env, shell profiles, or `.env` files.
- [ ] The default install flow does not ask for custom provider type, custom
      base URL, custom model ID, or config path unless a proven native ZeroClaw
      seam forces that interaction.

**Verification:**

- [ ] `npm run ci`
- [ ] Manual check: default install prompts for the API key interactively and
      never echoes the secret.
- [ ] Manual check: unsupported `--model` input fails before any write runs.

**Dependencies:** Task 4, Task 5

**Files likely touched:**

- `src/cli.ts`
- `src/install/contracts.ts`
- `src/install/install-use-case.ts`
- `src/install/prompts.ts`
- `test/cli-contract.test.ts`

**Estimated scope:** Medium: 3-5 files

### Phase 3: Verify Flow and Verdict Semantics

- [ ] Task 7: Implement saved-config contract checks and env-shadow
      classification.
- [ ] Task 8: Add runtime evidence integration and final verify rendering.

### Checkpoint: Verify Path

- [ ] `npm run ci` passes.
- [ ] Verify covers `pass`, `warn-shadowed`, and `fail` scenarios.
- [ ] Verify output shows resolved config and workspace paths and never prints a
      raw API key.
- [ ] `zeroclaw doctor` remains advisory and cannot independently flip a valid
      GonkaGate contract from pass to fail.

## Task 7: Implement Saved-Config Contract Checks and Env-Shadow Classification

**Description:** Build the core verify logic that reads the resolved saved
config, checks the managed GonkaGate contract, and classifies provider-related
env override states into the exact result semantics required by the PRD.

**Acceptance criteria:**

- [ ] Verify confirms saved `default_provider`, saved `default_model`, and
      saved `api_key` presence against the curated GonkaGate contract.
- [ ] Provider, model-provider, model, and API-key env overrides are
      classified into `pass`, `warn-shadowed`, and `fail` with the required
      warning text `saved config is correct but inactive`.
- [ ] Secret fields are treated as set/unset evidence only and never rendered
      as literal saved values.
- [ ] Env-shadow classification respects stable precedence nuances, including
      `ZEROCLAW_PROVIDER` winning when non-empty and legacy `PROVIDER` not being
      treated as equivalent to `ZEROCLAW_PROVIDER`.

**Verification:**

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual check: env-shadowed fixtures produce `warn-shadowed` instead of a
      clean pass or a generic hard failure.

**Dependencies:** Task 1, Task 2, Task 3

**Files likely touched:**

- `src/install/environment-overrides.ts`
- `src/install/verify-use-case.ts`
- `src/install/contracts.ts`
- `test/environment-overrides.test.ts`
- `test/verify-contract.test.ts`

**Estimated scope:** Medium: 3-5 files

## Task 8: Add Runtime Evidence Integration and Final Verify Rendering

**Description:** Finish the verify experience by combining saved-config checks
with runtime evidence from ZeroClaw-native read-only commands. The final output
must show resolved config context, summarize runtime state from
`zeroclaw status`, and surface `zeroclaw doctor` as advisory troubleshooting
context rather than the primary contract verdict.

**Acceptance criteria:**

- [ ] `zeroclaw status` is used as the primary native runtime summary for the
      verify verdict.
- [ ] `zeroclaw doctor` output is included only as advisory troubleshooting
      context.
- [ ] Verify reports resolved config path, workspace path, support-state
      version gating, and final verdict in one read-only run.
- [ ] Verify does not rely on `zeroclaw doctor models` or
      `zeroclaw models refresh` in the default path, and treats
      `zeroclaw models status` as optional cache/context evidence only.

**Verification:**

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual check: verify output for supported, unsupported, and missing-CLI
      scenarios stays explicit and read-only.

**Dependencies:** Task 7

**Files likely touched:**

- `src/install/verify-use-case.ts`
- `src/install/zeroclaw-command.ts`
- `src/install/contracts.ts`
- `src/cli.ts`
- `test/verify-rendering.test.ts`

**Estimated scope:** Medium: 3-5 files

### Phase 4: Proof Hardening and Truthful Release Readiness

- [ ] Task 9: Expand automated proof coverage for install and verify.
- [ ] Task 10: Update public docs, contributor docs, and release notes to match
      shipped behavior.

### Checkpoint: Complete

- [ ] All acceptance criteria above are met.
- [ ] `npm run ci` passes.
- [ ] Disposable workspace fixtures do not touch a real user ZeroClaw config.
- [ ] Docs, CLI behavior, and tests describe the same shipped truth.
- [ ] Ready for human review before release enablement.

## Task 9: Expand Automated Proof Coverage for Install and Verify

**Description:** Convert the PRD's bounded proof requirements into regression
coverage so the repository can keep evolving without losing the stable-target
guarantees. The tests should pin config preservation boundaries, version
support, env-shadow behavior, first-run gating, and failure remediation.

**Acceptance criteria:**

- [ ] Automated coverage proves known-schema config preservation, unknown-key
      refusal, version gating, runtime-quiesce handling, env-shadowed verify,
      and secret set/unset inspection behavior.
- [ ] Automated coverage pins preservation of known stable sections such as
      `channels`, `memory`, `hooks`, `tunnel`, `workspace`, `reliability`,
      `model_routes`, and `embedding_routes`.
- [ ] Disposable fixtures isolate writes from the developer's real ZeroClaw
      directories and workspaces.
- [ ] The test suite keeps CLI contract, curated model contract, and docs
      contract checks aligned with the new runtime behavior.
- [ ] Regression coverage proves that secrets stay off argv, persist through
      ZeroClaw-native encrypted save paths, and do not cause the wrapper to
      over-claim literal secret read-back.

**Verification:**

- [ ] `npm test`
- [ ] `npm run ci`
- [ ] Manual check: run the suite on a machine without a real `zeroclaw`
      installation and confirm fixture-based tests still behave deterministically.

**Dependencies:** Task 6, Task 8

**Files likely touched:**

- `test/`
- `scripts/run-tests.mjs`
- `src/install/`
- `README.md`
- `docs/`

**Estimated scope:** Large: 5+ files

## Task 10: Update Public Docs, Contributor Docs, and Release Notes to Match Shipped Behavior

**Description:** Once runtime behavior is proven and enabled, reconcile all
public and contributor-facing documents so they describe the same truth as the
code. This includes making partial enablement explicit if first-run and
existing-config support land on different timelines.

**Acceptance criteria:**

- [ ] `README.md`, `AGENTS.md`, `docs/how-it-works.md`,
      `docs/security.md`, `docs/troubleshooting.md`, and `CHANGELOG.md` match
      the shipped install and verify behavior.
- [ ] Docs do not describe scaffold-only or blocked paths as fully shipped.
- [ ] The audited ZeroClaw target, env-shadow warning behavior, secret-handling
      limits, and unsupported-shape refusal are all stated consistently.
- [ ] Docs do not claim durable `.bak` backup history, comment preservation, or
      literal saved API-key revalidation unless those properties are explicitly
      proven.
- [ ] Docs keep v1 non-goals explicit, including no arbitrary base URLs, no
      arbitrary model IDs, no project-local scope, and no default online health
      probe.

**Verification:**

- [ ] `npm test`
- [ ] `npm run ci`
- [ ] Manual check: a new contributor can read the repo docs and describe the
      actual shipped capabilities without guessing.

**Dependencies:** Task 6, Task 8, Task 9

**Files likely touched:**

- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `docs/how-it-works.md`
- `docs/security.md`

**Estimated scope:** Large: 5+ files

## Risks and Mitigations

| Risk                                              | Impact | Mitigation                                                                                             |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| First-run native seam fails proof                 | High   | Keep first-run mutation scaffolded and ship only the proven existing-config or verify slices.          |
| Runtime-quiesce detection is unreliable           | High   | Prefer explicit refusal over risky best-effort background mutation.                                    |
| Upstream ZeroClaw contract drifts beyond `v0.6.9` | High   | Gate by version and refuse unaudited `v0.6.x` / `v0.7+` targets until re-audited.                      |
| Secret-input flow regresses into argv transport   | High   | Keep secret entry interactive or stdin-like only and add regression checks around argv exposure.       |
| Config resolution diverges from ZeroClaw behavior | Medium | Pin fixtures for default, workspace-root, and legacy layouts and keep resolution logic source-audited. |
| Docs over-claim partially shipped behavior        | Medium | Make doc reconciliation a release-blocking task with `npm run ci` in the final checkpoint.             |

## Resolved Planning Decisions

- First-run sequencing is no longer treated as an open product question. The
  architectural decision is to allow only a two-phase native shape for the
  default first-run path:
  1. initialize config/workspace state through the narrowest stable ZeroClaw
     native seam that avoids the full broad onboarding wizard
  2. set `default-provider` and `default-model` through stable native
     non-secret seams
  3. persist `api-key` only through a hidden native secret-input seam such as
     `zeroclaw props set api-key`
  4. finish with read-only inspection or verify-style confirmation
     If no stable `v0.6.9` command sequence satisfies that shape, first-run
     mutation remains scaffolded. The exact command tuple is therefore an
     implementation proof artifact, not a remaining product-design decision.

- Runtime quiesce is resolved as a refusal-oriented gate, not a best-effort
  guess. For v1, "quiesced" means both of the following are true:
  1. native/runtime inspection does not show an active ZeroClaw runtime bound
     to the resolved config or workspace, where such inspection is available
  2. local process inspection does not find candidate ZeroClaw runtime
     processes for the current user
     If either signal is positive or ambiguous, the wrapper refuses mutation
     instead of proceeding optimistically. That gives us a cross-platform safety
     rule without pretending process detection is perfectly authoritative.

- Partial enablement is resolved in favor of shipping proven safe slices before
  the full v1 happy path is complete. If existing-config mutation and verify are
  proven before first-run mutation, the repository may enable that narrower
  existing-user path while keeping first-run mutation scaffolded or blocked.
  However, that state should be documented as an incremental `0.x` capability,
  not as completion of the final onboarding-first v1 promise for new users.
