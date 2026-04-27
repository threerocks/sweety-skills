---
name: first-time-setup
description: sweety-image-gen 首次设置和默认模型选择流程
---

# 首次设置

## 概述

触发条件：
1. 未找到 EXTEND.md → 完整设置（服务商 + 模型 + 偏好）
2. 找到 EXTEND.md 但 `default_model.[provider]` 为 null → 仅选择模型

## 设置流程

```
未找到 EXTEND.md              找到 EXTEND.md，模型为 null
        │                            │
        ▼                            ▼
┌─────────────────────┐    ┌──────────────────────┐
│ AskUserQuestion     │    │ AskUserQuestion      │
│（完整设置）           │    │（仅模型选择）          │
└─────────────────────┘    └──────────────────────┘
        │                            │
        ▼                            ▼
┌─────────────────────┐    ┌──────────────────────┐
│ 创建 EXTEND.md      │    │ 更新 EXTEND.md       │
└─────────────────────┘    └──────────────────────┘
        │                            │
        ▼                            ▼
      继续                         继续
```

## 流程 1：无 EXTEND.md（完整设置）

**语言**：使用用户的输入语言或已保存的语言偏好。

使用 AskUserQuestion 在一次调用中包含所有问题：

### 问题 1：默认服务商

```yaml
header: "服务商"
question: "默认图像生成服务商？"
options:
  - label: "Google（推荐）"
    description: "Gemini 多模态 - 高质量、支持参考图、灵活尺寸"
  - label: "Relay 中转"
    description: "OpenAI 兼容中转 - 支持多种模型、支持参考图"
  - label: "OpenAI"
    description: "GPT Image - 质量稳定、输出可靠"
  - label: "OpenRouter"
    description: "路由 Gemini/FLUX/OpenAI 兼容图像模型"
  - label: "DashScope"
    description: "阿里云 Qwen-Image，中英文文字渲染强"
  - label: "Replicate"
    description: "社区模型 - nano-banana-pro，模型选择灵活"
```

### 问题 2：默认 Google 模型

仅在用户选择 Google 或自动检测（未显式指定服务商）时显示。

```yaml
header: "Google 模型"
question: "默认 Google 图像生成模型？"
options:
  - label: "gemini-3-pro-image-preview（推荐）"
    description: "最高质量，适合生产环境使用"
  - label: "gemini-3.1-flash-image-preview"
    description: "生成快速、质量良好、成本更低"
  - label: "gemini-3-flash-preview"
    description: "生成快速、质量与速度平衡"
```

### 问题 2b：默认 OpenRouter 模型

仅在用户选择 OpenRouter 时显示。

```yaml
header: "OpenRouter 模型"
question: "默认 OpenRouter 图像生成模型？"
options:
  - label: "google/gemini-3.1-flash-image-preview（推荐）"
    description: "最佳通用 OpenRouter 图像模型，支持参考图工作流"
  - label: "google/gemini-2.5-flash-image-preview"
    description: "OpenRouter 上的快速 Gemini 预览模型"
  - label: "black-forest-labs/flux.2-pro"
    description: "通过 OpenRouter 的高质量文生图"
```

### 问题 3：默认质量

```yaml
header: "质量"
question: "默认图像质量？"
options:
  - label: "2k（推荐）"
    description: "2048px - 封面、插图、信息图"
  - label: "normal"
    description: "1024px - 快速预览、草稿"
```

### 问题 4：保存位置

```yaml
header: "保存"
question: "偏好设置保存到哪里？"
options:
  - label: "项目（推荐）"
    description: ".sweety-skills/（仅当前项目）"
  - label: "用户"
    description: "~/.sweety-skills/（所有项目）"
```

### 保存位置

| 选择 | 路径 | 范围 |
|--------|------|-------|
| 项目 | `.sweety-skills/sweety-image-gen/EXTEND.md` | 当前项目 |
| 用户 | `$HOME/.sweety-skills/sweety-image-gen/EXTEND.md` | 所有项目 |

### EXTEND.md 模板

```yaml
---
version: 1
default_provider: [selected provider or null]
provider_fallback_order:
  - google
  - relay
  - dashscope
default_quality: [selected quality]
default_aspect_ratio: null
default_image_size: null
default_model:
  google: [selected google model or null]
  relay: [selected relay model or null]
  openai: null
  openrouter: [selected openrouter model or null]
  dashscope: null
  replicate: null
---
```

如果当前环境访问 Google / Gemini 需要代理，同时写入 `~/.sweety-skills/.env`：

```bash
https_proxy=http://127.0.0.1:7890
http_proxy=http://127.0.0.1:7890
all_proxy=http://127.0.0.1:7890
```

Google provider 检测到这些变量后会自动改走代理；非 Google 路线不依赖这组配置。

## 流程 2：EXTEND.md 存在但模型为 Null

当 EXTEND.md 存在但 `default_model.[当前服务商]` 为 null 时，仅询问当前服务商的模型问题。

### Google 模型选择

```yaml
header: "Google 模型"
question: "选择默认 Google 图像生成模型？"
options:
  - label: "gemini-3-pro-image-preview（推荐）"
    description: "最高质量，适合生产环境使用"
  - label: "gemini-3.1-flash-image-preview"
    description: "生成快速、质量良好、成本更低"
  - label: "gemini-3-flash-preview"
    description: "生成快速、质量与速度平衡"
```

### OpenAI 模型选择

```yaml
header: "OpenAI 模型"
question: "选择默认 OpenAI 图像生成模型？"
options:
  - label: "gpt-image-1.5（推荐）"
    description: "最新 GPT Image 模型，质量最高"
  - label: "gpt-image-1"
    description: "上一代 GPT Image 模型"
```

### OpenRouter 模型选择

```yaml
header: "OpenRouter 模型"
question: "选择默认 OpenRouter 图像生成模型？"
options:
  - label: "google/gemini-3.1-flash-image-preview（推荐）"
    description: "推荐用于图像输出和参考图编辑"
  - label: "google/gemini-2.5-flash-image-preview"
    description: "快速的预览向图像生成"
  - label: "black-forest-labs/flux.2-pro"
    description: "通过 OpenRouter 的高质量文生图"
```

### DashScope 模型选择

```yaml
header: "DashScope 模型"
question: "选择默认 DashScope 图像生成模型？"
options:
  - label: "qwen-image-2.0-pro（推荐）"
    description: "最佳 DashScope 模型，擅长文字渲染和自定义尺寸"
  - label: "qwen-image-2.0"
    description: "更快的 2.0 变体，输出尺寸灵活"
  - label: "qwen-image-max"
    description: "旧版 Qwen 模型，五种固定输出尺寸"
  - label: "qwen-image-plus"
    description: "旧版 Qwen 模型，当前能力与 qwen-image 相同"
  - label: "z-image-turbo"
    description: "旧版 DashScope 模型，用于兼容性"
  - label: "z-image-ultra"
    description: "旧版 DashScope 模型，质量更高但速度更慢"
```

Notes for DashScope setup:

- Prefer `qwen-image-2.0-pro` when the user needs custom `--size`, uncommon ratios like `21:9`, or strong Chinese/English text rendering.
- `qwen-image-max` / `qwen-image-plus` / `qwen-image` only support five fixed sizes: `1664*928`, `1472*1104`, `1328*1328`, `1104*1472`, `928*1664`.
- In `sweety-image-gen`, `quality` is a compatibility preset. It is not a native DashScope parameter.

### Replicate Model Selection

```yaml
header: "Replicate Model"
question: "Choose a default Replicate image generation model?"
options:
  - label: "google/nano-banana-pro (Recommended)"
    description: "Google's fast image model on Replicate"
  - label: "google/nano-banana"
    description: "Google's base image model on Replicate"
```

### Update EXTEND.md

After user selects a model:

1. Read existing EXTEND.md
2. If `default_model:` section exists → update the provider-specific key
3. If `default_model:` section missing → add the full section:

```yaml
default_model:
  google: [value or null]
  openai: [value or null]
  openrouter: [value or null]
  dashscope: [value or null]
  replicate: [value or null]
```

Only set the selected provider's model; leave others as their current value or null.

## After Setup

1. Create directory if needed
2. Write/update EXTEND.md with frontmatter
3. Confirm: "Preferences saved to [path]"
4. Continue with image generation
