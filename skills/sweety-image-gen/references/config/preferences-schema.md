---
name: preferences-schema
description: sweety-image-gen 用户偏好的 EXTEND.md YAML Schema
---

# 偏好设置 Schema

## 完整 Schema

```yaml
---
version: 1

default_provider: null      # google|relay|openai|openrouter|dashscope|replicate|null（null = 自动检测）

provider_fallback_order:    # 自动模式下的服务商回退顺序
  - google
  - relay
  - dashscope

default_quality: null       # normal|2k|null（null = 使用默认值：2k）

default_aspect_ratio: null  # "16:9"|"1:1"|"4:3"|"3:4"|"2.35:1"|null

default_image_size: null    # 1K|2K|4K|null（Google/OpenRouter，覆盖 quality）

default_model:
  google: null              # e.g., "gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"
  relay: null               # e.g., "gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"
  openai: null              # e.g., "gpt-image-1.5", "gpt-image-1"
  openrouter: null          # e.g., "google/gemini-3.1-flash-image-preview"
  dashscope: null           # e.g., "qwen-image-2.0-pro"
  replicate: null           # e.g., "google/nano-banana-pro"

batch:
  max_workers: 10
  provider_limits:
    replicate:
      concurrency: 5
      start_interval_ms: 700
    google:
      concurrency: 3
      start_interval_ms: 1100
    relay:
      concurrency: 3
      start_interval_ms: 1100
    openai:
      concurrency: 3
      start_interval_ms: 1100
    openrouter:
      concurrency: 3
      start_interval_ms: 1100
    dashscope:
      concurrency: 3
      start_interval_ms: 1100
---
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `version` | int | 1 | Schema 版本 |
| `default_provider` | string\|null | null | 默认服务商（null = 自动检测） |
| `provider_fallback_order` | array\|null | [google, relay, dashscope, ...] | 自动模式下的服务商顺序 |
| `default_quality` | string\|null | null | 默认质量（null = 2k） |
| `default_aspect_ratio` | string\|null | null | 默认宽高比 |
| `default_image_size` | string\|null | null | Google/OpenRouter 图像尺寸（覆盖 quality） |
| `default_model.google` | string\|null | null | Google 默认模型 |
| `default_model.relay` | string\|null | null | Relay 中转默认模型 |
| `default_model.openai` | string\|null | null | OpenAI 默认模型 |
| `default_model.openrouter` | string\|null | null | OpenRouter 默认模型 |
| `default_model.dashscope` | string\|null | null | DashScope 默认模型 |
| `default_model.replicate` | string\|null | null | Replicate 默认模型 |
| `batch.max_workers` | int\|null | 10 | 批量并发上限 |
| `batch.provider_limits.<provider>.concurrency` | int\|null | 服务商默认值 | 每个服务商的最大并发请求数 |
| `batch.provider_limits.<provider>.start_interval_ms` | int\|null | 服务商默认值 | 每个服务商请求启动的最小间隔 |

## 示例

**最简配置**：
```yaml
---
version: 1
default_provider: google
provider_fallback_order:
  - google
  - relay
  - dashscope
default_quality: 2k
---
```

**完整配置**：
```yaml
---
version: 1
default_provider: google
provider_fallback_order:
  - google
  - relay
  - dashscope
default_quality: 2k
default_aspect_ratio: "16:9"
default_image_size: 2K
default_model:
  google: "gemini-3-pro-image-preview"
  relay: "gemini-2.5-flash-image"
  openai: "gpt-image-1.5"
  openrouter: "google/gemini-3.1-flash-image-preview"
  dashscope: "qwen-image-2.0-pro"
  replicate: "google/nano-banana-pro"
batch:
  max_workers: 10
  provider_limits:
    replicate:
      concurrency: 5
      start_interval_ms: 700
    openrouter:
      concurrency: 3
      start_interval_ms: 1100
---
```
