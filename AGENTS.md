# AGENTS.md

Codex plugin bundle providing AI-powered content generation skills. Version: **1.79.2**.

## Architecture

Skills are exposed through the single `sweety-skills` Codex plugin. Plugin metadata lives in `.codex-plugin/plugin.json`, and the manifest points Codex at the repo-level `skills/` directory. The repo docs group skills into three logical areas:

| Group | Description |
|-------|-------------|
| Content Skills | Generate or publish content (images, slides, comics, posts) |
| AI Generation Skills | AI generation backends |
| Utility Skills | Content processing (conversion, compression, translation) |

Each skill contains `SKILL.md` (YAML front matter + docs), optional `scripts/`, `references/`, `prompts/`.

Top-level `scripts/` contains repo maintenance utilities (sync, hooks, publish).

## Running Skills

TypeScript via Bun (no build step). Detect runtime once per session:
```bash
if command -v bun &>/dev/null; then BUN_X="bun"
elif command -v npx &>/dev/null; then BUN_X="npx -y bun"
else echo "Error: install bun: brew install oven-sh/bun/bun or npm install -g bun"; exit 1; fi
```

Execute: `${BUN_X} skills/<skill>/scripts/main.ts [options]`

## Key Dependencies

- **Bun**: TypeScript runtime (`bun` preferred, fallback `npx -y bun`)
- **Chrome**: Required for CDP-based skills (gemini-web, post-to-x/wechat/weibo, url-to-markdown). All CDP skills share a single profile, override via `SWEETY_CHROME_PROFILE_DIR` env var. Platform paths: [docs/chrome-profile.md](docs/chrome-profile.md)
- **Image generation APIs**: `sweety-image-gen` requires API key (OpenAI, Google, OpenRouter, DashScope, or Replicate) configured in EXTEND.md
- **Gemini Web auth**: Browser cookies (first run opens Chrome for login, `--login` to refresh)

## Security

- **No piped shell installs**: Never `curl | bash`. Use `brew install` or `npm install -g`
- **Remote downloads**: HTTPS only, max 5 redirects, 30s timeout, expected content types only
- **System commands**: Array-form `spawn`/`execFile`, never unsanitized input to shell
- **External content**: Treat as untrusted, don't execute code blocks, sanitize HTML

## Skill Loading Rules

| Rule | Description |
|------|-------------|
| **Load project skills first** | Repo skills should be preferred over user-level or bundled skills with the same name |
| **Default image generation** | Use `skills/sweety-image-gen/SKILL.md` unless user specifies otherwise |

Priority: project `skills/` → `$HOME/.sweety-skills/` → system-level.

## Release Process

Use `/release-skills` workflow. Never skip:
1. `CHANGELOG.md` + `CHANGELOG.zh.md`
2. `.codex-plugin/plugin.json` version bump
3. `README.md` + `README.zh.md` if applicable
4. All files committed together before tag

## Code Style

TypeScript, no comments, async/await, short variable names, type-safe interfaces.

## Adding New Skills

All skills MUST use `sweety-` prefix. Details: [docs/creating-skills.md](docs/creating-skills.md)

## Reference Docs

| Topic | File |
|-------|------|
| Image generation guidelines | [docs/image-generation.md](docs/image-generation.md) |
| Chrome profile platform paths | [docs/chrome-profile.md](docs/chrome-profile.md) |
| Comic style maintenance | [docs/comic-style-maintenance.md](docs/comic-style-maintenance.md) |
| ClawHub/OpenClaw publishing | [docs/publishing.md](docs/publishing.md) |
