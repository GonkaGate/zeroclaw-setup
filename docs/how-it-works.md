# How It Works

`zeroclaw-setup` now ships audited ZeroClaw `v0.6.9` install and
read-only verify flows, with Phase 4 proof hardening landed around transport
gating, runtime refusal, and truthful docs/tests.

## Module Map

- `src/constants/` holds the fixed GonkaGate provider contract and curated
  model registry
- `src/install/deps.ts` provides command, prompt, HTTP, stdin,
  process-inspection, and runtime seams
- `src/install/environment-overrides.ts` isolates provider-shadowing checks
- `src/install/config-resolution.ts` mirrors stable ZeroClaw active-config
  resolution
- `src/install/config-preflight.ts` classifies whether the resolved config is
  safe for mutation
- `src/install/first-run-proof.ts` records the shipped first-run proof artifact
  and exposes the disposable proof evaluator used in tests
- `src/install/first-run-install.ts` runs the proven first-run mutation path
- `src/install/gonkagate-models.ts` owns the GonkaGate `GET /v1/models`
  trust boundary and curated live-catalog requirement
- `src/install/runtime-quiesce.ts` implements the refusal-oriented runtime gate
- `src/install/native-write.ts` owns the existing-config split native write
  sequence and non-secret restore boundaries
- `src/install/install-use-case.ts` chooses the mutation path, checks the live
  catalog, and defers model selection plus native writes until gating has
  passed
- `src/install/verify-use-case.ts` now evaluates the saved GonkaGate contract,
  env shadowing, runtime status evidence, and advisory doctor output
- `src/install/zeroclaw-command.ts` owns the native ZeroClaw command adapters

## Shipped Install Behavior

Install and verify still share one exact-`v0.6.9` command/version gate.

After that gate:

1. install resolves the active config path and inspects saved managed-field
   evidence without exposing the literal `api_key`, using set/unset evidence
   only for the secret field
2. install refuses unknown top-level keys and other unaudited shapes before any
   mutation
3. install chooses between:
   - first-run mutation when no saved config exists
   - existing-config mutation when the resolved config stays within the audited
     top-level contract
   - blocked output when version, shape, or runtime state is unsafe
4. install runs a refusal-first runtime-quiesce gate before prompting for the
   hidden GonkaGate key used for live catalog validation
5. install calls `GET https://api.gonkagate.com/v1/models` with Bearer auth,
   validates that the response is an object with a `data` array of model
   objects containing non-empty string `id` fields, and requires every
   curated in-repo model to be present
6. install ignores arbitrary live catalog entries outside the curated registry
   and prompts for a curated model only after the live gate passes

The catalog key check happens before any ZeroClaw config mutation. On public
native-prompt storage paths, the wrapper-collected key is used for the catalog
check only; ZeroClaw still collects the persisted `api-key` through
`zeroclaw props set api-key`.

### First-Run Path

The shipped first-run command tuple is:

1. `zeroclaw onboard --quick --provider custom:https://api.gonkagate.com/v1 --model <curated-model-id>`
2. `zeroclaw props set api-key`

This keeps the secret off argv, avoids the full onboarding wizard, and leaves
workspace/config creation to ZeroClaw-native seams. This path is shipped only
when ZeroClaw can collect the API key through its native masked prompt; if the
secret would need stdin or another unproven transport, install blocks before
mutation.

The first-run path does not convert the wrapper's live-catalog key prompt into
stdin persistence. That preserves the shipped native-prompt proof for audited
`v0.6.9`, even though it means the native ZeroClaw prompt remains the storage
step.

### Existing-Config Path

The shipped existing-config sequence is:

1. native snapshot of `default-provider` and `default-model`
2. `zeroclaw props set --no-interactive default-provider <provider>`
3. `zeroclaw props set --no-interactive default-model <model>`
4. hidden native `zeroclaw props set api-key`
5. read-only saved-config confirmation using `api_key` set/unset evidence only

If failure happens before the secret step, the wrapper restores the prior
non-secret fields. If failure happens after the secret step, it still restores
the non-secret fields and surfaces explicit secret remediation because stable
`v0.6.9` does not expose the prior `api-key` value.

## Shipped Verify Behavior

`npx zeroclaw-setup verify` is now a read-only verdict flow for exact
audited ZeroClaw `v0.6.9`.

In one run it now:

1. checks the installed ZeroClaw version against the audited target
2. resolves the active config/workspace path the same way stable ZeroClaw does
3. inspects the saved GonkaGate-managed contract without printing the literal
   `api_key`, using set/unset evidence only rather than literal secret
   read-back
4. classifies provider-related env shadowing, including the explicit
   `saved config is correct but inactive` warning state
5. reads runtime summary evidence through `zeroclaw status --json`
6. includes `zeroclaw doctor` output as advisory troubleshooting context only

Final verify verdicts are:

- `pass` when saved config and runtime evidence agree with the GonkaGate
  contract
- `warn-shadowed` when saved config is correct but env overrides make it
  inactive
- `fail` when the saved contract, runtime evidence, or audited version gate
  does not match the supported `v0.6.9` contract

## What Is Still Not Shipped

- compatibility claims beyond exact audited stable `v0.6.9`
- arbitrary base URLs, arbitrary model IDs, shell profile mutation, and `.env`
  writing
