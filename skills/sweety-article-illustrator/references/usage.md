# Usage

## Command Syntax

```bash
# Auto-select type and style based on content
/sweety-article-illustrator path/to/article.md

# Specify type
/sweety-article-illustrator path/to/article.md --type infographic

# Specify style
/sweety-article-illustrator path/to/article.md --style blueprint

# Combine type and style
/sweety-article-illustrator path/to/article.md --type flowchart --style notion

# Specify density
/sweety-article-illustrator path/to/article.md --density rich

# Direct content input (paste mode)
/sweety-article-illustrator
[paste content]
```

## Options

| Option | Description |
|--------|-------------|
| `--type <name>` | Illustration type (see Type Gallery in SKILL.md) |
| `--style <name>` | Visual style (see references/styles.md) |
| `--preset <name>` | Shorthand for type + style combo (see [references/style-presets.md](references/style-presets.md)) |
| `--density <level>` | Image count: minimal / balanced / rich |

## Input Modes

| Mode | Trigger | Output Directory |
|------|---------|------------------|
| File path | `path/to/article.md` | Use `default_output_dir` preference, or ask if not set |
| Paste content | No path argument | `illustrations/{topic-slug}/` |

## Output Directory Options

| Value | Path |
|-------|------|
| `same-dir` | `{article-dir}/` |
| `illustrations-subdir` | `{article-dir}/illustrations/` |
| `independent` | `illustrations/{topic-slug}/` |

Configure in EXTEND.md: `default_output_dir: illustrations-subdir`

## Examples

**Technical article with data**:
```bash
/sweety-article-illustrator api-design.md --type infographic --style blueprint
```

**Same thing with preset**:
```bash
/sweety-article-illustrator api-design.md --preset tech-explainer
```

**Personal story**:
```bash
/sweety-article-illustrator journey.md --preset storytelling
```

**Tutorial with steps**:
```bash
/sweety-article-illustrator how-to-deploy.md --preset tutorial --density rich
```

**Opinion article with poster style**:
```bash
/sweety-article-illustrator opinion.md --preset opinion-piece
```

**Preset with override**:
```bash
/sweety-article-illustrator article.md --preset tech-explainer --style notion
```
