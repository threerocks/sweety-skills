---
name: sweety-post-to-juejin
description: Use when the user asks to publish, draft, or prepare a Markdown article for Juejin/掘金. Creates a safe browser-based Juejin draft from the original Markdown, supports cover image, category, tags, and brief, and defaults to stopping before final publish unless explicitly requested.
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-post-to-juejin
    requires:
      anyBins:
        - bun
        - npx
---

# 发布到掘金

这个 skill 把本地 Markdown 或 X/纯文本长文准备成掘金草稿，并补齐标题、简介、分类、标签和封面。默认只准备草稿和发布设置，不点击最终发布。

## 安全边界

- 默认使用真实 Chrome 浏览器和用户登录态，不保存 Cookie。
- 默认不调用掘金私有发布 API。
- 默认不发布，只停在可人工审核的发布设置状态。
- 只有用户明确要求发布，或 CLI 显式传 `--publish`，才点击最终发布控件。
- 已有 Markdown 结构时保留原文；纯文本/X 长文只增加 Markdown 排版结构，不改可见正文文字。
- 不自动优化标题、简介、分类或标签。
- 如果提供了封面但无法确认上传成功，必须停止并报错，不能把半成品当成可发布草稿。

## 脚本目录

以本 `SKILL.md` 所在目录为 `{baseDir}`。运行时解析 `${BUN_X}`：若已安装 `bun`，使用 `bun`；否则若有 `npx`，使用 `npx -y bun`。

| 脚本 | 用途 |
|------|------|
| `scripts/juejin-browser.ts` | 打开掘金编辑器并填入 Markdown、封面、分类、标签、简介 |
| `scripts/check-permissions.ts` | 检查 Chrome 和默认 profile 位置 |
| `scripts/juejin-draft.ts` | 解析 Markdown frontmatter、校验字段、为纯文本增加掘金 Markdown 排版 |

## 输入字段

推荐在 Markdown frontmatter 中写：

```yaml
---
title: 文章标题
brief: 100 字以内简介
category: 开发工具
tags: AI编程, OpenAI, AIGC
cover: ./cover.jpg
---
```

CLI 参数会覆盖 frontmatter：

```bash
${BUN_X} {baseDir}/scripts/juejin-browser.ts article.md \
  --title "文章标题" \
  --brief "100 字以内简介" \
  --category "开发工具" \
  --tag "AI编程" \
  --tag "OpenAI" \
  --cover ./cover.jpg
```

字段规则：

- `title` 必填，最长 80 字。
- `brief` 必填，最长 100 字。
- `category` 必填。
- `tags` 必填，1 到 5 个。
- `cover` 可选，支持相对 Markdown 文件目录的路径。

## 正文排版

- 如果正文已经包含标题、引用、代码块、列表或表格等 Markdown 结构，保持原样。
- 如果正文是 X 长文/纯文本段落，自动做保守排版：
  - 独立公式或成本计算行转为 `text` 代码块。
  - 问句或明显分节句转为二级标题。
  - 普通短句不强行转标题。
- 排版只添加 Markdown 标记，不改正文可见文字。

## Chrome 登录态

## 发布模式

默认草稿/人工审核：

```bash
${BUN_X} {baseDir}/scripts/juejin-browser.ts article.md
```

显式最终发布：

```bash
${BUN_X} {baseDir}/scripts/juejin-browser.ts article.md --publish
```

除非用户明确要求 `--publish`，不要代替用户点击最终发布。

## 首次使用

```bash
${BUN_X} {baseDir}/scripts/check-permissions.ts
```

如果脚本打开后无法进入编辑器，说明脚本使用的 Chrome profile 未登录掘金。让用户在打开的浏览器里登录 `https://juejin.cn`，然后重试。

如果用户明确说“普通 Chrome 已登录掘金”，优先使用 Codex Chrome 插件控制现有 Chrome 标签页；不要改用默认隔离 profile。若必须使用脚本，传 `--profile` 指向已登录且可被 CDP 启动的 profile。

使用普通 Chrome 登录态时，如果 Codex Chrome Extension 通信失败或连续超时，必须停止并要求恢复扩展连接；不要切回默认隔离 profile 假装继续完成，因为隔离 profile 通常没有用户的掘金登录态。

封面上传有两条路径：

- `juejin-browser.ts` 的 CDP 路径使用 `DOM.setFileInputFiles`，给了 `cover` 就必须验证上传成功。
- Codex Chrome 插件路径如果上传本地文件失败，提示用户在 `chrome://extensions` 为 Codex extension 打开 `Allow access to file URLs`，然后重试；不要继续报告“完整可发布”。

## 参考资料

- 字段和限制：见 `references/fields.md`
- 编辑器行为：见 `references/editor-behavior.md`
- 停止条件：见 `references/stop-conditions.md`
