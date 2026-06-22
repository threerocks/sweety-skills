---
name: sweety-trend-source-intake
description: Collects trend, hotspot, and source evidence for content projects with Firecrawl while preserving project judgment boundaries. Use when the user asks to research trends, pick topics or products automatically, find X/Twitter posts, gather platform signals, build a source evidence pack, or support content-line decisions across Sweety projects.
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-trend-source-intake
    requires:
      anyBins:
        - bun
        - npx
---

# Sweety Trend Source Intake

## Purpose

Use this skill to turn live web signals into auditable evidence packs for content decisions. Firecrawl is the collection layer; this skill is the evidence and boundary layer.

Do not treat scraped popularity as a final content decision. The output is a source pack for downstream project gates such as title trust, platform risk, image readability, character consistency, and publish boundaries.

## Workflow

1. Define the decision.
   - Write the content line, target project, candidate topic or product question, target platform, and what decision the evidence must support.
   - If the user only asks for automatic selection, make the decision "choose one executable direction", not "return a menu".

2. Load preferences.
   - Check `EXTEND.md` in this order:

```bash
test -f .sweety-skills/sweety-trend-source-intake/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-trend-source-intake/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-trend-source-intake/EXTEND.md" && echo "user"
```

   - If no `EXTEND.md` exists, continue with script defaults. Do not write secrets into `EXTEND.md`.
   - `FIRECRAWL_API_KEY` must come from the user shell, environment manager, or Firecrawl CLI auth, never from project files.
   - If non-interactive Codex commands cannot see a key configured in `~/.zshrc`, run the script through `zsh -ic '...'` or move the export to a private user-level environment file such as `~/.zshenv`.

3. Search first.
   - Use Firecrawl search to collect candidate URLs and snippets.
   - Prefer multiple focused queries over one broad query.
   - Use domain filters for platform-specific evidence such as `x.com`, `weibo.com`, official docs, or GitHub.

4. Scrape only selected URLs.
   - Scrape known authoritative pages, official docs, and selected posts after search results are reviewed.
   - X/Twitter scraping can be expensive and should be explicit via `--allow-x-scrape`.
   - Never bulk scrape X search results just because they rank high.

5. Write the evidence pack.
   - Save Markdown and JSON outputs.
   - Preserve URLs, timestamps, source platform, extraction method, and Firecrawl credits when returned.
   - State what cannot be claimed from the evidence.

6. Hand off to project judgment.
   - For WeChat/Xiaohongshu/public content, run downstream title, opening, platform-risk, and project-specific gates.
   - For image production, do not let trend evidence override visual identity, image realism, privacy, or continuity gates.

## Script Directory

**Important**: All scripts are located in the `scripts/` subdirectory of this skill.

**Agent Execution Instructions**:
1. Determine this SKILL.md file's directory path as `{baseDir}`
2. Script path = `{baseDir}/scripts/main.ts`
3. Resolve `${BUN_X}` runtime: if `bun` installed -> `bun`; if `npx` available -> `npx -y bun`; else suggest installing bun
4. Replace all `{baseDir}` and `${BUN_X}` in this document with actual values

**Script Reference**:
| Script | Purpose |
|---|---|
| `scripts/main.ts` | Collect Firecrawl search results and selected scrape evidence into Markdown and JSON packs |

## Usage

```bash
${BUN_X} {baseDir}/scripts/main.ts \
  --project duorou-wechat-content-studio \
  --line duorou-mom-outfit \
  --decision "choose one summer young-mom outfit direction" \
  --query "北京 夏季 年轻妈妈 通勤 防晒衫 穿搭" \
  --query "小红书 年轻妈妈 夏季 通勤 穿搭 防晒衫" \
  --limit 8 \
  --out articles/source-intake/mom-outfit
```

Search X without scraping posts:

```bash
${BUN_X} {baseDir}/scripts/main.ts \
  --project duorou-wechat-content-studio \
  --line technical-post \
  --decision "verify Firecrawl keyless discussion on X" \
  --query "Firecrawl keyless no API key" \
  --include-domain x.com \
  --limit 10 \
  --out articles/source-intake/firecrawl-keyless
```

Scrape selected X posts only when needed:

```bash
${BUN_X} {baseDir}/scripts/main.ts \
  --project duorou-wechat-content-studio \
  --line technical-post \
  --decision "read selected X posts about Firecrawl keyless" \
  --query "Firecrawl keyless no API key" \
  --include-domain x.com \
  --scrape-url "https://x.com/firecrawl/status/2066918976689754148" \
  --allow-x-scrape \
  --out articles/source-intake/firecrawl-keyless
```

## Options

| Option | Description |
|---|---|
| `--project <name>` | Project or repo using the evidence |
| `--line <name>` | Content line, such as `duorou-mom-outfit`, `shadow-outfit-short`, `technical-post` |
| `--decision <text>` | The concrete decision the source pack must support |
| `--query <text>` | Search query; repeatable |
| `--include-domain <domain>` | Restrict search to a domain; repeatable |
| `--exclude-domain <domain>` | Exclude a domain; repeatable |
| `--tbs <value>` | Firecrawl time filter, such as `qdr:w` |
| `--limit <n>` | Search result limit per query; default `10` |
| `--scrape-url <url>` | Selected URL to scrape; repeatable |
| `--scrape-top <n>` | Scrape top N search results after filtering; default `0` |
| `--allow-x-scrape` | Permit X/Twitter scraping |
| `--out <dir>` | Output directory; default `trend-source-intake/<timestamp>` |

## Evidence Rules

Read [references/evidence-contract.md](references/evidence-contract.md) when adapting this skill to a project workflow or when deciding whether evidence is strong enough to drive automated topic/product selection.

## Boundaries

- Firecrawl evidence can prove that a source exists and what it says. It cannot prove sales, inventory, personal experience, real purchase, or platform recommendation unless the source directly supports those claims.
- X/Twitter is strong for AI, tech, international, sports, and creator discourse. It is not the primary source for Chinese lifestyle product-market fit.
- Search results are discovery evidence. Scraped source pages are stronger. Official pages and original posts are stronger than summaries.
- Never store `FIRECRAWL_API_KEY` in a repo, article directory, run directory, final package, screenshot, or generated evidence file.

## Extension Support

Custom non-secret defaults may be stored in `EXTEND.md` at project, XDG, or user level. Supported keys:

| Key | Values | Purpose |
|---|---|---|
| `default_output_dir` | path | Default output directory |
| `default_limit` | number | Default search limit |
| `default_tbs` | Firecrawl tbs string | Default time filter |
| `allow_x_scrape` | `0` or `1` | Default permission for selected X scrapes |
