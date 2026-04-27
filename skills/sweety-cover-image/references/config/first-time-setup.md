---
name: first-time-setup
description: sweety-cover-image 首次设置流程
---

# 首次设置

## 概述

未找到 EXTEND.md 时，引导用户完成偏好设置。

**⛔ 阻塞操作**：此设置必须在任何其他工作流步骤之前完成。禁止：
- 询问参考图片
- 询问内容/文章
- 询问维度（类型、配色、渲染风格）
- 进入内容分析

仅询问本设置流程中的问题，保存 EXTEND.md，然后继续。

## 设置流程

```
未找到 EXTEND.md
        │
        ▼
┌─────────────────────┐
│ AskUserQuestion     │
│ （所有问题）       │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ 创建 EXTEND.md     │
└─────────────────────┘
        │
        ▼
    继续步骤 1
```

## 问题

**语言**：使用用户的输入语言或已保存的语言偏好。

通过 AskUserQuestion 在一次调用中提出所有问题：

### 问题 1：水印

```yaml
header: "水印"
question: "生成的封面图是否需要水印？"
options:
  - label: "无水印（推荐）"
    description: "干净封面，之后可在 EXTEND.md 中启用"
```

### 问题 2：偏好类型

```yaml
header: "类型"
question: "默认封面类型偏好？"
options:
  - label: "自动选择（推荐）"
    description: "每次根据内容分析自动选择"
  - label: "hero"
    description: "大视觉冲击力——产品发布、公告"
  - label: "conceptual"
    description: "概念可视化——技术、架构"
```

### 问题 3：偏好配色

```yaml
header: "配色"
question: "默认色彩方案偏好？"
options:
  - label: "自动选择（推荐）"
    description: "每次根据内容分析自动选择"
  - label: "elegant"
    description: "精致优雅——柔和珊瑚、哑光青、灰玫瑰"
  - label: "warm"
    description: "友好亲切——橙色、金黄、赤陶"
  - label: "cool"
    description: "技术专业——工程蓝、海军蓝、青色"
```

### 问题 4：偏好渲染风格

```yaml
header: "渲染"
question: "默认渲染风格偏好？"
options:
  - label: "自动选择（推荐）"
    description: "每次根据内容分析自动选择"
  - label: "hand-drawn"
    description: "素描有机插画，带有个人触感"
  - label: "flat-vector"
    description: "现代简洁矢量，几何图形"
  - label: "digital"
    description: "精致的数字插画"
```

### 问题 5：默认宽高比

```yaml
header: "比例"
question: "封面图默认宽高比？"
options:
  - label: "16:9（推荐）"
    description: "标准宽屏——YouTube、演示文稿、通用"
  - label: "2.35:1"
    description: "电影宽屏——文章头图、博客"
  - label: "1:1"
    description: "正方形——Instagram、微信、社交卡片"
  - label: "3:4"
    description: "竖版——小红书、Pinterest、移动端"
```

注：更多比例（4:3、3:2）在生成时可用。这里设置的是默认推荐。

### 问题 6：默认输出目录

```yaml
header: "输出"
question: "封面图默认输出目录？"
options:
  - label: "独立目录（推荐）"
    description: "cover-image/{topic-slug}/ - 与文章分开"
  - label: "同目录"
    description: "{article-dir}/ - 与文章文件并列"
  - label: "imgs 子目录"
    description: "{article-dir}/imgs/ - 文章旁的图片文件夹"
```

### 问题 7：快速模式

```yaml
header: "快速模式"
question: "默认启用快速模式？"
options:
  - label: "否（推荐）"
    description: "每次确认维度选择"
  - label: "是"
    description: "跳过确认，使用自动选择"
```

### 问题 8：首选图像生成服务商

```yaml
header: "图像生成"
question: "首选图像生成服务商？"
options:
  - label: "自动检测（推荐）"
    description: "根据已配置的 API Key 自动选择最优服务商"
  - label: "Google Gemini"
    description: "高质量多模态生成，支持参考图"
  - label: "OpenRouter"
    description: "多模型聚合，支持参考图，费用透明"
  - label: "DashScope (通义万象)"
    description: "阿里云服务，中文文字渲染优秀"
  - label: "Replicate"
    description: "开源模型聚合，支持参考图"
```

### 问题 9：保存位置

```yaml
header: "保存"
question: "偏好设置保存在哪里？"
options:
  - label: "项目级（推荐）"
    description: ".sweety-skills/（仅限本项目）"
  - label: "用户级"
    description: "~/.sweety-skills/（所有项目）"
```

## 保存位置

| 选择 | 路径 | 作用范围 |
|------|------|----------|
| 项目级 | `.sweety-skills/sweety-cover-image/EXTEND.md` | 当前项目 |
| 用户级 | `~/.sweety-skills/sweety-cover-image/EXTEND.md` | 所有项目 |

## 设置完成后

1. 如需创建目录
2. 写入 EXTEND.md（含 frontmatter）
3. 确认："偏好设置已保存到 [path]"
4. 继续步骤 1

## EXTEND.md 模板

```yaml
---
version: 4
watermark:
  enabled: [是/否]
  content: "[用户输入或空]"
  position: bottom-right
  opacity: 0.7
preferred_type: [已选类型或 null]
preferred_palette: [已选配色或 null]
preferred_rendering: [已选渲染或 null]
preferred_text: title-only
preferred_mood: balanced
default_aspect: [16:9/2.35:1/1:1/3:4]
default_output_dir: [independent/same-dir/imgs-subdir]
quick_mode: [是/否]
language: null
preferred_provider: [已选服务商或 null]
provider_fallback_order:
  - google
  - relay
  - dashscope
  - openai
  - openrouter
  - replicate
  - jimeng
  - seedream
custom_palettes: []
---
```

## 后续修改偏好

用户可以直接编辑 EXTEND.md 或重新运行设置：
- 删除 EXTEND.md 可触发重新设置
- 直接编辑 YAML frontmatter 进行快速修改
- 完整 schema：`preferences-schema.md`

**EXTEND.md Supports**: Watermark | Preferred type | Preferred palette | Preferred rendering | Preferred text | Preferred mood | Default aspect ratio | Default output directory | Quick mode | Custom palette definitions | Language preference
