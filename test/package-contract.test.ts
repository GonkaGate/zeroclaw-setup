import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");

interface PackageJsonShape {
  readonly name: string;
  readonly scripts: Record<string, string>;
  readonly bin: Record<string, string>;
  readonly description: string;
  readonly files: readonly string[];
}

function readPackageJson(): PackageJsonShape {
  return JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  ) as PackageJsonShape;
}

test("package metadata matches the repository contract", () => {
  const packageJson = readPackageJson();

  assert.equal(packageJson.name, "zeroclaw-setup");
  assert.doesNotMatch(packageJson.description, /Scaffolded CLI/i);
  assert.match(
    packageJson.description,
    /configuring ZeroClaw to use GonkaGate/i,
  );
  assert.equal(packageJson.bin["zeroclaw-setup"], "bin/zeroclaw-setup.js");
  assert.equal(typeof packageJson.scripts.ci, "string");
  assert.equal(typeof packageJson.scripts.lint, "string");
  assert.equal(packageJson.files.includes("dist"), true);
});
