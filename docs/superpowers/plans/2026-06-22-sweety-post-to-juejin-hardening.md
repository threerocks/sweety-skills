# Sweety Post To Juejin Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `sweety-post-to-juejin` from a best-effort draft helper into a verified Juejin-ready publishing prep skill for real X/plain-text article migration.

**Architecture:** Keep content parsing and Markdown shaping in pure TypeScript so it is testable without a browser. Keep browser automation focused on page state, and fail closed when required cover upload or required publish settings cannot be proven.

**Tech Stack:** Codex skill metadata, TypeScript via Bun, `sweety-chrome-cdp`, Bun test runner, Codex `quick_validate.py`.

---

### Task 1: Juejin Markdown Shaping

**Files:**
- Modify: `skills/sweety-post-to-juejin/scripts/juejin-draft.ts`
- Modify: `skills/sweety-post-to-juejin/scripts/juejin-draft.test.ts`

- [ ] Add failing tests for converting X/plain-text paragraphs into readable Juejin Markdown without changing paragraph text.
- [ ] Implement Markdown shaping with code fences for formula lines and heading promotion for short section-like lines.
- [ ] Verify Markdown shaping preserves already formatted Markdown.

### Task 2: Fail-Closed Browser Settings

**Files:**
- Modify: `skills/sweety-post-to-juejin/scripts/juejin-browser.ts`
- Create: `skills/sweety-post-to-juejin/scripts/juejin-browser.test.ts`

- [ ] Add failing tests for scoped cover input selection and required cover upload failure.
- [ ] Scope summary, category, tags, and cover selectors to their form sections.
- [ ] Throw on requested cover upload failure instead of warning and silently continuing.

### Task 3: Skill Contract And Installed Copy

**Files:**
- Modify: `skills/sweety-post-to-juejin/SKILL.md`
- Modify: `/Users/liulei/.codex/skills/sweety-post-to-juejin`

- [ ] Document Chrome profile choice, X/plain-text migration behavior, and cover upload stop conditions.
- [ ] Sync repo skill to the installed Codex skill directory.
- [ ] Run repo tests, installed tests, `quick_validate.py`, and `diff -qr`.
