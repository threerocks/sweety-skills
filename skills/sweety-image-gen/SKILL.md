---
name: sweety-image-gen
description: 基于 OpenAI、Google、Relay（OpenAI 兼容中转）、OpenRouter、DashScope、即梦、Seedream 和 Replicate API 的 AI 图像生成。支持文本生成图像、参考图、宽高比设置及从已保存提示词文件批量生成。默认顺序执行；当用户已有多个提示词或需要稳定的多图吞吐量时，使用批量并行生成。当用户要求生成、创建或绘制图像时使用。
version: 1.56.3
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-image-gen
    requires:
      anyBins:
        - bun
        - npx
---

# 图像生成（AI SDK）

基于官方 API 的图像生成。支持 OpenAI、Google、Relay（OpenAI 兼容中转）、OpenRouter、DashScope（阿里通义万象）、Jimeng（即梦）、Seedream（豆包）和 Replicate 服务商。

## 脚本目录

**Agent 执行流程**：
1. `{baseDir}` = 本 SKILL.md 文件所在目录
2. 脚本路径 = `{baseDir}/scripts/main.ts`
3. 确定 `${BUN_X}` 运行时：若已安装 `bun` → `bun`；若有 `npx` → `npx -y bun`；否则建议安装 bun

## 步骤 0：加载偏好设置 ⛔ 阻塞步骤

**关键**：此步骤必须在任何图像生成之前完成。不可跳过或延迟。

检查 EXTEND.md 是否存在（优先级：项目 → 用户）：

```bash
# macOS, Linux, WSL, Git Bash
test -f .sweety-skills/sweety-image-gen/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-image-gen/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-image-gen/EXTEND.md" && echo "user"
```

```powershell
# PowerShell (Windows)
if (Test-Path .sweety-skills/sweety-image-gen/EXTEND.md) { "project" }
$xdg = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { "$HOME/.config" }
if (Test-Path "$xdg/sweety-skills/sweety-image-gen/EXTEND.md") { "xdg" }
if (Test-Path "$HOME/.sweety-skills/sweety-image-gen/EXTEND.md") { "user" }
```

| 结果 | 操作 |
|--------|--------|
| 找到 | 加载、解析并应用设置。若 `default_model.[provider]` 为 null → 仅询问模型（流程 2） |
| 未找到 | ⛔ 运行首次设置（[references/config/first-time-setup.md](references/config/first-time-setup.md)）→ 保存 EXTEND.md → 然后继续 |

**关键**：若未找到，使用 AskUserQuestion 完成完整设置（服务商 + 模型 + 质量 + 保存位置）后才可生成图像。EXTEND.md 创建前，生成功能处于阻塞状态。

| 路径 | 位置 |
|------|----------|
| `.sweety-skills/sweety-image-gen/EXTEND.md` | 项目目录 |
| `$HOME/.sweety-skills/sweety-image-gen/EXTEND.md` | 用户主目录 |

**EXTEND.md 支持的配置**：默认服务商 | 默认质量 | 默认宽高比 | 默认图像尺寸 | 默认模型 | 批量并发上限 | 按服务商的批量限制

Schema：`references/config/preferences-schema.md`

## 使用方法

```bash
# 基本用法
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cat" --image cat.png

# 指定宽高比
${BUN_X} {baseDir}/scripts/main.ts --prompt "A landscape" --image out.png --ar 16:9

# 高质量
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cat" --image out.png --quality 2k

# 从提示词文件读取
${BUN_X} {baseDir}/scripts/main.ts --promptfiles system.md content.md --image out.png

# 使用参考图（Google、OpenAI、OpenRouter、Replicate 或 Seedream 4.0/4.5/5.0）
${BUN_X} {baseDir}/scripts/main.ts --prompt "Make blue" --image out.png --ref source.png

# 使用参考图（显式指定服务商/模型）
${BUN_X} {baseDir}/scripts/main.ts --prompt "Make blue" --image out.png --provider google --model gemini-3-pro-image-preview --ref source.png

# OpenRouter（推荐默认模型）
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cat" --image out.png --provider openrouter

# OpenRouter 使用参考图
${BUN_X} {baseDir}/scripts/main.ts --prompt "Make blue" --image out.png --provider openrouter --model google/gemini-3.1-flash-image-preview --ref source.png

# 指定服务商
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cat" --image out.png --provider openai

# DashScope（阿里通义万象）
${BUN_X} {baseDir}/scripts/main.ts --prompt "一只可爱的猫" --image out.png --provider dashscope

# DashScope Qwen-Image 2.0 Pro（推荐用于自定义尺寸和文字渲染）
${BUN_X} {baseDir}/scripts/main.ts --prompt "为咖啡品牌设计一张 21:9 横幅海报，包含清晰中文标题" --image out.png --provider dashscope --model qwen-image-2.0-pro --size 2048x872

# DashScope 旧版 Qwen 固定尺寸模型
${BUN_X} {baseDir}/scripts/main.ts --prompt "一张电影感海报" --image out.png --provider dashscope --model qwen-image-max --size 1664x928

# Replicate（google/nano-banana-pro）
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cat" --image out.png --provider replicate

# Replicate 指定模型
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cat" --image out.png --provider replicate --model google/nano-banana

# 批量模式（使用已保存的提示词文件）
${BUN_X} {baseDir}/scripts/main.ts --batchfile batch.json

# 批量模式（显式指定并发数）
${BUN_X} {baseDir}/scripts/main.ts --batchfile batch.json --jobs 4 --json
```

### 批量文件格式

```json
{
  "jobs": 4,
  "tasks": [
    {
      "id": "hero",
      "promptFiles": ["prompts/hero.md"],
      "image": "out/hero.png",
      "provider": "replicate",
      "model": "google/nano-banana-pro",
      "ar": "16:9",
      "quality": "2k"
    },
    {
      "id": "diagram",
      "promptFiles": ["prompts/diagram.md"],
      "image": "out/diagram.png",
      "ref": ["references/original.png"]
    }
  ]
}
```

Paths in `promptFiles`, `image`, and `ref` are resolved relative to the batch file's directory. `jobs` is optional (overridden by CLI `--jobs`). Top-level array format (without `jobs` wrapper) is also accepted.

`promptFiles`、`image` 和 `ref` 中的路径相对于批量文件所在目录解析。`jobs` 是可选的（会被 CLI `--jobs` 覆盖）。也接受顶层数组格式（不含 `jobs` 包裹）。

## 选项

| 选项 | 说明 |
|--------|-------------|
| `--prompt <text>`, `-p` | 提示词文本 |
| `--promptfiles <files...>` | 从文件读取提示词（多文件拼接） |
| `--image <path>` | 输出图像路径（单张模式必填） |
| `--batchfile <path>` | 用于多图生成的 JSON 批量文件 |
| `--jobs <count>` | 批量模式的并发数（默认：自动，上限取自配置，内置默认 10） |
| `--provider google\|relay\|openai\|openrouter\|dashscope\|jimeng\|seedream\|replicate` | 强制指定服务商（默认：自动检测） |
| `--model <id>`, `-m` | 模型 ID（Google: `gemini-3-pro-image-preview`；OpenAI: `gpt-image-1.5`；OpenRouter: `google/gemini-3.1-flash-image-preview`；DashScope: `qwen-image-2.0-pro`） |
| `--ar <ratio>` | 宽高比（如 `16:9`、`1:1`、`4:3`） |
| `--size <WxH>` | 尺寸（如 `1024x1024`） |
| `--quality normal\|2k` | 质量预设（默认：`2k`） |
| `--imageSize 1K\|2K\|4K` | Google/OpenRouter 图像尺寸（默认：由 quality 决定） |
| `--ref <files...>` | 参考图像。支持 Google 多模态、Relay 中转、OpenAI GPT Image 编辑、OpenRouter 多模态模型、Replicate 和 Seedream 5.0/4.5/4.0。不支持即梦、Seedream 3.0 或已移除的 SeedEdit 3.0 |
| `--n <count>` | 生成图片数量 |
| `--json` | JSON 输出 |

### 输出校验与标准化

脚本会在落盘前读取 provider 实际返回的图片格式和尺寸：

- 如果自动 provider 链路中某个 provider 没有按 `--ar` / `ar` 输出目标比例，会先自动切到下一个可用 provider。
- 如果最后仍需本地修正，脚本会在自身内部把图片标准化为目标比例和输出路径要求的编码格式；不要在外层发布 skill 里再用 `sips`、改扩展名或临时裁切来兜底。
- JSON 结果会包含实际 `width`、`height`、`format`、`standardized` 和 `postprocess`，用于发布前审计。

## 环境变量

| 变量 | 说明 |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `RELAY_API_KEY` | Relay 中转 API 密钥（OpenAI 兼容） |
| `RELAY_BASE_URL` | Relay 中转端点（如 `https://new.suxi.ai/v1`） |
| `RELAY_IMAGE_MODEL` | Relay 模型覆盖（默认：`gemini-2.5-flash-image`） |
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 |
| `GOOGLE_API_KEY` | Google API 密钥 |
| `DASHSCOPE_API_KEY` | DashScope API 密钥（阿里云） |
| `REPLICATE_API_TOKEN` | Replicate API 令牌 |
| `JIMENG_ACCESS_KEY_ID` | 即梦（火山引擎）Access Key |
| `JIMENG_SECRET_ACCESS_KEY` | 即梦（火山引擎）Secret Key |
| `ARK_API_KEY` | Seedream（豆包/火山引擎 ARK）API 密钥 |
| `OPENAI_IMAGE_MODEL` | OpenAI 模型覆盖 |
| `OPENROUTER_IMAGE_MODEL` | OpenRouter 模型覆盖（默认：`google/gemini-3.1-flash-image-preview`） |
| `GOOGLE_IMAGE_MODEL` | Google 模型覆盖 |
| `DASHSCOPE_IMAGE_MODEL` | DashScope 模型覆盖（默认：`qwen-image-2.0-pro`） |
| `REPLICATE_IMAGE_MODEL` | Replicate 模型覆盖（默认：google/nano-banana-pro） |
| `JIMENG_IMAGE_MODEL` | 即梦模型覆盖（默认：jimeng_t2i_v40） |
| `SEEDREAM_IMAGE_MODEL` | Seedream 模型覆盖（默认：doubao-seedream-5-0-260128） |
| `OPENAI_BASE_URL` | 自定义 OpenAI 端点 |
| `OPENROUTER_BASE_URL` | 自定义 OpenRouter 端点（默认：`https://openrouter.ai/api/v1`） |
| `OPENROUTER_HTTP_REFERER` | 可选的 OpenRouter 归属应用/网站 URL |
| `OPENROUTER_TITLE` | 可选的 OpenRouter 归属应用名称 |
| `GOOGLE_BASE_URL` | 自定义 Google 端点 |
| `DASHSCOPE_BASE_URL` | 自定义 DashScope 端点 |
| `REPLICATE_BASE_URL` | 自定义 Replicate 端点 |
| `JIMENG_BASE_URL` | 自定义即梦端点（默认：`https://visual.volcengineapi.com`） |
| `JIMENG_REGION` | 即梦区域（默认：`cn-north-1`） |
| `SEEDREAM_BASE_URL` | 自定义 Seedream 端点（默认：`https://ark.cn-beijing.volces.com/api/v3`） |
| `SWEETY_IMAGE_GEN_MAX_WORKERS` | 覆盖批量并发上限 |
| `SWEETY_IMAGE_GEN_<PROVIDER>_CONCURRENCY` | 覆盖服务商并发数，如 `SWEETY_IMAGE_GEN_REPLICATE_CONCURRENCY` |
| `SWEETY_IMAGE_GEN_<PROVIDER>_START_INTERVAL_MS` | 覆盖服务商启动间隔，如 `SWEETY_IMAGE_GEN_REPLICATE_START_INTERVAL_MS` |
| `https_proxy` / `HTTPS_PROXY` | Google / Gemini 路线使用的 HTTP 代理 |
| `http_proxy` / `HTTP_PROXY` | Google / Gemini 路线使用的 HTTP 代理 |
| `all_proxy` / `ALL_PROXY` | Google / Gemini 路线使用的兜底代理 |

**加载优先级**：CLI 参数 > EXTEND.md > 环境变量 > `<cwd>/.sweety-skills/.env` > `~/.sweety-skills/.env`

### Google / Gemini 代理

当运行环境访问 Google API 需要代理时，把下面三个变量写进当前 shell，或写进 `~/.sweety-skills/.env`：

```bash
https_proxy=http://127.0.0.1:7890
http_proxy=http://127.0.0.1:7890
all_proxy=http://127.0.0.1:7890
```

`sweety-image-gen` 会在检测到这些变量后，让 Google provider 改用 `curl -x <proxy>` 发请求。非 Google 路线不需要这组代理。

### 自动服务商顺序与降级

未显式传 `--provider` 时，底层按服务商顺序挑选并在失败后继续降级。默认顺序：

1. `google`
2. `relay`
3. `dashscope`
4. 其它已配置服务商

如果任务带 `--ref`，会自动跳过不支持参考图的服务商，例如 `dashscope`。

可在 `EXTEND.md` 中用 `provider_fallback_order` 固定顺序。

## 模型解析

模型优先级（从高到低），适用于所有服务商：

1. CLI 参数：`--model <id>`
2. EXTEND.md：`default_model.[provider]`
3. 环境变量：`<PROVIDER>_IMAGE_MODEL`（如 `GOOGLE_IMAGE_MODEL`）
4. 内置默认值

**EXTEND.md 优先于环境变量**。若同时存在 EXTEND.md `default_model.google: "gemini-3-pro-image-preview"` 和环境变量 `GOOGLE_IMAGE_MODEL=gemini-3.1-flash-image-preview`，以 EXTEND.md 为准。

**Agent 必须在每次生成前显示模型信息**：
- 显示：`使用 [服务商] / [模型]`
- 显示切换提示：`切换模型：--model <id> | EXTEND.md default_model.[provider] | 环境变量 <PROVIDER>_IMAGE_MODEL`

### DashScope 模型

使用 `--model qwen-image-2.0-pro` 或设置 `default_model.dashscope` / `DASHSCOPE_IMAGE_MODEL`，当用户需要官方 Qwen-Image 行为时。

官方 DashScope 模型系列：

- `qwen-image-2.0-pro`、`qwen-image-2.0-pro-2026-03-03`、`qwen-image-2.0`、`qwen-image-2.0-2026-03-03`
  - 自由设置 `size`，格式为 `宽*高`
  - 总像素需在 `512*512` 到 `2048*2048` 之间
  - 默认尺寸约为 `1024*1024`
  - 适合自定义比例（如 `21:9`）和中英文文字密集型布局
- `qwen-image-max`、`qwen-image-max-2025-12-30`、`qwen-image-plus`、`qwen-image-plus-2026-01-09`、`qwen-image`
  - 仅支持固定尺寸：`1664*928`、`1472*1104`、`1328*1328`、`1104*1472`、`928*1664`
  - 默认尺寸为 `1664*928`
  - `qwen-image` 当前能力与 `qwen-image-plus` 相同
- 旧版 DashScope 模型如 `z-image-turbo`、`z-image-ultra`、`wanx-v1`
  - 仅在用户明确要求旧版行为或兼容性时使用

CLI 参数转换为 DashScope 行为时：

- `--size` 优先于 `--ar`
- 对于 `qwen-image-2.0*`，优先使用明确的 `--size`；否则根据 `--ar` 推算，使用下方官方推荐分辨率
- 对于 `qwen-image-max/plus/image`，只能使用五种官方固定尺寸；若请求的比例不在其中，切换到 `qwen-image-2.0-pro`
- `--quality` 是 sweety-image-gen 的兼容性预设，不是 DashScope API 的原生字段。将 `normal` / `2k` 映射到下方 `qwen-image-2.0*` 表格是实现层面的推算，并非官方 API 保证

`qwen-image-2.0*` 常见宽高比推荐尺寸：

| 比例 | `normal` | `2k` |
|-------|----------|------|
| `1:1` | `1024*1024` | `1536*1536` |
| `2:3` | `768*1152` | `1024*1536` |
| `3:2` | `1152*768` | `1536*1024` |
| `3:4` | `960*1280` | `1080*1440` |
| `4:3` | `1280*960` | `1440*1080` |
| `9:16` | `720*1280` | `1080*1920` |
| `16:9` | `1280*720` | `1920*1080` |
| `21:9` | `1344*576` | `2048*872` |

DashScope 官方 API 还提供 `negative_prompt`、`prompt_extend` 和 `watermark`，但 `sweety-image-gen` 目前未将它们暴露为独立 CLI 参数。

官方参考：

- [Qwen-Image API](https://help.aliyun.com/zh/model-studio/qwen-image-api)
- [Text-to-image guide](https://help.aliyun.com/zh/model-studio/text-to-image)
- [Qwen-Image Edit API](https://help.aliyun.com/zh/model-studio/qwen-image-edit-api)

### OpenRouter 模型

使用完整的 OpenRouter 模型 ID，例如：

- `google/gemini-3.1-flash-image-preview`（推荐，支持图像输出和参考图工作流）
- `google/gemini-2.5-flash-image-preview`
- `black-forest-labs/flux.2-pro`
- 其他支持图像生成的 OpenRouter 模型 ID

注意：

- OpenRouter 图像生成使用 `/chat/completions`，不是 OpenAI 的 `/images` 端点
- 若使用 `--ref`，需选择同时支持图像输入和图像输出的多模态模型
- `--imageSize` 映射到 OpenRouter `imageGenerationOptions.size`；`--size <WxH>` 会尽可能转换为最接近的 OpenRouter 尺寸和推算宽高比

### Replicate 模型

支持的模型格式：

- `owner/name`（推荐用于官方模型），如 `google/nano-banana-pro`
- `owner/name:version`（社区模型按版本），如 `stability-ai/sdxl:<version>`

示例：

```bash
# 使用 Replicate 默认模型
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cat" --image out.png --provider replicate

# 显式指定模型
${BUN_X} {baseDir}/scripts/main.ts --prompt "A cat" --image out.png --provider replicate --model google/nano-banana
```

## 服务商选择

1. 提供了 `--ref` 且未指定 `--provider` → 自动选择 Google 优先，其次 Relay，然后 OpenAI，然后 OpenRouter，最后 Replicate（即梦和 DashScope 不支持参考图）
2. 指定了 `--provider` → 使用该服务商（若有 `--ref`，必须为 `google`、`relay`、`openai`、`openrouter`、`replicate` 或 `seedream`）
3. 仅有一个 API Key → 使用对应服务商
4. 有多个可用 → 按 Google → Relay → DashScope → OpenAI → OpenRouter → Replicate → 即梦 → Seedream 优先级

## 质量预设

| 预设 | Google imageSize | OpenAI 尺寸 | OpenRouter size | Replicate 分辨率 | 用途 |
|--------|------------------|-------------|-----------------|----------------------|----------|
| `normal` | 1K | 1024px | 1K | 1K | 快速预览 |
| `2k`（默认） | 2K | 2048px | 2K | 2K | 封面、插图、信息图 |

**Google/OpenRouter imageSize**：可通过 `--imageSize 1K|2K|4K` 覆盖

## 宽高比

支持：`1:1`、`16:9`、`9:16`、`4:3`、`3:4`、`2.35:1`

- Google 多模态：使用 `imageConfig.aspectRatio`
- OpenAI：映射到最接近的支持尺寸
- OpenRouter：发送 `imageGenerationOptions.aspect_ratio`；若仅指定 `--size <WxH>`，宽高比会自动推算
- Replicate：将 `aspect_ratio` 传给模型；使用 `--ref` 且未指定 `--ar` 时，默认为 `match_input_image`

## 生成模式

**默认**：顺序生成。

**批量并行生成**：当 `--batchfile` 包含 2 个或以上待处理任务时，脚本自动启用并行生成。

| 模式 | 使用场景 |
|------|-------------|
| 顺序（默认） | 常规使用、单张图片、小批量 |
| 并行批量 | 批量模式且有 2+ 任务 |

执行选择：

| 场景 | 推荐方式 | 原因 |
|-----------|--------------------|-----|
| 一张图或 1-2 张简单图 | 顺序 | 协调开销更低，调试更方便 |
| 多张图已有保存的提示词文件 | 批量（`--batchfile`） | 复用已定稿的提示词，应用统一的限流/重试，吞吐量可预测 |
| 每张图仍需独立推理、撰写提示词或风格探索 | 子代理（Subagents） | 任务仍处于探索阶段，每张图可能需要独立分析后再生成 |
| 输出来自 `sweety-article-illustrator` 的 `outline.md` + `prompts/` | 批量（`build-batch.ts` -> `--batchfile`） | 该工作流已产出提示词文件，直接批量执行是预期路径 |

经验法则：

- 当提示词文件已保存且任务是"批量生成这些"时，优先使用批量模式
- 仅在生成与逐图思考、重写或多样化创意探索耦合时才使用子代理

并行行为：

- 默认并发数自动设定，受配置上限限制，内置默认 10
- 服务商级别限流仅在批量模式下应用，内置默认值已针对较快吞吐量调优，同时避免明显的 RPM 爆发
- 可通过 `--jobs <count>` 覆盖并发数
- 每张图自动重试最多 3 次
- 最终输出包含成功数、失败数及每张图的失败原因

## 错误处理

- 缺少 API Key → 报错并提示设置方法
- 生成失败 → 每张图自动重试最多 3 次
- 无效宽高比 → 警告，使用默认值继续
- 参考图搭配不支持的服务商/模型 → 报错并给出修复提示

## 扩展支持

通过 EXTEND.md 自定义配置。路径和支持的选项见上方**偏好设置**部分。
