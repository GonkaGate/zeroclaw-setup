---
name: zeroclaw-compatibility-audit
description: "Read-only compatibility audit between `zeroclaw-setup` and the latest stable upstream ZeroClaw release plus official ZeroClaw docs. Use whenever the task is to decide whether this repository still matches current ZeroClaw config, onboarding, custom-provider, secret-handling, model, workspace, or CLI contracts, even if the user only asks 'is this still compatible?' or 'did ZeroClaw upstream change?'."
---

# ZeroClaw Compatibility Audit

## Purpose

Use this skill to answer one practical question:
is `zeroclaw-setup` still compatible with the current stable upstream ZeroClaw
contract or not?

This is a read-only compatibility gate. The job is to compare official
upstream ZeroClaw behavior against the assumptions encoded in this repository
and return a clear verdict, not to design or apply a migration.

## Scope

Cover the repository's current and planned ZeroClaw-facing contract,
especially:

- config location, active-workspace resolution, and precedence assumptions for
  `ZEROCLAW_CONFIG_DIR`, `ZEROCLAW_WORKSPACE`, persisted workspace markers, and
  `~/.zeroclaw/config.toml`
- onboarding assumptions around `zeroclaw onboard` and any provider-only
  update behavior for existing configs
- custom-provider wiring through stable top-level `default_provider`,
  `api_key`, and `default_model` for
  `custom:https://api.gonkagate.com/v1`
- model selection assumptions around curated GonkaGate models and provider
  model ids
- secret-handling assumptions around ZeroClaw-native encrypted persistence and
  the repository's decision not to hand-roll TOML writes or shell-based secret
  storage
- workflow and CLI assumptions documented by this repository, such as
  `zeroclaw`, `zeroclaw onboard`, `zeroclaw props`, `zeroclaw config schema`,
  `zeroclaw status`, `zeroclaw doctor`, and `zeroclaw gateway`
- environment-override risks relevant to this repo's contract, especially
  `ZEROCLAW_PROVIDER`, `ZEROCLAW_MODEL_PROVIDER`, `MODEL_PROVIDER`,
  `PROVIDER`, `ZEROCLAW_MODEL`, `MODEL`, `ZEROCLAW_API_KEY`, and `API_KEY`
- newly required settings, renamed fields, removed commands, or release-level
  behavior changes that would make the documented GonkaGate ZeroClaw plan stale
  or unsafe

Default compatibility target:

- latest stable upstream ZeroClaw release from the official repository

Secondary watch target:

- newer prerelease channels, prerelease tags, or release candidates, but only
  as an early-warning watchlist unless the user explicitly asks for prerelease
  compatibility

## Boundaries

Do not:

- modify repository code or docs
- broaden product scope beyond the current GonkaGate ZeroClaw contract
- propose `.env` writing, shell profile mutation, direct secret-file mutation,
  or a hand-rolled TOML writer as the default integration path unless the user
  explicitly asks for a product change
- use secondary summaries when primary sources are available
- treat prerelease drift as a stable compatibility failure unless the user
  explicitly asked to audit prereleases
- turn the audit into an auto-remediation or full migration plan

## Primary-Source Discipline

Use primary sources only:

- the official ZeroClaw repository:
  - `https://github.com/zeroclaw-labs/zeroclaw`
- official ZeroClaw release metadata and release notes
- official ZeroClaw docs from the project website or the matching tagged docs
  in the official repository
- official tagged upstream source or tests for the matching stable release
- shipped CLI help or read-only inspection for the same stable release

Prefer this discovery order:

1. latest stable ZeroClaw release metadata from the official repository
2. official release notes for that exact stable tag
3. official docs and config references for that same stable contract
4. tagged upstream source or tests when docs are incomplete
5. isolated CLI help or read-only inspection when source and docs are still
   insufficient

Useful starting points:

- `curl -fsSL https://api.github.com/repos/zeroclaw-labs/zeroclaw/releases/latest`
- `curl -fsSL https://raw.githubusercontent.com/zeroclaw-labs/zeroclaw/<tag>/README.md`
- `curl -fsSL https://raw.githubusercontent.com/zeroclaw-labs/zeroclaw/<tag>/docs/README.md`
- `npx -y github:zeroclaw-labs/zeroclaw#<tag> --help`
- `npx -y github:zeroclaw-labs/zeroclaw#<tag> onboard --help`
- `npx -y github:zeroclaw-labs/zeroclaw#<tag> status --help`
- `npx -y github:zeroclaw-labs/zeroclaw#<tag> doctor --help`

If official docs and the shipped stable artifact disagree, trust the tagged
release, source, or shipped stable artifact and call out documentation drift
explicitly.

## Safe Read-Only Execution

Keep the audit read-only.

- Prefer release notes, docs, source, tests, and CLI help over running
  stateful commands.
- Never run upstream ZeroClaw commands against the user's real `~/.zeroclaw`
  or real workspace state.
- If you need CLI help or read-only behavior inspection, isolate it in a
  disposable temp directory and point `HOME`, `ZEROCLAW_CONFIG_DIR`,
  `ZEROCLAW_WORKSPACE`, and any other relevant config roots at temp paths.
- Do not run onboarding flows or commands that mutate real state.
- Treat isolated local execution as a last resort after docs, release notes,
  and tagged source.

## Repository Surfaces To Compare

Start from the current repository contract surfaces:

- `PRD.md`
- `README.md`
- `AGENTS.md`
- `docs/how-it-works.md`
- `docs/security.md`
- `docs/troubleshooting.md`
- `docs/specs/zeroclaw-setup-prd/spec.md`
- `src/cli.ts`
- `package.json`
- `test/package-contract.test.ts`
- `test/docs-contract.test.ts`
- `test/skills-contract.test.ts`

Inspect local skills when they encode product assumptions that affect the
audit, especially:

- `.claude/skills/coding-prompt-normalizer/`
- `.agents/skills/coding-prompt-normalizer/`
- this compatibility-audit skill itself, if its assumptions look stale

If the repository later adds implementation modules, inspect those too instead
of stopping at docs. In particular, compare any future surfaces under:

- `src/install/`
- `src/constants/`
- config-writing modules
- ZeroClaw command helpers
- provider or secret helpers
- runtime verification flows

## Upstream Evidence To Gather

For the target stable release, gather evidence for:

- the exact stable version or release tag and its publish date
- whether the official repository, release notes, and docs agree on that
  stable release
- whether newer prerelease channels or tags exist and whether they signal
  upcoming contract drift
- where ZeroClaw loads active config from and how workspace/config resolution
  actually works
- the official stable shape of `default_provider`, `default_model`, `api_key`,
  provider keys, model ids, property-mutation seams, and any provider-only
  update flows
- whether `zeroclaw onboard` remains the preferred setup path and whether it
  still supports safe provider-only changes for existing configs
- whether ZeroClaw-native save paths still own secret encryption and backups,
  and whether comment preservation is actually guaranteed in the target stable
  release
- whether ZeroClaw added or removed CLI surfaces relevant to this repository's
  documented flow
- whether release notes mention changes to config precedence, providers,
  workspace markers, encrypted secrets, status/doctor/model commands, or
  onboarding behavior
- any newly required settings, schema migrations, or structural requirements
  that this repository does not currently satisfy

When searching source or docs, start with these literals:

- `~/.zeroclaw/config.toml`
- `ZEROCLAW_CONFIG_DIR`
- `ZEROCLAW_WORKSPACE`
- `default_provider`
- `default_model`
- `api_key`
- `zeroclaw props`
- `custom:https://`
- `config.toml`
- `zeroclaw onboard`
- `zeroclaw status`
- `zeroclaw doctor`
- `zeroclaw gateway`
- `workspace marker`
- `encrypted secrets`

## Workflow

1. Identify the audit target.
   - Determine the latest stable ZeroClaw release from official release
     metadata.
   - Confirm the matching repository tag and publish date.
   - Note any newer prerelease tags, but keep them separate from the stable
     compatibility verdict unless the user asked for them.
2. Capture the upstream contract before judging compatibility.
   - Read official release notes for the exact stable version.
   - Read official docs and tagged source relevant to config, onboarding,
     providers, and CLI behavior.
   - Read tagged source or tests when docs are vague, incomplete, or missing
     exact field or behavior details.
   - Use isolated CLI help only when docs and source still leave an important
     ambiguity.
3. Map the repository's assumptions.
   - Read `PRD.md`, `README.md`, `AGENTS.md`, and `docs/` first.
   - Then inspect `src/cli.ts`, `package.json`, tests, and any implementation
     surfaces that exist.
   - Keep current scaffold truthfulness separate from the planned future
     product contract.
4. Compare the critical seams one by one.
   - `config and workspace resolution`
     Compare upstream config precedence and workspace behavior against the
     repo's `ZEROCLAW_CONFIG_DIR`, `ZEROCLAW_WORKSPACE`, workspace-marker, and
     `~/.zeroclaw/config.toml` assumptions.
   - `provider wiring`
     Compare upstream provider config expectations against the repo's planned
     `default_provider`, `default_model`, and `api_key` usage for
     `custom:https://api.gonkagate.com/v1`.
   - `onboarding and secret handling`
     Compare upstream onboarding and save semantics against the repo's plan to
     rely on ZeroClaw-native onboarding, encrypted secret persistence, and
     non-destructive updates.
   - `workflow and command surfaces`
     Compare upstream CLI surfaces and documented workflows against what this
     repo promises users today.
   - `recent release drift`
     Compare the latest stable release notes, and optionally prerelease
     signals, against the repo's ZeroClaw setup plan.
5. Classify the evidence.
   - Label each material point as:
     `confirmed upstream change`, `confirmed still compatible`,
     `confirmed repo-overstatement`, or `inferred risk`.
   - Keep observed upstream facts separate from your interpretation of impact.
6. Decide the verdict.
   - `compatible`
     No confirmed upstream stable change breaks the repository's current or
     planned ZeroClaw contract.
   - `compatible with caveats`
     No confirmed stable break yet, but there is meaningful ambiguity,
     documentation drift, prerelease warning, or repository overstatement that
     weakens confidence.
   - `incompatible`
     A confirmed upstream stable change conflicts with a required repository
     assumption or makes the documented GonkaGate ZeroClaw plan stale or
     unsafe.
7. Name the minimum follow-up.
   - Point to the exact repo surfaces that would need attention.
   - Keep this as `recommended fix areas`, not a redesign.

## Reasoning Discipline

- Separate confirmed upstream changes from inferred risk.
- Base the main verdict on the latest stable release, not on prereleases.
- Use prerelease channels only as an explicit watchlist unless the user asked
  for prerelease compatibility.
- If the repo docs are still compatible with upstream but the scaffold
  implementation is incomplete or misleading, call that a repository
  truthfulness issue, not an upstream break.
- If the upstream docs are vague but the tagged release, source, or shipped
  stable behavior is clear, cite the shipped behavior and call out doc drift.
- Treat config precedence, provider wiring, onboarding seams, and secret
  handling as high-sensitivity by default.
- Do not infer support for out-of-scope product changes that this repository
  explicitly rejects.

## Output

Load `references/report-template.md` before writing the final answer.

The report should:

- cite the exact stable version or release tag audited and its publish date
- link the primary sources used
- separate confirmed upstream changes from inferred risk
- separate stable-verdict impact from prerelease watchlist signals
- point to the exact repository surfaces that would break or need clarification
- include a short `recommended fix areas` section only when the verdict is
  `compatible with caveats` or `incompatible`

Keep the output short, decisive, and evidence-backed.
