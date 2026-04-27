# 文章发表

将 Markdown 文章发布到微信公众号，支持完整格式。

## 用法

```bash
# 发布 Markdown 文章
${BUN_X} ./scripts/wechat-article.ts --markdown article.md

# 使用主题
${BUN_X} ./scripts/wechat-article.ts --markdown article.md --theme grace

# 禁用底部引用（保留外部链接原样）
${BUN_X} ./scripts/wechat-article.ts --markdown article.md --no-cite

# 指定选项
${BUN_X} ./scripts/wechat-article.ts --markdown article.md --author "作者名" --summary "摘要"
```

## 参数

| 参数 | 说明 |
|------|------|
| `--markdown <path>` | 要转换并发布的 Markdown 文件 |
| `--theme <name>` | 主题：default, grace, simple, modern |
| `--no-cite` | 保留外部链接原样，不转为底部引用 |
| `--title <text>` | 覆盖标题（默认从 Markdown 自动提取） |
| `--author <name>` | 作者名 |
| `--summary <text>` | 文章摘要 |
| `--html <path>` | 预渲染的 HTML 文件（替代 Markdown） |
| `--profile <dir>` | Chrome 配置目录 |

## Markdown 格式

```markdown
---
title: 文章标题
author: 作者名
---

# 标题（成为文章标题）

正文段落，支持 **粗体** 和 *斜体*。

## 章节标题

![图片描述](./image.png)

- 列表项 1
- 列表项 2

> 引用文字

[链接文字](https://example.com)
```

Markdown 模式默认将外部链接转为底部引用，以适配微信阅读体验。使用 `--no-cite` 可禁用此行为。

## 图片处理流程

1. **解析**：Markdown 中的图片替换为 `WECHATIMGPH_N` 占位符
2. **渲染**：HTML 生成时文本中包含占位符
3. **粘贴**：HTML 内容粘贴到微信编辑器
4. **替换**：对每个占位符依次：
   - 查找并选中占位符文本
   - 滚动到可见区域
   - 按 Backspace 删除占位符
   - 从剪贴板粘贴对应图片

## 脚本

| 脚本 | 用途 |
|------|------|
| `wechat-article.ts` | 文章发布主脚本 |
| `md-to-wechat.ts` | Markdown 转 HTML（含占位符） |
| `md/render.ts` | Markdown 渲染（含主题支持） |

## 示例流程

```
用户: /post-to-wechat --markdown ./article.md

执行过程:
1. 解析 Markdown，发现 5 张图片
2. 生成含占位符的 HTML
3. 打开 Chrome，导航到微信编辑器
4. 粘贴 HTML 内容
5. 逐张替换图片：
   - 选中 WECHATIMGPH_1
   - 滚动到可见区域
   - 按 Backspace 删除
   - 粘贴图片
6. 完成："文章已编排，共插入 5 张图片。"
```
