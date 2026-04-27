# Creating New Skills

Use Codex skill authoring conventions: keep `SKILL.md` concise, put only trigger-critical metadata in frontmatter, and move optional details into one-level `references/` files.

## Key Requirements

| Requirement | Details |
|-------------|---------|
| **Prefix** | All skills MUST use `sweety-` prefix |
| **name field** | Max 64 chars, lowercase letters/numbers/hyphens only, no provider names or reserved agent names |
| **description** | Max 1024 chars, third person, include what + when to use |
| **SKILL.md body** | Keep under 500 lines; use `references/` for additional content |
| **References** | One level deep from SKILL.md; avoid nested references |

## SKILL.md Frontmatter Template

```yaml
---
name: sweety-<name>
description: <Third-person description. What it does + when to use it.>
version: <semver matching marketplace.json>
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-<name>
    requires:          # include only if skill has scripts
      anyBins:
        - bun
        - npx
---
```

## Steps

1. Create `skills/sweety-<name>/SKILL.md` with YAML front matter
2. Add TypeScript in `skills/sweety-<name>/scripts/` (if applicable)
3. Add prompt templates in `skills/sweety-<name>/prompts/` if needed
4. Confirm `.codex-plugin/plugin.json` exposes the repo-level `./skills/` directory
5. Add Script Directory section to SKILL.md if skill has scripts
6. Add openclaw metadata to frontmatter

## Skill Grouping

All skills are exposed through the single `sweety-skills` Codex plugin. Use these logical groups when deciding where the skill should appear in the docs:

| If your skill... | Use group |
|------------------|-----------|
| Generates visual content (images, slides, comics) | Content Skills |
| Publishes to platforms (X, WeChat, Weibo) | Content Skills |
| Provides AI generation backend | AI Generation Skills |
| Converts or processes content | Utility Skills |

If you add a new logical group, update the docs that present grouped skills; the Codex manifest should continue exposing the shared `./skills/` directory.

## Writing Descriptions

**MUST write in third person**:

```yaml
# Good
description: Generates Xiaohongshu infographic series from content. Use when user asks for "小红书图片", "XHS images".

# Bad
description: I can help you create Xiaohongshu images
```

## Script Directory Template

Every SKILL.md with scripts MUST include:

```markdown
## Script Directory

**Important**: All scripts are located in the `scripts/` subdirectory of this skill.

**Agent Execution Instructions**:
1. Determine this SKILL.md file's directory path as `{baseDir}`
2. Script path = `{baseDir}/scripts/<script-name>.ts`
3. Resolve `${BUN_X}` runtime: if `bun` installed → `bun`; if `npx` available → `npx -y bun`; else suggest installing bun
4. Replace all `{baseDir}` and `${BUN_X}` in this document with actual values

**Script Reference**:
| Script | Purpose |
|--------|---------|
| `scripts/main.ts` | Main entry point |
```

## Progressive Disclosure

For skills with extensive content:

```
skills/sweety-example/
├── SKILL.md              # Main instructions (<500 lines)
├── references/
│   ├── styles.md         # Loaded as needed
│   └── examples.md       # Loaded as needed
└── scripts/
    └── main.ts
```

Link from SKILL.md (one level deep only):
```markdown
**Available styles**: See [references/styles.md](references/styles.md)
```

## Extension Support (EXTEND.md)

Every SKILL.md MUST include EXTEND.md loading. Add as Step 1.1 (workflow skills) or "Preferences" section (utility skills):

```markdown
**1.1 Load Preferences (EXTEND.md)**

Check EXTEND.md existence (priority order):

\`\`\`bash
test -f .sweety-skills/<skill-name>/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/<skill-name>/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/<skill-name>/EXTEND.md" && echo "user"
\`\`\`

| Path | Location |
|------|----------|
| `.sweety-skills/<skill-name>/EXTEND.md` | Project directory |
| `$XDG_CONFIG_HOME/sweety-skills/<skill-name>/EXTEND.md` | XDG config (~/.config) |
| `$HOME/.sweety-skills/<skill-name>/EXTEND.md` | User home (legacy) |

| Result | Action |
|--------|--------|
| Found | Read, parse, display summary |
| Not found | Ask user with AskUserQuestion |
```

End of SKILL.md should include:
```markdown
## Extension Support
Custom configurations via EXTEND.md. See **Step 1.1** for paths and supported options.
```
