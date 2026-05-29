import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");
const agentsSkillsRoot = join(repoRoot, ".agents", "skills");
const claudeSkillsRoot = join(repoRoot, ".claude", "skills");

function collectFiles(root: string): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    const entries = readdirSync(current).sort((left, right) =>
      left.localeCompare(right),
    );

    for (const entry of entries) {
      const fullPath = join(current, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (stats.isFile()) {
        results.push(relative(root, fullPath));
      }
    }
  }

  walk(root);
  return results;
}

test("mirrored skill pack exists in both .agents and .claude", () => {
  assert.equal(existsSync(agentsSkillsRoot), true);
  assert.equal(existsSync(claudeSkillsRoot), true);
});

test("mirrored skill assets stay aligned across .agents and .claude", () => {
  const agentsFiles = collectFiles(agentsSkillsRoot);
  const claudeFiles = collectFiles(claudeSkillsRoot);

  assert.deepEqual(agentsFiles, claudeFiles);

  for (const relativePath of agentsFiles) {
    const agentsContent = readFileSync(
      join(agentsSkillsRoot, relativePath),
      "utf8",
    );
    const claudeContent = readFileSync(
      join(claudeSkillsRoot, relativePath),
      "utf8",
    );

    assert.equal(claudeContent, agentsContent, relativePath);
  }
});

test("imported skill pack includes expected high-value entries", () => {
  const expectedFiles = [
    ".agents/skills/code-simplification/SKILL.md",
    ".agents/skills/coding-prompt-normalizer/SKILL.md",
    ".agents/skills/node-security-review/SKILL.md",
    ".agents/skills/planning-and-task-breakdown/SKILL.md",
    ".agents/skills/spec-first-brainstorming/SKILL.md",
    ".agents/skills/technical-design-review/SKILL.md",
    ".agents/skills/typescript-coder/SKILL.md",
    ".agents/skills/typescript-coder-plan-spec/SKILL.md",
    ".agents/skills/typescript-runtime-boundary-modeling/SKILL.md",
    ".agents/skills/typescript-systematic-debugging/SKILL.md",
    ".agents/skills/zeroclaw-compatibility-audit/SKILL.md",
    ".agents/skills/verification-before-completion/SKILL.md",
  ];

  for (const relativePath of expectedFiles) {
    assert.equal(existsSync(join(repoRoot, relativePath)), true, relativePath);
  }
});

test("AGENTS documents the mirrored skill pack", () => {
  const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");

  assert.match(agents, /\.agents\/skills\//);
  assert.match(agents, /\.claude\/skills\//);
  assert.match(agents, /mirrored skill pack/i);
});

test("zeroclaw compatibility audit skill is adapted to this repository", () => {
  const skill = readFileSync(
    join(repoRoot, ".agents/skills/zeroclaw-compatibility-audit/SKILL.md"),
    "utf8",
  );
  const reportTemplate = readFileSync(
    join(
      repoRoot,
      ".agents/skills/zeroclaw-compatibility-audit/references/report-template.md",
    ),
    "utf8",
  );

  assert.match(skill, /name: zeroclaw-compatibility-audit/);
  assert.match(skill, /ZeroClaw Compatibility Audit/);
  assert.match(skill, /`zeroclaw-setup`/);
  assert.match(skill, /`ZEROCLAW_CONFIG_DIR`/);
  assert.match(skill, /`ZEROCLAW_WORKSPACE`/);
  assert.match(skill, /`ZEROCLAW_MODEL_PROVIDER`/);
  assert.match(skill, /`MODEL_PROVIDER`/);
  assert.match(skill, /`ZEROCLAW_MODEL`/);
  assert.match(skill, /`MODEL`/);
  assert.match(skill, /`default_provider`/);
  assert.match(skill, /`default_model`/);
  assert.match(skill, /`api_key`/);
  assert.match(skill, /zeroclaw onboard/);
  assert.match(skill, /zeroclaw props/);
  assert.match(skill, /zeroclaw config schema/);
  assert.match(skill, /zeroclaw status/);
  assert.match(skill, /zeroclaw doctor/);
  assert.match(skill, /https:\/\/github\.com\/zeroclaw-labs\/zeroclaw/);
  assert.doesNotMatch(skill, /opencode-setup/);
  assert.doesNotMatch(skill, /opencode-ai/);
  assert.doesNotMatch(skill, /provider\.gonkagate/);
  assert.doesNotMatch(skill, /chat_completions/);
  assert.match(
    reportTemplate,
    /Stable ZeroClaw release tag or version audited/,
  );
  assert.match(reportTemplate, /planned ZeroClaw product\s+contract/);
  assert.doesNotMatch(reportTemplate, /OpenCode/);
  assert.doesNotMatch(reportTemplate, /opencode-ai/);
});

test("planning and task breakdown skill is adapted to this repository", () => {
  const skill = readFileSync(
    join(repoRoot, ".agents/skills/planning-and-task-breakdown/SKILL.md"),
    "utf8",
  );

  assert.match(skill, /For `zeroclaw-setup`, start by reading:/);
  assert.match(skill, /`PRD\.md`/);
  assert.match(skill, /`docs\/specs\/zeroclaw-setup-prd\/spec\.md`/);
  assert.match(skill, /ZeroClaw installer runtime/);
  assert.match(skill, /ZeroClaw-native\s+onboarding and save semantics/);
  assert.match(skill, /README, AGENTS, and security docs/);
  assert.match(skill, /`npm run ci`/);
  assert.match(skill, /`zeroclaw-setup` scaffold reality/);
  assert.doesNotMatch(skill, /opencode-setup/);
  assert.doesNotMatch(skill, /docs\/specs\/opencode-setup-prd\/spec\.md/);
});

test("coding prompt normalizer skill is adapted to this repository", () => {
  const skill = readFileSync(
    join(repoRoot, ".agents/skills/coding-prompt-normalizer/SKILL.md"),
    "utf8",
  );
  const repoContextRouting = readFileSync(
    join(
      repoRoot,
      ".agents/skills/coding-prompt-normalizer/references/repo-context-routing.md",
    ),
    "utf8",
  );
  const inputNormalization = readFileSync(
    join(
      repoRoot,
      ".agents/skills/coding-prompt-normalizer/references/input-normalization.md",
    ),
    "utf8",
  );
  const evals = readFileSync(
    join(repoRoot, ".agents/skills/coding-prompt-normalizer/evals/evals.json"),
    "utf8",
  );

  assert.match(skill, /`zeroclaw-setup`/);
  assert.match(skill, /`npx zeroclaw-setup`/);
  assert.match(skill, /`~\/\.zeroclaw\/config\.toml`/);
  assert.match(skill, /`ZEROCLAW_CONFIG_DIR`/);
  assert.match(skill, /`ZEROCLAW_WORKSPACE`/);
  assert.match(skill, /`ZEROCLAW_MODEL_PROVIDER`/);
  assert.match(skill, /`MODEL_PROVIDER`/);
  assert.match(skill, /`ZEROCLAW_MODEL`/);
  assert.match(skill, /`MODEL`/);
  assert.match(skill, /`default_provider`/);
  assert.match(skill, /`api_key`/);
  assert.match(skill, /`default_model`/);
  assert.match(skill, /`default-provider`/);
  assert.match(skill, /`api-key`/);
  assert.match(skill, /`default-model`/);
  assert.match(skill, /`zeroclaw props set --no-interactive`/);
  assert.match(skill, /`zeroclaw props set api-key`/);
  assert.match(skill, /scaffold for `npx zeroclaw-setup`/);
  assert.match(skill, /not a shipped\s+end-to-end ZeroClaw installer yet/);
  assert.doesNotMatch(skill, /opencode-setup/);
  assert.doesNotMatch(skill, /opencode-ai/);
  assert.doesNotMatch(skill, /provider\.gonkagate/);
  assert.doesNotMatch(skill, /chat_completions/);
  assert.doesNotMatch(skill, /auth\.json/);
  assert.doesNotMatch(skill, /providers\.fallback/);

  assert.match(
    repoContextRouting,
    /`zeroclaw-setup` is currently a TypeScript\/Node scaffold/,
  );
  assert.match(repoContextRouting, /`PRD\.md`/);
  assert.match(repoContextRouting, /`~\/\.zeroclaw\/config\.toml`/);
  assert.match(repoContextRouting, /`ZEROCLAW_CONFIG_DIR`/);
  assert.match(repoContextRouting, /`ZEROCLAW_WORKSPACE`/);
  assert.match(repoContextRouting, /`ZEROCLAW_MODEL_PROVIDER`/);
  assert.match(repoContextRouting, /`MODEL_PROVIDER`/);
  assert.match(repoContextRouting, /`ZEROCLAW_MODEL`/);
  assert.match(repoContextRouting, /`MODEL`/);
  assert.match(repoContextRouting, /`default_provider`/);
  assert.match(repoContextRouting, /`default_model`/);
  assert.match(repoContextRouting, /`api_key`/);
  assert.match(repoContextRouting, /`zeroclaw props`/);
  assert.match(
    repoContextRouting,
    /ZeroClaw-native onboarding and save semantics/,
  );
  assert.doesNotMatch(repoContextRouting, /opencode-setup/);
  assert.doesNotMatch(repoContextRouting, /provider\.gonkagate/);

  assert.match(inputNormalization, /`~\/\.zeroclaw\/config\.toml`/);
  assert.match(inputNormalization, /`npx zeroclaw-setup`/);
  assert.match(inputNormalization, /`ZEROCLAW_CONFIG_DIR`/);
  assert.match(inputNormalization, /`ZEROCLAW_WORKSPACE`/);
  assert.match(inputNormalization, /`ZEROCLAW_MODEL_PROVIDER`/);
  assert.match(inputNormalization, /`MODEL_PROVIDER`/);
  assert.match(inputNormalization, /`ZEROCLAW_MODEL`/);
  assert.match(inputNormalization, /`MODEL`/);
  assert.match(inputNormalization, /`default_provider`/);
  assert.match(inputNormalization, /`api_key`/);
  assert.match(inputNormalization, /`default_model`/);
  assert.match(inputNormalization, /`default-provider`/);
  assert.match(inputNormalization, /`api-key`/);
  assert.match(inputNormalization, /`default-model`/);
  assert.match(inputNormalization, /`zeroclaw props set api-key`/);
  assert.match(inputNormalization, /`zeroclaw onboard`/);
  assert.match(inputNormalization, /`zeroclaw props`/);
  assert.doesNotMatch(inputNormalization, /opencode-setup/);
  assert.doesNotMatch(inputNormalization, /provider\.gonkagate/);
  assert.doesNotMatch(inputNormalization, /chat_completions/);

  assert.match(evals, /~\/\.zeroclaw\/config\.toml/);
  assert.match(evals, /npx zeroclaw-setup/);
  assert.match(evals, /default_provider/);
  assert.match(evals, /ZEROCLAW_CONFIG_DIR/);
  assert.match(evals, /ZEROCLAW_WORKSPACE/);
  assert.match(evals, /zeroclaw onboard/);
  assert.doesNotMatch(evals, /opencode-setup/);
  assert.doesNotMatch(evals, /provider\.gonkagate/);
  assert.doesNotMatch(evals, /chat_completions/);
});
