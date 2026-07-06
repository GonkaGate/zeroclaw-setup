# Documentation Index

## Current Truth

This repository currently contains:

- the shipped audited-`v0.6.9` install and verify runtime for
  `zeroclaw-setup`
- Phase 4 proof hardening for native-prompt-only first-run mutation,
  runtime-quiesce refusal, audited-section preservation, and `api_key`
  set/unset-only inspection behavior
- CI, release tooling, docs, and regression tests that describe the same
  shipped contract

This repository does not currently contain:

- compatibility claims not backed by setup or verify checks
- model-id support outside authenticated GonkaGate `/v1/models` results
- arbitrary custom base URL support
- shell profile or `.env` mutation
- default online verify probing

## Current Contract Documents

- [README.md](../README.md)
- [PRD.md](../PRD.md)
- [specs/zeroclaw-setup-prd/spec.md](specs/zeroclaw-setup-prd/spec.md)

## Operational Guides

- [how-it-works.md](how-it-works.md)
- [security.md](security.md)
- [troubleshooting.md](troubleshooting.md)

## Historical Context

- [implementation-plan.md](implementation-plan.md) - historical execution
  record from the scaffold-to-runtime transition
- [prd-task-breakdown.md](prd-task-breakdown.md) - historical planning
  checklist from the same transition

## Notes

- the product source of truth is `PRD.md`, with `README.md` as the public
  entrypoint
- `AGENTS.md` remains the repository operating contract
- historical planning documents are kept for context only and should not be
  read as the current shipped contract
