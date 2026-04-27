---
name: watermark-guide
description: sweety-cover-image 水印配置指南
---

# 水印指南

## 位置示意图

```
┌─────────────────────────────┐
│                  [top-right]│
│                             │
│                             │
│       封面图                │
│                             │
│                             │
│[bottom-left][bottom-center][bottom-right]│
└─────────────────────────────┘
```

## 位置推荐

| 位置 | 适用 | 避免 |
|------|------|------|
| `bottom-right` | 默认选择，最常用 | 标题在右下角时 |
| `bottom-left` | 偏右布局 | 关键视觉在左下角时 |
| `bottom-center` | 居中设计 | 底部文字密集时 |
| `top-right` | 偏下布局 | 标题/头部在右上角时 |

## 内容格式

| 格式 | 示例 | 风格 |
|------|------|------|
| 用户名 | `@username` | 社交媒体 |
| 域名 | `myblog.com` | 跨平台 |
| 品牌 | `MyBrand` | 简单品牌标识 |
| 中文 | `博客名` | 中文平台 |

## 最佳实践

1. **一致性**：所有封面使用相同水印
2. **可读性**：确保水印在明暗区域都可读
3. **大小**：保持低调——不应干扰主要内容

## Prompt 集成

启用水印时，添加到图像生成提示词中：

```
Include a subtle watermark "[content]" positioned at [position].
The watermark should be legible but not distracting from the main content.
```

## 封面专属注意事项

| 宽高比 | 推荐位置 | 说明 |
|--------|----------|------|
| 2.35:1 | bottom-right | 电影感——保持角落干净 |
| 16:9 | bottom-right | 标准——位置灵活 |
| 1:1 | bottom-center | 方形——居中通常更好 |

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 水印不可见 | 调整位置或检查对比度 |
| 水印太突出 | 更改位置或减小尺寸 |
| 水印与标题重叠 | 更改位置或缩小标题区域 |
