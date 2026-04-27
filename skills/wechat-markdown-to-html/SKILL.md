---
name: wechat-markdown-to-html
description: 纯公众号排版 skill。把 Markdown、纯文本笔记或 Obsidian 风格文章转成微信公众号兼容的内联样式 HTML，支持 30 套主题、主题画廊、AI 排版增强、CJK 修复、脚注、图片处理和容器语法。用户提到公众号排版、微信 Markdown 转 HTML、主题预览、dialogue/gallery/callout 容器或需要兼容 sweety-post-to-wechat 的 Markdown 渲染时使用。
---

# Wechat Markdown To HTML

这个 skill 只负责公众号文章排版，不负责封面生成、草稿发布或评论回复。

## 何时使用

- 需要把 Markdown 转成微信公众号兼容的内联样式 HTML
- 需要在 30 套主题中预览和选择排版风格
- 需要把纯文本或结构较弱的中文内容整理成适合公众号的 Markdown 后再排版
- 需要处理对话体、连续图片、金句、脚注、Obsidian 图片引用
- 需要为 `sweety-post-to-wechat` 或 `tujie-wanwu-wechat` 提供 Markdown 渲染能力

## 目录

- `scripts/main.ts`: CLI 入口
- `scripts/engine.ts`: 纯排版引擎
- `themes/`: 30 套主题 JSON
- `templates/`: 预览页和画廊页模板
- `references/guide.md`: 详细说明、主题、测试和验收文档

## 基本用法

```bash
npx -y bun skills/wechat-markdown-to-html/scripts/main.ts article.md --theme newspaper --no-open
```

生成主题画廊：

```bash
npx -y bun skills/wechat-markdown-to-html/scripts/main.ts article.md --gallery --recommend newspaper magazine ink --no-open
```

## 工作流

1. 读取 Markdown 或纯文本输入。
2. 如果结构很弱，先补基本标题、段落、列表和强调。
3. 自动识别对话体、连续图片、重点句，并补成 `dialogue`、`gallery`、`callout` 等容器。
4. 做 CJK 间距修复、加粗标点修复、外链脚注转换、图片路径处理。
5. 渲染为微信兼容 HTML，并生成预览页或主题画廊。

## 输出契约

CLI 输出 JSON，至少包含：

```json
{
  "title": "文章标题",
  "author": "作者名",
  "summary": "摘要",
  "htmlPath": "/abs/path/to/preview-or-gallery.html",
  "articlePath": "/abs/path/to/article.html",
  "contentImages": []
}
```

`sweety-post-to-wechat/scripts/md-to-wechat.ts` 依赖这个契约。

## 配置

复制 `config.example.json` 为 `config.json`，只保留排版相关配置：

- `output_dir`
- `vault_root`
- `image_search_paths`
- `settings.default_theme`
- `settings.auto_open_browser`

## 详细文档

需要查看参数、主题清单、容器语法、替换方案、测试命令和验收清单时，读取 [references/guide.md](references/guide.md)。
