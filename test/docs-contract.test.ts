import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");

test("required docs files exist", () => {
  const requiredFiles = [
    "AGENTS.md",
    "CHANGELOG.md",
    "PRD.md",
    "README.md",
    "docs/README.md",
    "docs/how-it-works.md",
    "docs/implementation-plan.md",
    "docs/security.md",
    "docs/troubleshooting.md",
    "docs/specs/zeroclaw-setup-prd/spec.md",
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(existsSync(join(repoRoot, relativePath)), true, relativePath);
  }
});

test("README advertises the package and current install/verify status", () => {
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

  assert.match(readme, /zeroclaw-setup/);
  assert.match(readme, /npx zeroclaw-setup/);
  assert.match(readme, /Phase 2 mutation/i);
  assert.match(readme, /Phase 3 read-only verdict flow/i);
  assert.match(readme, /runtime-quiesced/i);
  assert.match(readme, /onboard --quick/i);
  assert.match(readme, /zeroclaw status/i);
  assert.match(readme, /zeroclaw doctor/i);
});

test("PRD resolves the stable-target v1 direction explicitly", () => {
  const prd = readFileSync(join(repoRoot, "PRD.md"), "utf8");

  assert.doesNotMatch(prd, /^## Open Questions$/m);
  assert.match(prd, /`zeroclaw props set --no-interactive`/);
  assert.match(prd, /`zeroclaw props set api-key`/);
  assert.match(prd, /`default-provider`/);
  assert.match(prd, /`api-key`/);
  assert.match(prd, /`default-model`/);
  assert.match(prd, /runtime-quiesced/i);
  assert.match(prd, /restore/i);
  assert.match(
    prd,
    /secret-remediation|prior secret|prior `api_key`|prior `api-key`/i,
  );
  assert.match(prd, /argv/i);
  assert.match(prd, /saved config is correct but inactive/i);
  assert.match(prd, /`ZEROCLAW_MODEL_PROVIDER`/);
  assert.match(prd, /`MODEL_PROVIDER`/);
  assert.match(prd, /`ZEROCLAW_MODEL`/);
  assert.match(prd, /`MODEL`/);
  assert.match(prd, /`v0\.6\.9`/);
  assert.match(prd, /`v0\.6\.x`/);
  assert.match(prd, /`v0\.7\.0-beta\.\*`/);
  assert.match(prd, /unknown top-level keys/i);
  assert.match(prd, /advisory/i);
  assert.match(
    prd,
    /`qwen3-235b` -> `qwen\/qwen3-235b-a22b-instruct-2507-fp8`/,
  );
  assert.match(prd, /`kimi-k2\.6` -> `moonshotai\/Kimi-K2\.6`/);
  assert.match(prd, /`--model <curated-key>`/);
});

test("repo docs record the split write path and verify shadow behavior", () => {
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
  const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");
  const docsReadme = readFileSync(join(repoRoot, "docs/README.md"), "utf8");
  const implementationPlan = readFileSync(
    join(repoRoot, "docs/implementation-plan.md"),
    "utf8",
  );
  const prdTaskBreakdown = readFileSync(
    join(repoRoot, "docs/prd-task-breakdown.md"),
    "utf8",
  );

  assert.match(readme, /`zeroclaw props set --no-interactive`/);
  assert.match(readme, /`zeroclaw props set api-key`/);
  assert.match(readme, /`default-provider`/);
  assert.match(readme, /`api-key`/);
  assert.match(readme, /`default-model`/);
  assert.match(readme, /runtime-quiesced/i);
  assert.match(readme, /native read-back|prior .*api-key/i);
  assert.match(readme, /saved config is correct but inactive/i);
  assert.match(readme, /`ZEROCLAW_MODEL_PROVIDER`/);
  assert.match(readme, /`MODEL_PROVIDER`/);
  assert.match(readme, /`ZEROCLAW_MODEL`/);
  assert.match(readme, /`MODEL`/);
  assert.match(readme, /`v0\.6\.9`/);
  assert.match(readme, /onboard --quick/i);
  assert.match(
    readme,
    /`pass` \/ `warn-shadowed` \/ `fail`|`pass`, `warn-shadowed`, and `fail`/i,
  );
  assert.match(readme, /unknown top-level keys/i);
  assert.match(readme, /advisory/i);
  assert.match(readme, /`--model <curated-key>`/);
  assert.match(readme, /`kimi-k2\.6` -> `moonshotai\/Kimi-K2\.6`/);
  assert.match(readme, /set\/unset evidence only/i);
  assert.match(
    readme,
    /stdin-fed secret transport remains blocked|native prompt/i,
  );

  assert.match(agents, /`zeroclaw props set --no-interactive`/);
  assert.match(agents, /`zeroclaw props set api-key`/);
  assert.match(agents, /`default-provider`/);
  assert.match(agents, /`api-key`/);
  assert.match(agents, /`default-model`/);
  assert.match(agents, /runtime-quiesced/i);
  assert.match(agents, /restore/i);
  assert.match(agents, /saved config is correct but inactive/i);
  assert.match(agents, /`ZEROCLAW_MODEL_PROVIDER`/);
  assert.match(agents, /`MODEL_PROVIDER`/);
  assert.match(agents, /`ZEROCLAW_MODEL`/);
  assert.match(agents, /`MODEL`/);
  assert.match(agents, /`v0\.6\.9`/);
  assert.match(agents, /config resolution/i);
  assert.match(agents, /saved-config inspection|saved config inspection/i);
  assert.match(agents, /unknown top-level keys/i);
  assert.match(agents, /advisory/i);
  assert.match(agents, /`--model <curated-key>`/);
  assert.match(agents, /`kimi-k2\.6` -> `moonshotai\/Kimi-K2\.6`/);
  assert.match(agents, /onboard --quick/i);
  assert.match(
    agents,
    /set\/unset-only inspection behavior|set\/unset evidence/i,
  );
  assert.match(
    agents,
    /`pass`, `warn-shadowed`, and `fail`|`pass` \/ `warn-shadowed` \/ `fail`/i,
  );

  assert.match(docsReadme, /Current Truth/i);
  assert.match(docsReadme, /Historical Context/i);
  assert.match(docsReadme, /implementation-plan\.md[\s\S]*historical/i);
  assert.match(docsReadme, /prd-task-breakdown\.md[\s\S]*historical/i);
  assert.doesNotMatch(docsReadme, /remaining release-readiness milestones/i);

  assert.match(implementationPlan, /`zeroclaw props set --no-interactive`/);
  assert.match(implementationPlan, /`zeroclaw props set api-key`/);
  assert.match(implementationPlan, /`default-provider`/);
  assert.match(implementationPlan, /`api-key`/);
  assert.match(implementationPlan, /`default-model`/);
  assert.match(implementationPlan, /runtime-quiesced/i);
  assert.match(implementationPlan, /restore/i);
  assert.match(implementationPlan, /Landed Phase 2 install mutation/i);
  assert.match(implementationPlan, /Landed Phase 3 read-only verify verdicts/i);
  assert.match(
    implementationPlan,
    /Landed Phase 4 proof hardening and truthful release readiness/i,
  );
  assert.match(implementationPlan, /historical execution record/i);
  assert.doesNotMatch(implementationPlan, /^## Remaining Work$/m);
  assert.match(implementationPlan, /`v0\.6\.9`/);
  assert.match(implementationPlan, /zeroclaw status/i);
  assert.match(implementationPlan, /zeroclaw doctor/i);

  assert.match(prdTaskBreakdown, /historical planning document/i);
  assert.match(prdTaskBreakdown, /scaffold-era wording and unchecked boxes/i);
});

test("CHANGELOG stays aligned with the audited stable target wording", () => {
  const changelog = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");

  assert.match(changelog, /`v0\.6\.9`/);
  assert.match(changelog, /`v0\.6\.x` caveats/i);
  assert.match(changelog, /config-v2 drift/i);
});
