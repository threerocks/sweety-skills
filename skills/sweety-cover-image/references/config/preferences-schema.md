---
name: preferences-schema
description: sweety-cover-image 用户偏好设置的 EXTEND.md YAML schema
---

# 偏好设置 Schema

## 完整 Schema

```yaml
---
version: 4

watermark:
  enabled: false
  content: ""
  position: bottom-right  # bottom-right|bottom-left|bottom-center|top-right

preferred_type: null      # hero|conceptual|typography|metaphor|scene|minimal 或 null 自动选择

preferred_palette: null   # warm|elegant|cool|dark|earth|vivid|pastel|mono|retro 或 null 自动选择

preferred_rendering: null # flat-vector|hand-drawn|painterly|digital|pixel|chalk 或 null 自动选择

preferred_text: title-only  # none|title-only|title-subtitle|text-rich

preferred_mood: balanced    # subtle|balanced|bold

default_aspect: "2.35:1"  # 2.35:1|16:9|1:1

quick_mode: false         # 为 true 时跳过确认

language: null            # zh|en|ja|ko|auto（null = 自动检测）

# 图像生成服务商配置
preferred_provider: null  # google|relay|openai|openrouter|dashscope|replicate|jimeng|seedream 或 null 自动选择

provider_fallback_order:  # 建议与 sweety-image-gen 保持一致
  - google
  - relay
  - dashscope

custom_palettes:
  - name: my-palette
    description: "配色方案描述"
    colors:
      primary: ["#1E3A5F", "#4A90D9"]
      background: "#F5F7FA"
      accents: ["#00B4D8"]
    decorative_hints: "简洁线条、几何图形"
    best_for: "商务、技术内容"
---
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `version` | int | 4 | Schema 版本 |
| `watermark.enabled` | bool | false | 启用水印 |
| `watermark.content` | string | "" | 水印文字（@用户名或自定义） |
| `watermark.position` | enum | bottom-right | 水印位置 |
| `preferred_type` | string | null | 类型名称，null 为自动选择 |
| `preferred_palette` | string | null | 配色名称，null 为自动选择 |
| `preferred_rendering` | string | null | 渲染风格名称，null 为自动选择 |
| `preferred_text` | string | title-only | 文字密度级别 |
| `preferred_mood` | string | balanced | 氛围强度级别 |
| `default_aspect` | string | "2.35:1" | 默认宽高比 |
| `quick_mode` | bool | false | 跳过确认步骤 |
| `language` | string | null | 输出语言（null = 自动检测） |
| `preferred_provider` | string | null | 首选图像生成服务商，null 为自动选择 |
| `provider_fallback_order` | array | 见下方 | 服务商回退顺序 |
| `custom_palettes` | array | [] | 用户自定义配色方案 |

## 类型选项

| 值 | 说明 |
|-----|------|
| `hero` | 大视觉冲击力，标题叠加 |
| `conceptual` | 概念可视化，抽象核心思想 |
| `typography` | 以文字为主的布局，突出标题 |
| `metaphor` | 视觉隐喻，以具象表达抽象 |
| `scene` | 氛围场景，叙事感 |
| `minimal` | 极简构图，大量留白 |

## 配色选项

| 值 | 说明 |
|-----|------|
| `warm` | 友好、亲切——橙色、金黄、赤陶 |
| `elegant` | 精致、优雅——柔和珊瑚、哑光青、灰玫瑰 |
| `cool` | 技术、专业——工程蓝、海军蓝、青色 |
| `dark` | 电影感、高端——电紫、青色、品红 |
| `earth` | 自然、有机——森林绿、鼠尾草、土褐 |
| `vivid` | 活力、大胆——亮红、霓虹绿、电蓝 |
| `pastel` | 柔和、梦幻——浅粉、薄荷、薰衣草 |
| `mono` | 干净、聚焦——黑、近黑、白 |
| `retro` | 怀旧、复古——哑光橙、灰粉、栗色 |

## 渲染风格选项

| 值 | 说明 |
|-----|------|
| `flat-vector` | 干净轮廓、均匀填充、几何图标 |
| `hand-drawn` | 素描感、有机、不完美笔触、纸张质感 |
| `painterly` | 柔和笔触、颜色溢出、水彩感 |
| `digital` | 精致、精确边缘、微妙渐变、UI 组件 |
| `pixel` | 像素网格、抖动效果、粗像素形状 |
| `chalk` | 粉笔笔触、粉尘效果、黑板质感 |

## 文字选项

| 值 | 说明 |
|-----|------|
| `none` | 纯视觉，无文字元素 |
| `title-only` | 单标题 |
| `title-subtitle` | 标题 + 副标题 |
| `text-rich` | 标题 + 副标题 + 关键词标签（2-4 个） |

## 氛围选项

| 值 | 说明 |
|-----|------|
| `subtle` | 低对比度、柔和色彩、沉静美感 |
| `balanced` | 中等对比度、正常饱和度、通用 |
| `bold` | 高对比度、鲜艳色彩、动感能量 |

## 水印位置选项

| 值 | 说明 |
|-----|------|
| `bottom-right` | 右下角（默认，最常用） |
| `bottom-left` | 左下角 |
| `bottom-center` | 底部居中 |
| `top-right` | 右上角 |

## 宽高比选项

| 值 | 说明 | 适用场景 |
|-----|------|----------|
| `2.35:1` | 电影宽屏 | 文章头图、博客封面 |
| `16:9` | 标准宽屏 | 演示文稿、视频缩略图 |
| `1:1` | 正方形 | 社交媒体、头像 |

## 服务商配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `preferred_provider` | string | null | 首选图像生成服务商（null = 自动检测） |
| `provider_fallback_order` | array | [google, relay, dashscope] | 服务商回退顺序 |

**支持的服务商**：

| 服务商 | 需要的环境变量 | 支持参考图 |
|--------|---------------|------------|
| `google` | `GOOGLE_API_KEY` / `GEMINI_API_KEY` | ✓ |
| `relay` | `RELAY_API_KEY` | ✓ |
| `openai` | `OPENAI_API_KEY` | ✓ |
| `openrouter` | `OPENROUTER_API_KEY` | ✓ |
| `dashscope` | `DASHSCOPE_API_KEY` | ✗ |
| `replicate` | `REPLICATE_API_TOKEN` | ✓ |
| `jimeng` | `JIMENG_ACCESS_KEY_ID` + `JIMENG_SECRET_ACCESS_KEY` | ✗ |
| `seedream` | `ARK_API_KEY` | ✓（4.0+） |

## 自定义配色字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 唯一配色标识符（kebab-case） |
| `description` | 是 | 配色方案传达的感觉 |
| `colors.primary` | 否 | 主色（hex 数组） |
| `colors.background` | 否 | 背景色（hex） |
| `colors.accents` | 否 | 强调色（hex 数组） |
| `decorative_hints` | 否 | 装饰元素和图案 |
| `best_for` | 否 | 推荐的内容类型 |

## 示例：最简配置

```yaml
---
version: 4
watermark:
  enabled: true
  content: "@myhandle"
preferred_type: null
preferred_palette: elegant
preferred_rendering: hand-drawn
preferred_text: title-only
preferred_mood: balanced
quick_mode: false
---
```

## 示例：完整配置

```yaml
---
version: 4
watermark:
  enabled: true
  content: "myblog.com"
  position: bottom-right

preferred_type: conceptual

preferred_palette: cool

preferred_rendering: digital

preferred_text: title-subtitle

preferred_mood: subtle

default_aspect: "16:9"

quick_mode: true

language: zh

# 图像生成服务商配置
preferred_provider: google
provider_fallback_order:
  - google
  - relay
  - dashscope

custom_palettes:
  - name: corporate-tech
    description: "专业 B2B 技术配色方案"
    colors:
      primary: ["#1E3A5F", "#4A90D9"]
      background: "#F5F7FA"
      accents: ["#00B4D8", "#48CAE4"]
    decorative_hints: "简洁线条、微妙渐变、电路图案"
    best_for: "SaaS、企业级、技术内容"
---
```

## Migration from v2

When loading v2 schema, auto-upgrade:

| v2 Field | v3 Field | Migration |
|----------|----------|-----------|
| `version: 2` | `version: 3` | Update |
| `preferred_style` | `preferred_palette` + `preferred_rendering` | Use preset mapping table |
| `custom_styles` | `custom_palettes` | Rename, restructure fields |

**Style → Palette + Rendering mapping**:

| v2 `preferred_style` | v3 `preferred_palette` | v3 `preferred_rendering` |
|----------------------|----------------------|-------------------------|
| `elegant` | `elegant` | `hand-drawn` |
| `blueprint` | `cool` | `digital` |
| `chalkboard` | `dark` | `chalk` |
| `dark-atmospheric` | `dark` | `digital` |
| `editorial-infographic` | `cool` | `digital` |
| `fantasy-animation` | `pastel` | `painterly` |
| `flat-doodle` | `pastel` | `flat-vector` |
| `intuition-machine` | `retro` | `digital` |
| `minimal` | `mono` | `flat-vector` |
| `nature` | `earth` | `hand-drawn` |
| `notion` | `mono` | `digital` |
| `pixel-art` | `vivid` | `pixel` |
| `playful` | `pastel` | `hand-drawn` |
| `retro` | `retro` | `digital` |
| `sketch-notes` | `warm` | `hand-drawn` |
| `vector-illustration` | `retro` | `flat-vector` |
| `vintage` | `retro` | `hand-drawn` |
| `warm` | `warm` | `hand-drawn` |
| `watercolor` | `earth` | `painterly` |
| null (auto) | null | null |

**Custom style migration**:

| v2 Field | v3 Field |
|----------|----------|
| `custom_styles[].name` | `custom_palettes[].name` |
| `custom_styles[].description` | `custom_palettes[].description` |
| `custom_styles[].color_palette` | `custom_palettes[].colors` |
| `custom_styles[].visual_elements` | `custom_palettes[].decorative_hints` |
| `custom_styles[].typography` | (removed — determined by rendering) |
| `custom_styles[].best_for` | `custom_palettes[].best_for` |

## Migration from v1

When loading v1 schema, auto-upgrade to v3:

| v1 Field | v3 Field | Default Value |
|----------|----------|---------------|
| (missing) | `version` | 3 |
| (missing) | `preferred_palette` | null |
| (missing) | `preferred_rendering` | null |
| (missing) | `preferred_text` | title-only |
| (missing) | `preferred_mood` | balanced |
| (missing) | `quick_mode` | false |

v1 `--no-title` flag maps to `preferred_text: none`.
