# 掘金字段

`sweety-post-to-juejin` 使用 Markdown，不转 HTML。

正文规则：

- 已有 Markdown 结构时保持原样。
- 纯文本或 X 长文会自动增加保守 Markdown 排版。
- 自动排版只添加 Markdown 标记，不改正文可见文字。
- 独立公式/成本计算行可以转为 `text` 代码块。
- 问句或明显分节句可以转为二级标题。

必填字段：

- `title`: 文章标题，最长 80 字。
- `brief`: 简介，最长 100 字。
- `category`: 分类名称，例如 `开发工具`、`人工智能`、`前端`、`后端`。
- `tags`: 1 到 5 个标签。

可选字段：

- `cover`: 本地封面图路径，支持相对 Markdown 文件目录。

字段来源优先级：

1. CLI 参数。
2. Markdown frontmatter。

frontmatter 兼容键：

- `brief`、`description`、`summary`。
- `cover`、`cover_image`、`coverImage`。
- `tags`、`tag`。

禁止行为：

- 不自动生成或替换用户未提供的标签。
- 不自动改写简介。
- 不自动补分类。
- 不为普通短句强行生成标题。
