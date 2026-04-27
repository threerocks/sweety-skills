---
name: sweety-cover-image
description: 生成文章封面图，支持五维定制（类型、配色、渲染风格、文字、氛围），10 种配色方案和 7 种渲染风格。支持超宽 (2.35:1)、宽屏 (16:9)、方形 (1:1) 等比例。当用户说"生成封面"、"制作封面图"、"generate cover image"、"create article cover" 时使用。
version: 1.57.0
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-cover-image
---

# 封面图生成器

为文章生成优雅的封面图，支持五维度定制。

## 用法

```bash
# 根据内容自动选择维度
/sweety-cover-image path/to/article.md

# 快速模式：跳过确认
/sweety-cover-image article.md --quick

# 指定维度
/sweety-cover-image article.md --type conceptual --palette warm --rendering flat-vector

# 风格预设（配色 + 渲染的快捷组合）
/sweety-cover-image article.md --style blueprint

# 使用参考图
/sweety-cover-image article.md --ref style-ref.png

# 直接输入内容
/sweety-cover-image --palette mono --aspect 1:1 --quick
[粘贴内容]
```

## 选项

| 选项 | 说明 |
|------|------|
| `--type <name>` | hero, conceptual, typography, metaphor, scene, minimal |
| `--palette <name>` | warm, elegant, cool, dark, earth, vivid, pastel, mono, retro, duotone |
| `--rendering <name>` | flat-vector, hand-drawn, painterly, digital, pixel, chalk, screen-print |
| `--style <name>` | 预设快捷方式（见 [风格预设](references/style-presets.md)） |
| `--text <level>` | none, title-only, title-subtitle, text-rich |
| `--mood <level>` | subtle, balanced, bold |
| `--font <name>` | clean, handwritten, serif, display |
| `--aspect <ratio>` | 16:9（默认）, 2.35:1, 4:3, 3:2, 1:1, 3:4 |
| `--lang <code>` | 标题语言（en, zh, ja 等） |
| `--no-title` | 等同于 `--text none` |
| `--quick` | 跳过确认，使用自动选择 |
| `--ref <files...>` | 参考图片，用于风格/构图参考 |
| `--provider <name>` | 指定图像生成服务商（见下方模型调用链） |
| `--provider-order <list>` | 自定义服务商回退顺序，逗号分隔 |

## 五维度

| 维度 | 可选值 | 默认 |
|------|--------|------|
| **类型** | hero, conceptual, typography, metaphor, scene, minimal | 自动 |
| **配色** | warm, elegant, cool, dark, earth, vivid, pastel, mono, retro, duotone | 自动 |
| **渲染风格** | flat-vector, hand-drawn, painterly, digital, pixel, chalk, screen-print | 自动 |
| **文字** | none, title-only, title-subtitle, text-rich | title-only |
| **氛围** | subtle, balanced, bold | balanced |
| **字体** | clean, handwritten, serif, display | clean |

自动选择规则：[references/auto-selection.md](references/auto-selection.md)

## 画廊

**类型**：hero, conceptual, typography, metaphor, scene, minimal
→ 详情：[references/types.md](references/types.md)

**配色方案**：warm, elegant, cool, dark, earth, vivid, pastel, mono, retro, duotone
→ 详情：[references/palettes/](references/palettes/)

**渲染风格**：flat-vector, hand-drawn, painterly, digital, pixel, chalk, screen-print
→ 详情：[references/renderings/](references/renderings/)

**文字密度**：none（纯视觉）| title-only（默认）| title-subtitle | text-rich（含标签）
→ 详情：[references/dimensions/text.md](references/dimensions/text.md)

**氛围强度**：subtle（低对比度）| balanced（默认）| bold（高对比度）
→ 详情：[references/dimensions/mood.md](references/dimensions/mood.md)

**字体**：clean（无衬线）| handwritten | serif | display（粗体装饰）
→ 详情：[references/dimensions/font.md](references/dimensions/font.md)

## 文件结构

输出目录取决于 `default_output_dir` 偏好设置：
- `same-dir`：`{article-dir}/`
- `imgs-subdir`：`{article-dir}/imgs/`
- `independent`（默认）：`cover-image/{topic-slug}/`

```
<output-dir>/
├── source-{slug}.{ext}    # 原始文件
├── refs/                  # 参考图片（如有提供）
│   ├── ref-01-{slug}.{ext}
│   └── ref-01-{slug}.md   # 描述文件
├── prompts/cover.md       # 生成提示词
└── cover.png              # 输出图片
```

**Slug 规则**：2-4 个单词，kebab-case。冲突时追加 `-YYYYMMDD-HHMMSS`

## 模型调用链

封面图生成依赖 `sweety-image-gen` 技能。以下是模型调用的完整流程：

### 服务商优先级（默认）

未指定 `--provider` 时，实际执行顺序跟随底层 `sweety-image-gen` 的 provider fallback。当前推荐顺序：

| 优先级 | 服务商 | 默认模型 | 需要的环境变量 |
|--------|--------|----------|---------------|
| 1 | Google | gemini-3-pro-image-preview | `GOOGLE_API_KEY` 或 `GEMINI_API_KEY` |
| 2 | Relay（中转） | gemini-2.5-flash-image | `RELAY_API_KEY` |
| 3 | DashScope（通义万象） | qwen-image-2.0-pro | `DASHSCOPE_API_KEY` |
| 4 | 其它已配置服务商 | 各自默认模型 | 对应 API Key |

### 含参考图时的优先级

使用 `--ref` 时，仅选择支持参考图的服务商。
在推荐顺序下会优先尝试 `Google → Relay`，并自动跳过 `DashScope`。

### 超时与重试

| 参数 | 值 |
|------|----|
| 最大重试次数 | 3 次 |
| 不可重试错误 | 认证失败 (401/403)、参数错误 (400)、不支持等 |
| 轮询间隔 | 250ms |

**各服务商并发限制**：

| 服务商 | 并发数 | 启动间隔 (ms) |
|--------|--------|---------------|
| Replicate | 5 | 700 |
| Google | 3 | 1100 |
| Relay | 3 | 1100 |
| OpenAI | 3 | 1100 |
| OpenRouter | 3 | 1100 |
| DashScope | 3 | 1100 |
| 即梦 | 3 | 1100 |
| Seedream | 3 | 1100 |

### 自定义服务商顺序

若需要固定顺序，请优先在 `sweety-image-gen` 的 `EXTEND.md` 中配置 `provider_fallback_order`。`sweety-cover-image` 自身文档里的 provider 顺序只是上层约定，真正执行由底层 `sweety-image-gen` 决定。

```yaml
# EXTEND.md 中的配置示例
provider_fallback_order:
  - google
  - relay
  - dashscope
```

也可在命令行中使用 `--provider-order google,relay,dashscope` 临时覆盖。

当首选服务商失败（API 错误、超时等）时，自动按顺序尝试下一个服务商。

### 模型优先级（从高到低）

1. 命令行参数：`--provider` / `--model`
2. EXTEND.md 配置：`preferred_provider` / `provider_fallback_order`
3. sweety-image-gen EXTEND.md：`default_provider` / `default_model.[provider]`
4. 环境变量：`<PROVIDER>_IMAGE_MODEL`
5. 内置默认值

## 工作流程

### 进度清单

```
封面图进度：
- [ ] 步骤 0：检查偏好设置 (EXTEND.md) ⛔ 阻塞
- [ ] 步骤 1：分析内容 + 保存参考图 + 确定输出目录
- [ ] 步骤 2：确认选项（6 个维度）⚠️ 除非 --quick
- [ ] 步骤 3：创建提示词
- [ ] 步骤 4：生成图片
- [ ] 步骤 5：完成报告
```

### 流程

```
输入 → [步骤 0: 偏好设置] ─┬─ 已找到 → 继续
                           └─ 未找到 → 首次设置 ⛔ 阻塞 → 保存 EXTEND.md → 继续
        ↓
分析 + 保存参考图 → [输出目录] → [确认: 6 维度] → 提示词 → 生成 → 完成
                                        ↓
                               (--quick 或全部已指定时跳过)
```

### 步骤 0：加载偏好设置 ⛔ 阻塞

检查 EXTEND.md 是否存在（优先级：项目 → 用户）：
```bash
# macOS, Linux, WSL, Git Bash
test -f .sweety-skills/sweety-cover-image/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-cover-image/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-cover-image/EXTEND.md" && echo "user"
```

```powershell
# PowerShell (Windows)
if (Test-Path .sweety-skills/sweety-cover-image/EXTEND.md) { "project" }
$xdg = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { "$HOME/.config" }
if (Test-Path "$xdg/sweety-skills/sweety-cover-image/EXTEND.md") { "xdg" }
if (Test-Path "$HOME/.sweety-skills/sweety-cover-image/EXTEND.md") { "user" }
```

| 结果 | 操作 |
|------|------|
| 已找到 | 加载并显示摘要 → 继续 |
| 未找到 | ⛔ 执行首次设置（[references/config/first-time-setup.md](references/config/first-time-setup.md)）→ 保存 → 继续 |

**关键**：如未找到，必须在执行其他步骤或提问之前完成设置。

### 步骤 1：分析内容

1. **保存参考图**（如有提供）→ [references/workflow/reference-images.md](references/workflow/reference-images.md)
2. **保存原始内容**（如粘贴内容，保存为 `source.md`）
3. **分析内容**：主题、语调、关键词、视觉隐喻
4. **深度分析参考图** ⚠️：提取具体、明确的元素（见 reference-images.md）
5. **检测语言**：对比源内容、用户输入、EXTEND.md 偏好
6. **确定输出目录**：按文件结构规则

**⚠️ 参考图中有人物时：**

如果参考图包含需要出现在封面中的**人物**：

- **模型支持 `--ref`**（默认情况）：将图片复制到 `refs/`，生成时通过 `--ref` 传递。无需描述文件——模型可以直接看到面部。
- **模型不支持 `--ref`**（即梦、Seedream 3.0）：创建 `refs/ref-NN-{slug}.md`，包含每个角色的描述（发型、眼镜、肤色、服装）。以 MUST/REQUIRED 指令嵌入提示词文本中。

完整决策表见 [reference-images.md](references/workflow/reference-images.md)。

### 步骤 2：确认选项 ⚠️

**必须使用 `AskUserQuestion` 工具**以交互式选择呈现选项——不是纯文本表格。在单次 `AskUserQuestion` 调用中最多呈现 4 个问题（类型、配色、渲染风格、字体 + 设置）。每个问题优先显示推荐选项及原因，之后列出备选项。

完整确认流程和问题格式：[references/workflow/confirm-options.md](references/workflow/confirm-options.md)

| 条件 | 跳过 | 仍需询问 |
|------|------|---------|
| `--quick` 或 `quick_mode: true` | 6 个维度 | 宽高比（除非指定 `--aspect`） |
| 全部 6 个 + `--aspect` 已指定 | 全部 | 无 |

### 步骤 3：创建提示词

保存到 `prompts/cover.md`。模板：[references/workflow/prompt-template.md](references/workflow/prompt-template.md)

**关键 - 前置元数据中的参考图**：
- 文件已保存到 `refs/` → 添加到 frontmatter 的 `references` 列表
- 仅口头提取风格（无文件）→ 省略 `references`，在正文中描述
- 写入前 → 验证：`test -f refs/ref-NN-{slug}.{ext}`

**正文中的参考元素**必须详细描述，带 "MUST"/"REQUIRED" 前缀，附集成方案。

### 步骤 4：生成图片

1. **备份已有** `cover.png`（如重新生成）
2. **检查图像生成技能**；如有多个，询问偏好
3. **处理参考图**（来自提示词 frontmatter）：
   - `direct` 用法 → 通过 `--ref` 传递（使用支持参考图的后端）
   - `style`/`palette` → 提取特征，追加到提示词
4. **生成**：调用技能，传入提示词文件、输出路径、宽高比
5. **服务商回退**：如首选服务商失败，按 `provider_fallback_order` 顺序自动尝试下一个
6. 单次失败：自动重试一次

### 步骤 5：完成报告

```
封面图已生成！

主题：[topic]
类型：[type] | 配色：[palette] | 渲染：[rendering]
文字：[text] | 氛围：[mood] | 字体：[font] | 比例：[ratio]
标题：[title 或 "纯视觉"]
语言：[lang] | 水印：[启用/禁用]
参考图：[N 张 或 "提取风格" 或 "无"]
服务商：[provider] / [model]
位置：[directory path]

文件：
✓ source-{slug}.{ext}
✓ prompts/cover.md
✓ cover.png
```

## 图片修改

| 操作 | 步骤 |
|------|------|
| **重新生成** | 备份 → 先更新提示词文件 → 重新生成 |
| **更改维度** | 备份 → 确认新值 → 更新提示词 → 重新生成 |

## 构图原则

- **留白**：40-60% 呼吸空间
- **视觉锚点**：主体元素居中或偏左
- **人物**：简化剪影；不使用写实人像
- **标题**：使用用户/来源的原始标题；禁止自行创造

## 扩展支持

通过 EXTEND.md 进行自定义配置。路径见**步骤 0**。

支持：水印 | 偏好维度 | 默认比例/输出目录 | 快速模式 | 自定义配色 | 语言 | **服务商优先级**

Schema：[references/config/preferences-schema.md](references/config/preferences-schema.md)

## 参考文档

**维度**：[text.md](references/dimensions/text.md) | [mood.md](references/dimensions/mood.md) | [font.md](references/dimensions/font.md)
**配色方案**：[references/palettes/](references/palettes/)
**渲染风格**：[references/renderings/](references/renderings/)
**类型**：[references/types.md](references/types.md)
**自动选择**：[references/auto-selection.md](references/auto-selection.md)
**风格预设**：[references/style-presets.md](references/style-presets.md)
**兼容性**：[references/compatibility.md](references/compatibility.md)
**视觉元素**：[references/visual-elements.md](references/visual-elements.md)
**工作流**：[confirm-options.md](references/workflow/confirm-options.md) | [prompt-template.md](references/workflow/prompt-template.md) | [reference-images.md](references/workflow/reference-images.md)
**配置**：[preferences-schema.md](references/config/preferences-schema.md) | [first-time-setup.md](references/config/first-time-setup.md) | [watermark-guide.md](references/config/watermark-guide.md)
