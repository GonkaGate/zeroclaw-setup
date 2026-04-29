# Security

The shipped install path preserves the security posture from the PRD:

- the GonkaGate API key stays off argv in the public happy path
- shell profile mutation is out of scope
- `.env` writing is out of scope
- provider-related environment overrides remain a correctness risk
- the managed config surface stays intentionally narrow:
  `default_provider`, `api_key`, `default_model`
- existing-config writes stay on ZeroClaw-native seams:
  `default-provider` and `default-model` use
  `zeroclaw props set --no-interactive`, while `api-key` uses the hidden
  native `zeroclaw props set api-key` path
- first-run setup uses the proven two-step native path:
  `zeroclaw onboard --quick` for config/workspace initialization, then
  `zeroclaw props set api-key` for the secret
- first-run mutation stays blocked when the API key cannot be collected
  through that hidden native prompt; stdin-fed first-run secret transport is
  intentionally not part of the shipped proof
- mutation runs only after a refusal-oriented runtime-quiesce gate; active or
  ambiguous runtime state blocks the install before hidden secret entry
- configs with unknown top-level keys or other unaudited shapes are refused
  instead of being rewritten optimistically
- stable native secret reads still expose set/unset evidence only, so the
  wrapper does not claim it can recover the prior `api-key` value
- saved-config confirmation and `verify` use the same set/unset-only secret
  evidence; the wrapper does not claim literal saved secret read-back
- post-secret failures surface explicit secret remediation instead of pretending
  the prior secret was restored
- stable ZeroClaw ordinary saves provide per-write atomic replace / transient
  rollback semantics, not a durable user-facing backup history
- verify stays read-only while now comparing saved state against
  `zeroclaw status`, classifying env shadowing, and surfacing
  `zeroclaw doctor` as advisory-only context

Current limitation:

- the repository ships install mutation plus read-only verify verdicts only for
  audited stable ZeroClaw `v0.6.9`
- verify still exposes `api_key` as set/unset evidence only and keeps
  `zeroclaw doctor` advisory rather than verdict-defining
