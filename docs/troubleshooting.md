# Troubleshooting

## Node Version

This repository targets Node `22.14.0` and newer. If `npm ci` fails
unexpectedly, verify:

```bash
node --version
npm --version
```

## Clean Install

If dependencies drift locally:

```bash
rm -rf node_modules package-lock.json
npm install
```

## CI Parity

The same command used by GitHub Actions is:

```bash
npm run ci
```

Useful narrower checks:

```bash
npm run lint
npm run format:check
npm run typecheck
```

## Current Install Behavior

`npx zeroclaw-setup` now mutates config only when all of these are true:

- installed ZeroClaw is available, parseable, and not older than audited
  `v0.6.9`
- the resolved config shape stays inside the audited top-level contract
- the runtime-quiesce gate reports no active or ambiguous ZeroClaw runtime
- the entered `gp-...` key can call GonkaGate
  `GET https://api.gonkagate.com/v1/models`
- the live catalog response has the expected `data[].id` shape and contains at
  least one valid model ID
- the chosen path can use the shipped native seams
- first-run setup can use the hidden native `zeroclaw props set api-key`
  prompt; unproven stdin-fed first-run secret transport stays blocked

Common install blockers:

- missing, unparseable, or too-old ZeroClaw runtime
- unknown top-level keys in the resolved `config.toml`
- active or ambiguous runtime state from `zeroclaw status --json` or local
  process inspection
- GonkaGate `/v1/models` auth failure, temporary catalog unavailability,
  malformed catalog payloads, empty catalogs, or an explicit `--model` value
  absent from the live response
- no access to the hidden native `zeroclaw props set api-key` prompt that the
  shipped first-run proof requires

If install reports runtime activity, stop ZeroClaw gateway/daemon processes and
rerun the installer. The wrapper intentionally refuses background mutation in
ambiguous runtime states.

If install reports a post-secret failure, the wrapper restores the prior
non-secret fields when possible, but stable native seams still do not expose
the prior `api-key` value for automatic recovery.

If install reports a GonkaGate `/v1/models` failure, no ZeroClaw config write
has started yet. Check the API key, wait and retry if the catalog is
temporarily unavailable, or pick a model ID returned by the live response.

## Current Verify Behavior

`npx zeroclaw-setup verify` now performs these read-only checks on
audited ZeroClaw `v0.6.9`:

- `zeroclaw --version` detection plus support classification
- active-config resolution through `ZEROCLAW_CONFIG_DIR`,
  `ZEROCLAW_WORKSPACE`, `active_workspace.toml`, and the default
  `~/.zeroclaw/config.toml`
- saved managed-field inspection for `default_provider`, `default_model`, and
  `api_key` set/unset evidence only
- mutation-readiness preflight for unknown top-level keys
- runtime summary through `zeroclaw status --json`
- advisory troubleshooting output through `zeroclaw doctor`

Current verify verdict semantics are:

- `pass` when the saved GonkaGate contract is correct and active runtime
  evidence matches it
- `warn-shadowed` when the saved GonkaGate contract is correct but env
  overrides make it inactive, with the exact warning
  `saved config is correct but inactive`
- `fail` when the audited version gate, saved contract, or runtime evidence
  does not match the supported `v0.6.9` contract

When testing or implementing that path, inspect these env vars first:

- `ZEROCLAW_PROVIDER`
- `ZEROCLAW_MODEL_PROVIDER`
- `MODEL_PROVIDER`
- `PROVIDER`
- `ZEROCLAW_MODEL`
- `MODEL`
- `ZEROCLAW_API_KEY`
- `API_KEY`

## RTK Reminder

Repository-local agent instructions expect shell commands to be prefixed with
`rtk`.
