---
name: sweety-article-illustrator
description: 分析文章结构，识别需要视觉辅助的位置，通过类型×风格两维度方法生成配图。当用户说"为文章配图"、"添加插图"、"illustrate article"、"add images"、"generate images for article" 时使用。
version: 1.56.1
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-article-illustrator
---

# 文章配图生成器

分析文章、定位插图位置、生成类型×风格一致的配图。

## 两个维度

| 维度 | 控制 | 示例 |
|------|------|------|
| **类型** | 信息结构 | infographic, scene, flowchart, comparison, framework, timeline |
| **风格** | 视觉美学 | notion, warm, minimal, blueprint, watercolor, elegant |

自由组合：`--type infographic --style blueprint`

也可使用预设：`--preset tech-explainer` → 一个参数搞定类型+风格。见[风格预设](references/style-presets.md)。

## 类型

| 类型 | 适用场景 |
|------|----------|
| `infographic` | 数据、指标、技术类 |
| `scene` | 叙事、情感类 |
| `flowchart` | 流程、工作流 |
| `comparison` | 并列对比、选项 |
| `framework` | 模型、架构 |
| `timeline` | 历史、演进 |

## 风格

见 [references/styles.md](references/styles.md) 了解核心风格、完整画廊和类型×风格兼容性。

## 工作流程

```
- [ ] 步骤 1：前置检查（EXTEND.md、参考文件、配置）
- [ ] 步骤 2：分析内容
- [ ] 步骤 3：确认设置（AskUserQuestion）
- [ ] 步骤 4：生成大纲
- [ ] 步骤 5：生成图片
- [ ] 步骤 6：完成
```

### 步骤 1：前置检查

**1.5 加载偏好设置 (EXTEND.md) ⛔ 阻塞**

```bash
# macOS, Linux, WSL, Git Bash
test -f .sweety-skills/sweety-article-illustrator/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-article-illustrator/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-article-illustrator/EXTEND.md" && echo "user"
```

```powershell
# PowerShell (Windows)
if (Test-Path .sweety-skills/sweety-article-illustrator/EXTEND.md) { "project" }
$xdg = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { "$HOME/.config" }
if (Test-Path "$xdg/sweety-skills/sweety-article-illustrator/EXTEND.md") { "xdg" }
if (Test-Path "$HOME/.sweety-skills/sweety-article-illustrator/EXTEND.md") { "user" }
```

| 结果 | 操作 |
|------|------|
| 已找到 | 读取、解析、显示摘要 |
| 未找到 | ⛔ 运行[首次设置](references/config/first-time-setup.md) |

完整流程：[references/workflow.md](references/workflow.md#step-1-pre-check)

### 步骤 2：分析

| 分析项 | 输出 |
|--------|------|
| 内容类型 | 技术 / 教程 / 方法论 / 叙事 |
| 目的 | 信息传达 / 可视化 / 想象力 |
| 核心论点 | 2-5 个要点 |
| 插图位置 | 哪些地方插图能增加价值 |

**关键**：隐喻 → 可视化底层概念，而非字面图像。

完整流程：[references/workflow.md](references/workflow.md#step-2-setup--analyze)

### 步骤 3：确认设置 ⚠️

**单次 AskUserQuestion，最多 4 个问题。Q1-Q2 必填。Q3 在未选预设时必填。**

| 问题 | 选项 |
|------|------|
| **Q1：预设或类型** | [推荐预设]、[备选预设]，或手动选择：infographic, scene, flowchart, comparison, framework, timeline, mixed |
| **Q2：密度** | minimal (1-2张), balanced (3-5张), per-section (推荐), rich (6+张) |
| **Q3：风格** | [推荐]、minimal-flat、sci-fi、hand-drawn、editorial、scene、poster、其他 — **已选预设时跳过** |
| Q4：语言 | 当文章语言 ≠ EXTEND.md 设置时 |

完整流程：[references/workflow.md](references/workflow.md#step-3-confirm-settings-)

### 步骤 4：生成大纲

保存 `outline.md`，包含前置元数据（type, density, style, image_count）和条目：

```yaml
## 插图 1
**位置**: [章节/段落]
**目的**: [为什么]
**视觉内容**: [什么]
**文件名**: 01-infographic-concept-name.png
```

完整模板：[references/workflow.md](references/workflow.md#step-4-generate-outline)

### 步骤 5：生成图片

⛔ **阻塞：提示词文件必须在任何图片生成之前保存。**

**执行策略**：当多张插图的提示词文件已保存且任务仅需生成时，优先使用 `sweety-image-gen` 批量模式（`build-batch.ts` → `--batchfile`），而非启动子代理。仅当每张图片仍需单独的提示词迭代或创意探索时使用子代理。

1. 为每张插图按 [references/prompt-construction.md](references/prompt-construction.md) 创建提示词文件
2. 保存到 `prompts/NN-{type}-{slug}.md`，包含 YAML 前置元数据
3. 提示词**必须**使用类型专用模板，包含结构化部分（ZONES / LABELS / COLORS / STYLE / ASPECT）
4. LABELS **必须**包含文章具体数据：实际数字、术语、指标、引用
5. **不要**在未保存提示词文件的情况下直接向 `--prompt` 传递即兴提示词
6. 选择生成技能，处理参考图（`direct`/`style`/`palette`）
7. 如果 EXTEND.md 启用了水印则应用
8. 从已保存的提示词文件生成；失败时重试一次

完整流程：[references/workflow.md](references/workflow.md#step-5-generate-images)

### 步骤 6：完成

在段落后插入 `![description]({relative-path}/NN-{type}-{slug}.png)`。路径根据输出目录设置，相对于文章文件计算。

```
文章配图完成！
文章：[path] | 类型：[type] | 密度：[level] | 风格：[style]
图片：X/N 已生成
```

## 输出目录

输出目录由 EXTEND.md 中的 `default_output_dir` 决定（在首次设置时配置）：

| `default_output_dir` | 输出路径 | Markdown 插入路径 |
|----------------------|----------|-------------------|
| `imgs-subdir`（默认） | `{article-dir}/imgs/` | `imgs/NN-{type}-{slug}.png` |
| `same-dir` | `{article-dir}/` | `NN-{type}-{slug}.png` |
| `illustrations-subdir` | `{article-dir}/illustrations/` | `illustrations/NN-{type}-{slug}.png` |
| `independent` | `illustrations/{topic-slug}/` | `illustrations/{topic-slug}/NN-{type}-{slug}.png`（相对于 cwd） |

所有辅助文件（大纲、提示词）保存在输出目录内：

```
{output-dir}/
├── outline.md
├── prompts/
│   └── NN-{type}-{slug}.md
└── NN-{type}-{slug}.png
```

当输入是**粘贴内容**（无文件路径）时，始终使用 `illustrations/{topic-slug}/`，并将 `source-{slug}.{ext}` 保存在旁边。

**Slug**：2-4 个单词，kebab-case。**冲突**：追加 `-YYYYMMDD-HHMMSS`。

## 图片修改

| 操作 | 步骤 |
|------|------|
| 编辑 | 更新提示词 → 重新生成 → 更新引用 |
| 添加 | 定位 → 提示词 → 生成 → 更新大纲 → 插入 |
| 删除 | 删除文件 → 移除引用 → 更新大纲 |

## 参考文档

| 文件 | 内容 |
|------|------|
| [references/workflow.md](references/workflow.md) | 详细流程 |
| [references/usage.md](references/usage.md) | 命令语法 |
| [references/styles.md](references/styles.md) | 风格画廊 |
| [references/style-presets.md](references/style-presets.md) | 预设快捷方式（类型+风格） |
| [references/prompt-construction.md](references/prompt-construction.md) | 提示词模板 |
| [references/config/first-time-setup.md](references/config/first-time-setup.md) | 首次设置 |
