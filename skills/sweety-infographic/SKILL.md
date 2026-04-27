---
name: sweety-infographic
description: 生成专业信息图，支持 21 种布局和 20 种视觉风格。分析内容、推荐布局×风格组合，生成可发布的信息图。当用户说"生成信息图"、"信息图"、"可视化"、"高密度信息大图"、"infographic"、"visual summary" 时使用。
version: 1.56.1
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-infographic
---

# 信息图生成器

两个维度：**布局**（信息结构）× **风格**（视觉美学）。任意布局与任意风格自由组合。

## 用法

```bash
/sweety-infographic path/to/content.md
/sweety-infographic path/to/content.md --layout hierarchical-layers --style technical-schematic
/sweety-infographic path/to/content.md --aspect portrait --lang zh
/sweety-infographic path/to/content.md --aspect 3:4
/sweety-infographic  # 然后粘贴内容
```

## 选项

| 选项 | 说明 |
|------|------|
| `--layout` | 21 种布局（见布局画廊），默认：bento-grid |
| `--style` | 20 种风格（见风格画廊），默认：craft-handmade |
| `--aspect` | 预设：landscape (16:9)、portrait (9:16)、square (1:1)。自定义：任意 W:H 比例（如 3:4、4:3、2.35:1） |
| `--lang` | en, zh, ja 等 |

## 布局画廊

| 布局 | 适用场景 |
|------|----------|
| `linear-progression` | 时间线、流程、教程 |
| `binary-comparison` | A vs B、前后对比、优缺点 |
| `comparison-matrix` | 多因素对比 |
| `hierarchical-layers` | 金字塔、优先级层次 |
| `tree-branching` | 分类、层级体系 |
| `hub-spoke` | 中心概念与关联项 |
| `structural-breakdown` | 爆炸图、剖面图 |
| `bento-grid` | 多主题、概览（默认） |
| `iceberg` | 表面 vs 隐藏层面 |
| `bridge` | 问题-解决方案 |
| `funnel` | 转化、筛选漏斗 |
| `isometric-map` | 空间关系 |
| `dashboard` | 指标、KPI |
| `periodic-table` | 分类集合 |
| `comic-strip` | 叙事、序列 |
| `story-mountain` | 情节结构、张力弧线 |
| `jigsaw` | 相互关联的部分 |
| `venn-diagram` | 重叠概念 |
| `winding-roadmap` | 旅程、里程碑 |
| `circular-flow` | 循环、周期性流程 |
| `dense-modules` | 高密度模块、数据密集指南 |

完整定义：`references/layouts/<layout>.md`

## 风格画廊

| 风格 | 说明 |
|------|------|
| `craft-handmade` | 手绘、纸艺（默认） |
| `claymation` | 3D 黏土、定格动画 |
| `kawaii` | 日系可爱、粉彩 |
| `storybook-watercolor` | 柔和水彩、童话感 |
| `chalkboard` | 粉笔黑板 |
| `cyberpunk-neon` | 霓虹发光、未来感 |
| `bold-graphic` | 漫画风格、半调网点 |
| `aged-academia` | 复古科学、泛黄纸感 |
| `corporate-memphis` | 扁平矢量、活力配色 |
| `technical-schematic` | 蓝图、工程制图 |
| `origami` | 折纸、几何 |
| `pixel-art` | 复古 8-bit 像素 |
| `ui-wireframe` | 灰度界面线框 |
| `subway-map` | 地铁线路图 |
| `ikea-manual` | 极简线条画 |
| `knolling` | 有序平铺摆拍 |
| `lego-brick` | 乐高积木拼搭 |
| `pop-laboratory` | 蓝图网格、坐标标记、实验室精确感 |
| `morandi-journal` | 手绘涂鸦、莫兰迪暖色调 |
| `retro-pop-grid` | 1970s 复古波普、瑞士网格、粗轮廓 |

完整定义：`references/styles/<style>.md`

## 推荐组合

| 内容类型 | 布局 + 风格 |
|----------|-------------|
| 时间线/历史 | `linear-progression` + `craft-handmade` |
| 分步教程 | `linear-progression` + `ikea-manual` |
| A vs B | `binary-comparison` + `corporate-memphis` |
| 层级结构 | `hierarchical-layers` + `craft-handmade` |
| 重叠关系 | `venn-diagram` + `craft-handmade` |
| 转化漏斗 | `funnel` + `corporate-memphis` |
| 循环流程 | `circular-flow` + `craft-handmade` |
| 技术类 | `structural-breakdown` + `technical-schematic` |
| 数据指标 | `dashboard` + `corporate-memphis` |
| 教育类 | `bento-grid` + `chalkboard` |
| 旅程规划 | `winding-roadmap` + `storybook-watercolor` |
| 分类汇总 | `periodic-table` + `bold-graphic` |
| 产品指南 | `dense-modules` + `morandi-journal` |
| 技术指南 | `dense-modules` + `pop-laboratory` |
| 潮流指南 | `dense-modules` + `retro-pop-grid` |

默认：`bento-grid` + `craft-handmade`

## 关键词快捷方式

当用户输入包含以下关键词时，**自动选择**对应布局，并在步骤 3 中将关联风格作为首选推荐。跳过基于内容的布局推断。

如果快捷方式有**提示词附注**，则在生成提示词（步骤 5）时追加为额外的风格指令。

| 用户关键词 | 布局 | 推荐风格 | 默认比例 | 提示词附注 |
|------------|------|----------|----------|------------|
| 高密度信息大图 / high-density-info | `dense-modules` | `morandi-journal`, `pop-laboratory`, `retro-pop-grid` | portrait | — |
| 信息图 / infographic | `bento-grid` | `craft-handmade` | landscape | 极简风：干净画布、充足留白、无复杂背景纹理。仅使用简单卡通元素和图标。 |

## 输出结构

```
infographic/{topic-slug}/
├── source-{slug}.{ext}
├── analysis.md
├── structured-content.md
├── prompts/infographic.md
└── infographic.png
```

Slug 规则：2-4 个单词，kebab-case。冲突时追加 `-YYYYMMDD-HHMMSS`。

## 核心原则

- 忠实保留源数据——不做摘要或改写（但**输出前必须剥离任何凭证、API 密钥、令牌或密码**）
- 先确定学习目标，再组织内容结构
- 面向视觉传达进行结构化（标题、标签、视觉元素）

## 工作流程

### 步骤 1：设置与分析

**1.1 加载偏好设置 (EXTEND.md)**

检查 EXTEND.md 是否存在（优先级顺序）：

```bash
# macOS, Linux, WSL, Git Bash
test -f .sweety-skills/sweety-infographic/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-infographic/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-infographic/EXTEND.md" && echo "user"
```

```powershell
# PowerShell (Windows)
if (Test-Path .sweety-skills/sweety-infographic/EXTEND.md) { "project" }
$xdg = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { "$HOME/.config" }
if (Test-Path "$xdg/sweety-skills/sweety-infographic/EXTEND.md") { "xdg" }
if (Test-Path "$HOME/.sweety-skills/sweety-infographic/EXTEND.md") { "user" }
```

┌────────────────────────────────────────────────────┬───────────────────┐
│                        路径                        │       位置        │
├────────────────────────────────────────────────────┼───────────────────┤
│ .sweety-skills/sweety-infographic/EXTEND.md          │ 项目目录          │
├────────────────────────────────────────────────────┼───────────────────┤
│ $HOME/.sweety-skills/sweety-infographic/EXTEND.md    │ 用户主目录        │
└────────────────────────────────────────────────────┴───────────────────┘

┌──────────┬──────────────────────────────────────────────────────────────────────────────┐
│   结果   │                                     操作                                     │
├──────────┼──────────────────────────────────────────────────────────────────────────────┤
│ 已找到   │ 读取、解析、显示摘要                                                          │
├──────────┼──────────────────────────────────────────────────────────────────────────────┤
│ 未找到   │ 使用 AskUserQuestion 询问用户（见 references/config/first-time-setup.md）      │
└──────────┴──────────────────────────────────────────────────────────────────────────────┘

**EXTEND.md 支持**：偏好布局/风格 | 默认宽高比 | 自定义风格定义 | 语言偏好

Schema：`references/config/preferences-schema.md`

**1.2 分析内容 → `analysis.md`**

1. 保存源内容（文件路径或粘贴 → `source.md`）
   - **备份规则**：如果 `source.md` 已存在，重命名为 `source-backup-YYYYMMDD-HHMMSS.md`
2. 分析：主题、数据类型、复杂度、语调、目标受众
3. 检测源语言和用户语言
4. 提取用户输入中的设计指令
5. 保存分析结果
   - **备份规则**：如果 `analysis.md` 已存在，重命名为 `analysis-backup-YYYYMMDD-HHMMSS.md`

详细格式见 `references/analysis-framework.md`。

### 步骤 2：生成结构化内容 → `structured-content.md`

将内容转化为信息图结构：
1. 标题和学习目标
2. 各段落包含：核心概念、内容（原文照搬）、视觉元素、文字标签
3. 数据点（所有统计数据/引用原样复制）
4. 用户的设计指令

**规则**：仅 Markdown。不添加新信息。忠实保留数据。输出前剥离任何凭证或密码。

详细格式见 `references/structured-content-template.md`。

### 步骤 3：推荐组合

**3.1 先检查关键词快捷方式**：如果用户输入匹配**关键词快捷方式**表中的关键词，自动选择对应布局，并将关联风格作为首选推荐。跳过基于内容的布局推断。

**3.2 否则**，基于以下因素推荐 3-5 个布局×风格组合：
- 数据结构 → 匹配布局
- 内容语调 → 匹配风格
- 受众期望
- 用户设计指令

### 步骤 4：确认选项

使用**单次 AskUserQuestion 调用**包含多个问题，一次性确认所有选项：

| 问题 | 条件 | 选项 |
|------|------|------|
| **组合** | 始终询问 | 3+ 个布局×风格组合及理由 |
| **比例** | 始终询问 | 预设（landscape/portrait/square）或自定义 W:H 比例（如 3:4、4:3、2.35:1） |
| **语言** | 仅当源语言 ≠ 用户语言时 | 文本内容的语言 |

**重要**：不要拆分为多次 AskUserQuestion 调用。将所有适用问题合并为一次调用。

### 步骤 5：生成提示词 → `prompts/infographic.md`

**备份规则**：如果 `prompts/infographic.md` 已存在，重命名为 `prompts/infographic-backup-YYYYMMDD-HHMMSS.md`

组合以下内容：
1. 布局定义，来自 `references/layouts/<layout>.md`
2. 风格定义，来自 `references/styles/<style>.md`
3. 基础模板，来自 `references/base-prompt.md`
4. 步骤 2 的结构化内容
5. 所有文本使用确认的语言

**宽高比解析**（`{{ASPECT_RATIO}}`）：
- 预设名称 → 比例字符串：landscape→`16:9`、portrait→`9:16`、square→`1:1`
- 自定义 W:H 比例 → 直接使用（如 `3:4`、`4:3`、`2.35:1`）

### 步骤 6：生成图片

1. 选择可用的图像生成技能（如有多个则询问用户）
2. **检查已有文件**：生成前检查 `infographic.png` 是否存在
   - 如已存在：重命名为 `infographic-backup-YYYYMMDD-HHMMSS.png`
3. 调用生成技能，传入提示词文件和输出路径
4. 失败时自动重试一次

### 步骤 7：输出摘要

报告：主题、布局、风格、比例、语言、输出路径、已创建的文件。

## 参考文档

- `references/analysis-framework.md` - 分析方法论
- `references/structured-content-template.md` - 内容格式
- `references/base-prompt.md` - 提示词模板
- `references/layouts/<layout>.md` - 21 种布局定义
- `references/styles/<style>.md` - 20 种风格定义

## 扩展支持

通过 EXTEND.md 进行自定义配置。路径和支持的选项见**步骤 1.1**。
