# Implementation Plan (Historical Execution Record)

This document is a historical execution record from the scaffold-to-runtime
transition for `zeroclaw-setup`. It is not the current product contract.
Use `PRD.md`, `README.md`, `AGENTS.md`, and [docs/README.md](README.md) for
current truth.

## Landed Work

1. Landed Phase 1 read-only foundations:
   - shared `zeroclaw` command gateway and exact-`v0.6.9` support
     classification
   - source-audited config resolution plus saved-config inspection
   - audited top-level preflight and unknown-key refusal
2. Landed Phase 2 install mutation:
   - `zeroclaw onboard --quick --provider custom:https://api.gonkagate.com/v1 --model <model-id>`
   - `zeroclaw props set api-key`
   - split native existing-config writes through `zeroclaw props`
3. Landed Phase 3 read-only verify verdicts:
   - saved GonkaGate contract checks
   - env-shadow classification
   - runtime summary through `zeroclaw status`
   - advisory-only `zeroclaw doctor`
   - final `pass` / `warn-shadowed` / `fail` rendering
4. Landed Phase 4 proof hardening and truthful release readiness:
   - first-run install now blocks unproven stdin secret transport and stays
     native-prompt-only
   - disposable proof now asserts that secrets stay off argv and out of
     literal saved-config text
   - regression coverage now pins audited-section preservation,
     runtime-quiesce refusal, and `api_key` set/unset inspection behavior
   - docs and package metadata now separate current truth from historical
     planning artifacts

## Historical Notes

- the current shipped install path remains:
  - `zeroclaw onboard --quick --provider custom:https://api.gonkagate.com/v1 --model <model-id>`
  - `zeroclaw props set api-key`
- the current shipped existing-config path remains:
  - `default-provider` and `default-model` through
    `zeroclaw props set --no-interactive`
  - hidden `api-key` through `zeroclaw props set api-key`
  - runtime-quiesced gating
  - non-secret restore on failure
  - explicit secret remediation after post-secret failure
- saved `api_key` confirmation remains set/unset evidence only; literal secret
  read-back is not part of the shipped contract
