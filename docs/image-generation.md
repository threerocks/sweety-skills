# Image Generation Guidelines

Skills that require image generation MUST delegate to available image generation skills.

## Skill Selection

**Default**: `skills/sweety-image-gen/SKILL.md` (unless user specifies otherwise).

1. Read skill's SKILL.md for parameters and capabilities
2. If user requests different skill, check `skills/` for alternatives
3. Only ask user when multiple viable options exist

## Generation Flow Template

```markdown
### Step N: Generate Images

**Skill Selection**:
1. Check available skills (`sweety-image-gen` default, or `sweety-danger-gemini-web`)
2. Read selected skill's SKILL.md for parameters
3. If multiple skills available, ask user to choose

**Generation Flow**:
1. Call skill with prompt, output path, and skill-specific parameters
2. Generate sequentially by default (batch parallel only when user has multiple prompts)
3. Output progress: "Generated X/N"
4. On failure, auto-retry once before reporting error
```

**Batch Parallel** (`sweety-image-gen` only): concurrent workers with per-provider throttling via `batch.max_workers` in EXTEND.md.

## Output Path Convention

**Output Directory**: `<skill-suffix>/<topic-slug>/`
- `<skill-suffix>`: e.g., `xhs-images`, `cover-image`, `slide-deck`, `comic`
- `<topic-slug>`: 2-4 words, kebab-case from content topic
- Conflict: append timestamp `<topic-slug>-YYYYMMDD-HHMMSS`

**Source Files**: Copy to output dir as `source-{slug}.{ext}`

## Image Naming Convention

**Format**: `NN-{type}-[slug].png`
- `NN`: Two-digit sequence (01, 02, ...)
- `{type}`: cover, content, page, slide, illustration, etc.
- `[slug]`: 2-5 word kebab-case descriptor, unique within directory

Examples:
```
01-cover-ai-future.png
02-content-key-benefits.png
03-slide-architecture-overview.png
```
