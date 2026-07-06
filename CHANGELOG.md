# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- replace the checked-in GonkaGate model catalog with authenticated
  `GET /v1/models` selection for prompts, `--model <id>` validation, and
  ZeroClaw config writes
- reject malformed or empty live model catalogs before any ZeroClaw config
  mutation, and dedupe duplicate live model IDs
- keep ZeroClaw first-run secret persistence on the proven native
  `zeroclaw props set api-key` prompt path; stdin-fed first-run secret
  transport remains blocked

## [0.1.0] - 2026-04-17

- bootstrap repository structure, CI/CD, TypeScript build, docs, and scaffolded CLI surfaces
- align the planned ZeroClaw contract to audited stable `v0.6.9` and document broader `v0.6.x` caveats plus prerelease config-v2 drift explicitly
- pin the v1 decision record: props-based existing-config writes, explicit verify shadow warnings, a single-entry curated launch model, and optional `--model <curated-key>`
- land Phase 1 read-only foundations: async `zeroclaw` version gating,
  source-level config resolution, saved-config inspection, audited top-level
  preflight, and install-side refusal before secret intake on unsupported
  runtimes or unaudited config shapes
- land Phase 2 install mutation on audited stable `v0.6.9`: proven
  first-run `onboard --quick` plus hidden `api-key`, split native
  existing-config writes, runtime-quiesced refusal, non-secret restore, and
  explicit post-secret remediation
- land Phase 3 read-only verify verdicts on audited stable `v0.6.9`:
  saved-contract checks, env-shadow classification, `zeroclaw status`
  runtime evidence, advisory `zeroclaw doctor`, and final
  `pass` / `warn-shadowed` / `fail` output
- land Phase 4 proof hardening and truthful release readiness:
  native-prompt-only first-run gating, opaque secret persistence fixtures,
  broader runtime/config regression coverage, and docs/package truthfulness
  updates
