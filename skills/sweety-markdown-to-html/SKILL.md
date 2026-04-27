---
name: sweety-markdown-to-html
description: 将 Markdown 转换为带样式的 HTML，支持 14 种主题风格，可根据内容自动匹配最佳主题。支持代码高亮、数学公式、PlantUML、脚注、警告块、信息图、底部引用等。适用于微信公众号、掘金、Twitter/X、GitHub 等平台。当用户说"markdown to html"、"md 转 html"、"微信外链转底部引用"、"转换成 html"或需要将 Markdown 生成带样式的 HTML 时触发。
version: 1.56.1
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-markdown-to-html
    requires:
      anyBins:
        - bun
        - npx
---

# Markdown 转 HTML 转换器

将 Markdown 文件转换为带内联 CSS 的精美 HTML，支持 14 种主题风格，针对微信公众号、掘金、Twitter/X 等平台优化。

## 脚本目录

**Agent 执行说明**: 将此 SKILL.md 所在目录定为 `{baseDir}`。解析 `${BUN_X}` 运行时: 若已安装 `bun` → `bun`; 若 `npx` 可用 → `npx -y bun`; 否则建议安装 bun。将 `{baseDir}` 和 `${BUN_X}` 替换为实际值。

| 脚本 | 用途 |
|------|------|
| `scripts/main.ts` | 主入口 |

## 偏好设置 (EXTEND.md)

检查 EXTEND.md 是否存在（优先级从高到低）:

```bash
# macOS, Linux, WSL, Git Bash
test -f .sweety-skills/sweety-markdown-to-html/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-markdown-to-html/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-markdown-to-html/EXTEND.md" && echo "user"
```

```powershell
# PowerShell (Windows)
if (Test-Path .sweety-skills/sweety-markdown-to-html/EXTEND.md) { "project" }
$xdg = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { "$HOME/.config" }
if (Test-Path "$xdg/sweety-skills/sweety-markdown-to-html/EXTEND.md") { "xdg" }
if (Test-Path "$HOME/.sweety-skills/sweety-markdown-to-html/EXTEND.md") { "user" }
```

┌──────────────────────────────────────────────────────────────┬───────────────────┐
│                             路径                             │       位置        │
├──────────────────────────────────────────────────────────────┼───────────────────┤
│ .sweety-skills/sweety-markdown-to-html/EXTEND.md               │ 项目目录          │
├──────────────────────────────────────────────────────────────┼───────────────────┤
│ $HOME/.sweety-skills/sweety-markdown-to-html/EXTEND.md         │ 用户主目录        │
└──────────────────────────────────────────────────────────────┴───────────────────┘

┌───────────┬─────────────────────────────┐
│   结果    │           动作              │
├───────────┼─────────────────────────────┤
│ 找到      │ 读取、解析、应用设置        │
├───────────┼─────────────────────────────┤
│ 未找到    │ 使用默认值                  │
└───────────┴─────────────────────────────┘

**EXTEND.md 支持**: 默认主题 | 自定义 CSS 变量 | 代码块样式

## 工作流

### 步骤 0: 预检查（中文内容）

**条件**: 仅当输入文件包含中文文本时执行。

**检测方法**:
1. 读取输入 Markdown 文件
2. 检查内容是否包含 CJK 字符（中文/日文/韩文）
3. 若无 CJK 内容 → 跳至步骤 1

**格式化建议**:

如果检测到 CJK 内容且 `sweety-format-markdown` 技能可用:

使用 `AskUserQuestion` 询问是否先格式化。格式化可修复:
- 加粗标记与标点符号混排导致的 `**` 解析失败
- 中英文间距问题

**若用户同意**: 调用 `sweety-format-markdown` 技能格式化文件，然后使用格式化后的文件作为输入。

**若用户拒绝**: 继续使用原始文件。

### 步骤 1: 确定主题

**主题解析顺序**（首次匹配生效）:
1. 用户明确指定的主题（CLI `--theme` 或对话中指定）
2. 用户使用了 `--auto` 标志 → 根据内容自动匹配最佳主题
3. EXTEND.md 中的 `default_theme`（本技能的 EXTEND.md）
4. `sweety-post-to-wechat` 的 EXTEND.md 中的 `default_theme`（跨技能回退）
5. 若以上均未找到 → 使用 AskUserQuestion 确认

**内容自动匹配**（使用 `--auto` 标志时）:

脚本会分析 Markdown 内容的以下特征来自动选择最佳主题:
- 代码块数量和密度
- 中文占比
- 标题/表格/图片/列表数量
- 段落平均长度
- 技术关键词、文学关键词、节日关键词等
- 目标平台提示（通过 `--platform` 参数）

**跨技能 EXTEND.md 检查**（仅当本技能 EXTEND.md 无 `default_theme` 时）:

```bash
test -f "$HOME/.sweety-skills/sweety-post-to-wechat/EXTEND.md" && grep -o 'default_theme:.*' "$HOME/.sweety-skills/sweety-post-to-wechat/EXTEND.md"
```

```powershell
if (Test-Path "$HOME/.sweety-skills/sweety-post-to-wechat/EXTEND.md") { Select-String -Pattern 'default_theme:.*' -Path "$HOME/.sweety-skills/sweety-post-to-wechat/EXTEND.md" | ForEach-Object { $_.Matches.Value } }
```

**若从 EXTEND.md 解析到主题**: 直接使用，不询问用户。

**若未找到默认主题**: 使用 AskUserQuestion 确认，展示主题列表（见下方「主题列表与使用建议」）。

### 步骤 1.5: 确定引用模式

**默认**: 关闭。不主动询问。

**仅在用户明确要求时启用**: "微信外链转底部引用"、"底部引用"、"文末引用"或传入 `--cite`。

**启用后的行为**:
- 普通外链渲染为编号上标，并收集到文末「引用链接」区域。
- `https://mp.weixin.qq.com/...` 链接保持为直接链接，不移至底部。
- 链接文本等于 URL 的裸链接保持内联。

### 步骤 2: 转换

```bash
# 指定主题
${BUN_X} {baseDir}/scripts/main.ts <markdown_file> --theme <theme> [--cite]

# 自动匹配主题
${BUN_X} {baseDir}/scripts/main.ts <markdown_file> --auto [--platform <platform>] [--cite]
```

### 步骤 3: 报告结果

显示 JSON 结果中的输出路径。如果创建了备份，提及备份路径。若使用了 `--auto`，显示匹配到的主题名和匹配原因。

## 用法

```bash
${BUN_X} {baseDir}/scripts/main.ts <markdown_file> [选项]
```

**选项:**

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--theme <name>` | 主题名（见下方主题列表） | default |
| `--auto` | 根据内容自动匹配最佳主题 | |
| `--platform <name>` | 目标平台提示，配合 `--auto` 使用 (juejin, wechat, twitter, github) | |
| `--color <name\|hex>` | 主色调: 预设名或十六进制值 | 主题默认值 |
| `--font-family <name>` | 字体: sans, serif, serif-cjk, mono, 或 CSS 值 | 主题默认值 |
| `--font-size <N>` | 字号: 14px, 15px, 16px, 17px, 18px | 16px |
| `--title <title>` | 覆盖 frontmatter 中的标题 | |
| `--code-theme <name>` | 代码高亮主题 | github |
| `--mac-code-block` | 显示 Mac 风格代码块头 | true |
| `--no-mac-code-block` | 隐藏 Mac 风格代码块头 | |
| `--line-number` | 显示代码块行号 | false |
| `--cite` | 将普通外链转为底部引用，追加「引用链接」区域 | false |
| `--count` | 显示阅读时间/字数统计 | false |
| `--legend <value>` | 图片说明: title-alt, alt-title, title, alt, none | alt |
| `--keep-title` | 保留正文首标题 | false (移除) |
| `--help` | 显示帮助 | |

**颜色预设:**

| 名称 | 色值 | 说明 |
|------|------|------|
| blue | #0F4C81 | 经典蓝 |
| green | #009874 | 翡翠绿 |
| vermilion | #FA5151 | 朱砂红 |
| yellow | #FECE00 | 柠檬黄 |
| purple | #92617E | 薰衣草紫 |
| sky | #55C9EA | 天空蓝 |
| rose | #B76E79 | 玫瑰金 |
| olive | #556B2F | 橄榄绿 |
| black | #333333 | 石墨黑 |
| gray | #A9A9A9 | 烟灰色 |
| pink | #FFB7C5 | 樱花粉 |
| red | #A93226 | 中国红 |
| orange | #D97757 | 暖橙色 (modern 主题默认) |

**示例:**

```bash
# 基本转换（使用默认主题，移除首标题）
${BUN_X} {baseDir}/scripts/main.ts article.md

# 自动匹配最佳主题
${BUN_X} {baseDir}/scripts/main.ts article.md --auto

# 自动匹配 + 指定目标平台
${BUN_X} {baseDir}/scripts/main.ts article.md --auto --platform wechat

# 指定主题
${BUN_X} {baseDir}/scripts/main.ts article.md --theme grace

# 主题 + 自定义颜色
${BUN_X} {baseDir}/scripts/main.ts article.md --theme modern --color red

# 启用底部引用
${BUN_X} {baseDir}/scripts/main.ts article.md --cite

# 保留首标题
${BUN_X} {baseDir}/scripts/main.ts article.md --keep-title

# 覆盖标题
${BUN_X} {baseDir}/scripts/main.ts article.md --title "我的文章"
```

## 输出

**文件位置**: 与输入 Markdown 同目录。
- 输入: `/path/to/article.md`
- 输出: `/path/to/article.html`

**冲突处理**: 若 HTML 文件已存在，先备份:
- 备份: `/path/to/article.html.bak-YYYYMMDDHHMMSS`

**标准输出 JSON:**

```json
{
  "title": "文章标题",
  "author": "作者",
  "summary": "文章摘要...",
  "htmlPath": "/path/to/article.html",
  "backupPath": "/path/to/article.html.bak-20260128180000",
  "autoTheme": "juejin",
  "autoThemeReason": "代码块多、技术关键词多，适合技术博客风格",
  "contentImages": [
    {
      "placeholder": "MDTOHTMLIMGPH_1",
      "localPath": "/path/to/img.png",
      "originalPath": "imgs/image.png"
    }
  ]
}
```

## 主题列表与使用建议

共 14 种主题，覆盖技术博客、文学散文、社交媒体、品牌展示等场景。

### 通用主题

| 主题 | 风格描述 | 推荐场景 | 默认主色 |
|------|----------|----------|----------|
| `default` | **经典** — 居中标题带底线，H2 白字彩色背景，传统排版 | 通用场景，微信公众号日常推文 | #0F4C81 蓝 |
| `grace` | **优雅** — 文字阴影、圆角卡片、精致引用块 (by @brzhang) | 图文混排、生活方式、品牌故事 | #92617E 紫 |
| `simple` | **简洁** — 现代极简、不对称圆角、留白干净 (by @okooo5km) | 产品发布、设计类内容、干净排版 | #009874 绿 |
| `modern` | **现代** — 大圆角药丸标题、宽松行距、现代感（搭配 `--color red` 为传统红金风格） | 公众号深度文章、Newsletter | #D97757 橙 |

### 平台优化主题

| 主题 | 风格描述 | 推荐场景 | 默认主色 |
|------|----------|----------|----------|
| `juejin` | **掘金风格** — 蓝色科技感，H2 左蓝边，H3 带蓝色 `#` 前缀，代码块友好 | 掘金发文、技术博客、编程教程 | #1e80ff 蓝 |
| `github` | **GitHub 风格** — 经典 GitHub Markdown 渲染，底线标题，斑马纹表格 | GitHub README、技术文档、开源项目 | #0969da 蓝 |
| `wechat-elegant` | **微信优雅** — WeChat 绿点缀，行距宽松适合移动端，H2 绿色圆角块 | 微信公众号首选，移动端长文阅读 | #07c160 绿 |
| `condensed` | **紧凑风格** — 紧凑布局粗体标题，内容密度最大化 | Twitter/X 分享、Newsletter、信息密集型内容 | #1a1a2e 深蓝 |

### 文学与文化主题

| 主题 | 风格描述 | 推荐场景 | 默认主色 |
|------|----------|----------|----------|
| `ink` | **水墨风格** — 衬线中文字体，宽行距，段首缩进，标题下短墨线 | 散文随笔、文化评论、文学类内容 | #2c3e50 墨色 |
| `typewriter` | **打字机风格** — 等宽字体，双线标题，段首缩进，复古文字质感 | 书评、日记、个人随笔、技术手册 | #5b4636 棕 |
| `chinese-red` | **中国红** — 红金配色，衬线中文字体，H2 带金色 ◆ 装饰 | 节日推送、传统文化、国风类内容 | #c1272d 红 |

### 专业与风格化主题

| 主题 | 风格描述 | 推荐场景 | 默认主色 |
|------|----------|----------|----------|
| `tech-blue` | **科技蓝** — 深蓝专业色调，H2 蓝底白字标签，H4 带 ▸ 前缀 | 技术白皮书、研究报告、专业文档 | #1a365d 深蓝 |
| `minimalist` | **极简风** — 超轻字重标题，无装饰分隔线，破折号列表标记 | 设计类内容、高端品牌、产品说明 | #333333 黑 |
| `warm` | **暖色调** — 暖棕色调，药丸标题，虚线 H2 底线，圆角图片 | 读书笔记、生活博客、美食旅行 | #8b5e3c 棕 |

### 主题自动匹配规则

使用 `--auto` 标志时，脚本会自动分析内容特征并匹配最佳主题:

| 内容特征 | 匹配主题 | 匹配逻辑 |
|----------|----------|----------|
| 代码块 ≥5 且有技术关键词 | `juejin` | 技术博客内容，掘金风格最佳 |
| 代码块多且英文为主 | `github` | 英文技术文档，GitHub 风格更自然 |
| 中文比例高 + 文学关键词 | `ink` | 中文文学内容，水墨风格更有意境 |
| 含节日/传统文化关键词 | `chinese-red` | 文化类内容，红金配色更应景 |
| 表格多 + 标题多 + 长文 | `tech-blue` | 结构化专业文档，科技蓝更严肃 |
| 图片多 + 代码少 | `minimalist` | 视觉内容为主，极简风突出图片 |
| 中等长度段落 + 图文混合 | `warm` | 混合内容，暖色调提升舒适度 |
| 长段落纯文字 + 无代码 | `typewriter` | 纯文字叙述，打字机风增强质感 |
| 短内容 ≤1500 字 | `condensed` | 短内容紧凑排版更紧凑 |
| 中文为主 + 图文并茂 | `wechat-elegant` | 微信风格阅读体验优化 |

使用 `--platform` 可直接指定目标平台，优先级最高:
- `--platform juejin` / `--platform 掘金` → `juejin`
- `--platform wechat` / `--platform 微信` / `--platform 公众号` → `wechat-elegant`
- `--platform twitter` / `--platform x.com` → `condensed`
- `--platform github` → `github`

## 支持的 Markdown 功能

| 功能 | 语法 |
|------|------|
| 标题 | `# H1` 到 `###### H6` |
| 粗体/斜体 | `**粗体**`、`*斜体*` |
| 代码块 | ` ```lang ` 带语法高亮 |
| 行内代码 | `` `code` `` |
| 表格 | GitHub 风格 Markdown 表格 |
| 图片 | `![alt](src)` |
| 链接 | `[text](url)`; 添加 `--cite` 将普通外链移入底部引用 |
| 引用块 | `> quote` |
| 列表 | `-` 无序, `1.` 有序 |
| 警告块 | `> [!NOTE]`、`> [!WARNING]` 等 |
| 脚注 | `[^1]` 引用 |
| 注音 | `{底字|标注}` |
| Mermaid | ` ```mermaid ` 图表 |
| PlantUML | ` ```plantuml ` 图表 |

## Frontmatter

支持 YAML frontmatter 元数据:

```yaml
---
title: 文章标题
author: 作者名
description: 文章摘要
---
```

若未找到标题，会从首个 H1/H2 标题提取或使用文件名。

## 扩展配置

通过 EXTEND.md 进行自定义配置。详见上方「偏好设置」部分了解路径和支持的选项。
