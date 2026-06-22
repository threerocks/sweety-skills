# Sweety Post To Juejin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `sweety-post-to-juejin` as a safe draft-first Codex skill for posting Markdown originals to Juejin.

**Architecture:** The skill uses a browser-first workflow so credentials stay inside the logged-in Chrome session. Pure parsing and validation logic lives in a small TypeScript module with Bun tests; the browser script consumes that contract and only saves drafts by default.

**Tech Stack:** Codex skill metadata, TypeScript via Bun, `sweety-chrome-cdp`, Bun test runner, Codex `quick_validate.py`.

---

### Task 1: Skill Contract And Pure Logic

**Files:**
- Create: `skills/sweety-post-to-juejin/SKILL.md`
- Create: `skills/sweety-post-to-juejin/agents/openai.yaml`
- Create: `skills/sweety-post-to-juejin/references/fields.md`
- Create: `skills/sweety-post-to-juejin/references/editor-behavior.md`
- Create: `skills/sweety-post-to-juejin/references/stop-conditions.md`
- Create: `skills/sweety-post-to-juejin/scripts/juejin-draft.ts`
- Create: `skills/sweety-post-to-juejin/scripts/juejin-draft.test.ts`
- Create: `skills/sweety-post-to-juejin/scripts/package.json`

- [x] Write failing tests for Markdown frontmatter parsing, tag limits, required fields, and default `draft` mode.
- [x] Run the tests and confirm they fail because implementation files are missing.
- [x] Implement the minimal pure logic.
- [x] Run tests and confirm they pass.

### Task 2: Browser Draft Script

**Files:**
- Create: `skills/sweety-post-to-juejin/scripts/juejin-browser.ts`
- Create: `skills/sweety-post-to-juejin/scripts/juejin-utils.ts`
- Create: `skills/sweety-post-to-juejin/scripts/check-permissions.ts`

- [x] Implement CLI parsing that delegates field validation to `juejin-draft.ts`.
- [x] Launch or reuse isolated Chrome profile via `sweety-chrome-cdp`.
- [x] Fill Juejin title and Markdown editor, upload cover when supplied, then leave the page at draft/review state by default.
- [x] Require explicit `--publish` before clicking publish controls.

### Task 3: Install, Verify, And Remove Old Conflict

**Files:**
- Install: `/Users/liulei/.codex/skills/sweety-post-to-juejin`
- Delete: `/Users/liulei/.agents/skills/publish-to-juejin`

- [x] Validate repo skill with `quick_validate.py`.
- [x] Sync repo skill to Codex skill directory.
- [x] Validate installed skill with `quick_validate.py`.
- [x] Confirm repo and installed skill are identical with `diff -qr`.
- [x] Delete the old non-Codex `publish-to-juejin` skill after new skill validation passes.
