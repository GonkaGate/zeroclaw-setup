---
name: coding-prompt-normalizer
description: "Turn rough, mixed-language, speech-to-text-like, repetitive, or partially specified coding requests into a high-signal task context brief and handoff prompt for agents working inside `zeroclaw-setup`. Use when the hard part is reconstructing what the user wants, preserving exact signals, deduplicating messy notes, grounding repo assumptions, or making a downstream LLM understand the task correctly. Prompt polish is secondary; the job is intent/context reconstruction plus repo-aware handoff packaging, not literal translation."
---

# Coding Prompt Normalizer

## Purpose

Turn noisy user task descriptions into context-rich handoff prompts that help a
coding agent understand the user's real task and start in the right place in
`zeroclaw-setup`.

The primary deliverable is not a polished prompt. The primary deliverable is an
accurate task context model: what the user wants, which exact signals matter,
what this repository implies, what is missing, and which assumptions are safe
enough to carry forward. The final handoff prompt is just the packaging for
that context.

Reconstruct intent, remove noise, preserve exact technical literals, choose the
right task mode, and inject only the repository context that materially changes
execution.

Be honest about the current state of the repository:

- this repo is a scaffold for `npx zeroclaw-setup`, not a shipped
  end-to-end ZeroClaw installer yet
- `PRD.md`, `README.md`, `AGENTS.md`, `docs/`, `src/cli.ts`, and `src/install/`
  are the main product-contract surfaces today
- the public CLI currently exposes scaffolded install and verify flows and
  intentionally does not mutate ZeroClaw config yet
- `src/install/` contains the planned seams for future ZeroClaw integration,
  not a finished config-writing runtime
- the current code already pins the intended GonkaGate ZeroClaw contract around
  `default_provider = "custom:https://api.gonkagate.com/v1"`, top-level
  `api_key`, top-level `default_model`, curated model selection, and
  provider-related env override checks

Do not normalize a prompt into a fake implementation brief for files or
behaviors that do not exist unless the user is explicitly asking to create
them.

## Use This Skill For

- rough notes, pasted chat fragments, or dictated transcripts
- mixed-language coding requests
- requests like "turn this into a normal prompt", "package this for an agent",
  or "rewrite this for Codex"
- repetitive, nonlinear, partially explained tasks where the downstream agent
  still needs accurate task context before it can act

## Do Not Use It For

- generic translation with no repository work
- writing the code, spec, or review itself; this skill prepares the context and
  handoff prompt
- inventing files, behaviors, or product decisions that the repo does not
  support

## Relationship To Neighbor Skills

- Use this skill first when the main problem is poor task phrasing.
- After the task context is reconstructed, downstream work may use repo skills
  such as `typescript-coder`, `technical-design-review`,
  `verification-before-completion`, or `spec-first-brainstorming`.
- Do not turn this skill into a replacement for those domain skills. Its job is
  to create a better starting context and handoff, not to own the whole
  workflow.

## Workflow

1. Capture and normalize the raw input.
   - Load `references/input-normalization.md`.
   - Remove filler, loops, false starts, and duplicated fragments.
   - Keep code-like literals verbatim.
   - Treat repetition as evidence: collapse duplicates, but preserve repeated
     emphasis when it changes priority, urgency, or non-goals.
2. Infer the task mode.
   - Choose one primary mode:
     `implementation`, `bug-investigation`, `review-read-only`, `refactor`,
     `planning-spec`, `architecture-analysis`, `docs-and-messaging`, or
     `tooling-prompting`.
   - If two modes are present, choose the one that changes the downstream
     agent's first action.
3. Decide whether the request is ready for direct execution.
   - Use a direct coding prompt only when the requested change, likely target
     surface, and success criteria are sufficiently inferable, and the work
     looks like a bounded local change.
   - Default to `bug-investigation` when symptoms are clear but the fix is not.
   - Default to `planning-spec` or `architecture-analysis` when the request is
     too ambiguous for safe coding.
   - Default to `planning-spec` for non-trivial or hard-to-reverse work such as
     provider-wiring changes, onboarding delegation changes, config-resolution
     changes, secret-handling changes, env-override policy changes, or broad
     repository-wide refactors.
   - Review requests stay read-only.
4. Build the task context model.
   - Separate explicit user signals, repo-grounded facts, inferred assumptions,
     missing context, and open questions.
   - Preserve exact literals before interpreting them.
   - Keep uncertainty visible instead of smoothing it away for prompt polish.
5. Select repository context.
   - Load `references/repo-context-routing.md`.
   - Include only the repo facts, docs, constraints, and code areas that
     materially affect this task.
   - Prefer `2-5` targeted points over a project summary.
6. Compose the handoff prompt.
   - Do not mention the source language unless the user explicitly asks.
   - Default the output prompt to English because the repo docs, code, and
     agent instructions are English-first.
   - If the user explicitly requests another output language, honor that.
   - Write for an agent that already has repo access and knows how to inspect
     files, edit code, and navigate the workspace.
   - Keep the handoff dense, context-rich, and action-oriented.
7. Run a final quality gate.
   - No hallucinated files, requirements, or product decisions.
   - No generic stack dump.
   - Exact literals preserved.
   - User intent, repo facts, assumptions, and open questions are not blurred
     together.
   - Assumptions and open questions explicit where certainty is weak.

## Literal Preservation Rules

- Preserve exact file paths, CLI commands, env vars, code identifiers, config
  keys, model ids, field names, and domain terms verbatim.
- Wrap preserved literals in backticks inside the final handoff prompt.
- Do not "improve" or rename tokens like `~/.zeroclaw/config.toml`,
  `npx zeroclaw-setup`, `npx zeroclaw-setup verify`,
  `ZEROCLAW_CONFIG_DIR`, `ZEROCLAW_WORKSPACE`, `ZEROCLAW_PROVIDER`,
  `ZEROCLAW_MODEL_PROVIDER`, `MODEL_PROVIDER`, `PROVIDER`,
  `ZEROCLAW_MODEL`, `MODEL`, `ZEROCLAW_API_KEY`, `API_KEY`,
  `default_provider`, `api_key`, `default_model`,
  `default-provider`, `api-key`, `default-model`,
  `custom:https://api.gonkagate.com/v1`, `zeroclaw onboard`,
  `zeroclaw props`, `zeroclaw props get`,
  `zeroclaw props set --no-interactive`, `zeroclaw props set api-key`,
  `zeroclaw status`,
  `zeroclaw doctor`,
  `zeroclaw gateway`, `src/cli.ts`,
  `docs/specs/zeroclaw-setup-prd/spec.md`, or `PRD.md`.
- If transcript noise makes a literal uncertain, keep that uncertainty explicit.
  Use a phrase like `Possible original literal:` rather than silently
  normalizing it.
- Preserve user constraints exactly when they change execution:
  `read-only`, `do not edit files`, `no refactor`, `investigate first`,
  `do not touch docs`, `keep .claude and .agents in sync`,
  `do not pretend the runtime already exists`, `do not hand-roll TOML writes`,
  `keep the scaffold truthful`, `do not mutate ZeroClaw config yet`.

## Readiness Rules

Emit an `implementation` or `refactor` handoff only when all are true:

- the requested change is understandable
- the likely code area is narrow enough to inspect first
- ambiguity does not materially change the execution path
- the work does not appear to change fixed product invariants, onboarding
  strategy, secret-storage rules, config-resolution rules, env-override policy,
  or other hard-to-reverse behavior
- the target surface already exists, or the user is explicitly asking to create
  that new surface

Emit a `bug-investigation` handoff when any are true:

- the text is symptom-first or regression-first
- the root cause is unclear
- multiple ownership seams could explain the behavior
- the task may involve mismatch between docs, scaffold plans, and repository
  contract tests

Emit a `review-read-only` handoff when the user asks to inspect, review, audit,
or explicitly avoid edits.

Emit a `planning-spec` or `architecture-analysis` handoff when:

- the task is exploratory or cross-cutting
- requirements are incomplete
- the user asks for a plan, spec, or design direction
- the request touches provider configuration, onboarding delegation, secret
  storage, config precedence, workspace resolution, or other product-contract
  decisions
- resolving ambiguity is more important than coding immediately

Emit a `docs-and-messaging` handoff when the task is mainly about `README.md`,
`AGENTS.md`, `docs/`, `CHANGELOG.md`, or keeping the scaffold truthfully
described.

Emit a `tooling-prompting` handoff when the task is about local skills, prompt
rewriting, agent instructions, mirrored `.claude` and `.agents` assets, or
repo-local workflow surfaces.

When ambiguity remains high, keep `Assumptions` and `Open questions` short but
explicit. Do not hide uncertainty behind polished wording.

## Output Template

Adapt the sections to the mode. Default order:

- `Objective`
- `User intent and context`
- `Relevant repository context`
- `Likely relevant code areas / files`
- `Problem statement` or `Requested change`
- `Constraints / preferences / non-goals`
- `Acceptance criteria` or `Expected outcome`
- `Validation / verification`
- `Assumptions / open questions`

Mode-specific adjustments:

- `review-read-only`
  - say the task is read-only
  - ask for findings first
  - replace implementation acceptance criteria with review deliverable
    expectations
- `bug-investigation`
  - ask the agent to confirm the symptom path and identify root cause before
    coding
  - describe the expected evidence, likely seams, and what should be verified
- `planning-spec` and `architecture-analysis`
  - emphasize boundaries, risks, missing information, and candidate decisions
    rather than edits
- `docs-and-messaging`
  - emphasize user-visible truthfulness and keeping `README.md`, `AGENTS.md`,
    `docs/`, and `CHANGELOG.md` aligned when behavior changes
- `tooling-prompting`
  - keep repo context focused on local skills, prompts, mirrored workflow
    assets, and agent-facing support material

Use `User intent and context` to preserve the reconstructed ask, priority
signals, and missing context before listing repo facts. Keep the prompt compact.
Do not force all sections when `1-2` focused paragraphs do the job better.

## Context Handoff Rules

- Start with the real objective, not with "rewrite this prompt".
- Prefer concrete repo surfaces when they are grounded by the input or the
  repository.
- Turn vague references like "here", "this config", or "that flow" into
  hypotheses only when the repo strongly supports one interpretation.
- Separate grounded repo facts from assumptions.
- Mention the first files or docs to inspect when that is reasonably inferable.
- Keep validation realistic: focused tests, `npm run ci`, targeted doc sync
  checks, or specific workflow checks. Do not default to broad repo-wide
  validation unless the change is broad.
- Do not repeat repo-wide instructions unless they materially affect this task.
- Use the existing `src/` and `src/install/` surfaces when they are materially
  relevant, but keep repo context aligned with the current scaffold status.
- When the task touches a mirrored local skill, prefer keeping the `.claude`
  and `.agents` copies aligned unless the request says otherwise.
- Do not propose product changes like `.env` writing, shell profile edits,
  plain `--api-key`, or hand-rolled TOML mutation unless the user explicitly
  asks for a product-contract change and the prompt frames it as such.
- Do not optimize mainly for eloquence. A plain handoff with the right context
  is better than a polished prompt that hides uncertainty or user intent.

## Examples

### Example 1: Implementation Prompt

Input:

```text
Turn this into a context-rich handoff prompt for an agent. Tighten
`.claude/skills/coding-prompt-normalizer/SKILL.md` and
`test/skills-contract.test.ts` so the skill is ZeroClaw-specific, preserves
`~/.zeroclaw/config.toml`, and removes stale OpenCode wording. Keep the change
small and keep `.agents` in sync.
```

Output:

```text
Objective
Make the smallest change needed to adapt the local `coding-prompt-normalizer`
skill to `zeroclaw-setup`, preserving `~/.zeroclaw/config.toml` as an exact
literal, removing stale OpenCode-specific wording, and keeping the mirrored
`.agents` copy aligned.

Relevant repository context
- This repository is still a scaffold for `npx zeroclaw-setup`, so prompt
  assets should reflect the current repo truth rather than pretend the full
  ZeroClaw installer runtime already exists.
- Local agent-support assets are mirrored under `.claude/skills/` and
  `.agents/skills/`; changes to one copy should normally be reflected in the
  other.
- Repository-contract checks live under `test/package-contract.test.ts`,
  `test/docs-contract.test.ts`, and `test/skills-contract.test.ts`.

Likely relevant code areas / files
- `.claude/skills/coding-prompt-normalizer/SKILL.md`
- `.claude/skills/coding-prompt-normalizer/references/`
- `.claude/skills/coding-prompt-normalizer/evals/evals.json`
- `.agents/skills/coding-prompt-normalizer/`
- `test/skills-contract.test.ts`

Requested change
Inspect the current skill content, replace OpenCode-specific repo assumptions
with ZeroClaw-specific ones, update stale literals or examples, and add the
smallest verification needed so the skill does not regress back to the old
project wording.

Validation / verification
- Run the relevant repository-contract test slice or `npm run ci`.
- Confirm the updated skill preserves exact literals such as
  `~/.zeroclaw/config.toml`.
- Confirm the `.claude` and `.agents` copies remain aligned.
```

### Example 2: Review Prompt

Input:

```text
Package this as a context-rich review handoff. Read-only. I think `README.md`
and `docs/how-it-works.md` may overstate what the current CLI actually does
around `npx zeroclaw-setup` and `default_provider`. Need findings first,
severity ordered, file anchors, focus on truthfulness and product contract.
```

Output:

```text
Objective
Perform a read-only truthfulness review of the current public product docs,
with findings first and ordered by severity.

Relevant repository context
- This repository is still scaffold-first, so docs should distinguish current
  scaffold behavior from future installer plans.
- `README.md` and `docs/how-it-works.md` are main contract surfaces for the
  `npx zeroclaw-setup` flow.
- stable `default_provider` is part of the planned ZeroClaw contract already
  pinned in repo constants and docs, so truthfulness matters even before the
  runtime is fully implemented.

Likely relevant code areas / files
- `README.md`
- `docs/how-it-works.md`
- `src/cli.ts`
- `PRD.md`
- `test/docs-contract.test.ts`

Review deliverable
Review the current repository in read-only mode. Report findings first,
ordered by severity, with file anchors. Focus on truthfulness, product
contract mismatches, and places where docs or scaffold behavior may mislead
users about what is currently implemented.
```
