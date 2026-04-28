# sweety-markdown-to-html 使用与验收手册

## 1. 定位

`sweety-markdown-to-html` 是一个只负责公众号文章排版的 skill。

它不处理：

- 封面生成
- 草稿发布
- 评论回复

它负责：

- Markdown 转微信公众号兼容的内联样式 HTML
- 30 套主题和 5 大分类画廊
- AI 排版增强
- CJK 排版修复
- 本地图片和 Obsidian 图片处理
- 外链脚注
- 容器语法和主题预览
- 兼容 `sweety-post-to-wechat` 的 JSON 输出契约

## 2. 目录结构

```text
sweety-markdown-to-html/
├── SKILL.md
├── README_CN.md
├── config.example.json
├── references/
│   └── guide.md
├── scripts/
│   ├── engine.ts
│   ├── engine.test.ts
│   ├── main.ts
│   └── package.json
├── templates/
│   ├── gallery.html
│   └── preview.html
└── themes/
    └── *.json
```

## 3. 安装与依赖

当前仓库内直接使用即可，不需要 Python 依赖。

执行命令统一用 Bun：

```bash
npx -y bun skills/sweety-markdown-to-html/scripts/main.ts article.md --theme newspaper
```

## 4. 配置

复制 `config.example.json` 为 `config.json`。

```json
{
  "output_dir": "/tmp/wechat-format",
  "vault_root": "/path/to/your/obsidian/vault",
  "image_search_paths": [],
  "settings": {
    "default_theme": "newspaper",
    "auto_open_browser": true
  }
}
```

字段说明：

- `output_dir`: 默认输出目录
- `vault_root`: Obsidian Vault 根目录，用于解析 `![[image]]`
- `image_search_paths`: 额外图片搜索目录
- `settings.default_theme`: 默认主题
- `settings.auto_open_browser`: 是否自动打开预览页

## 5. CLI 参数

```bash
npx -y bun skills/sweety-markdown-to-html/scripts/main.ts <markdown_path> [options]
```

参数：

- `--theme <id>`: 指定主题，支持 30 套主题和兼容别名 `default/grace/simple/modern`
- `--gallery`: 生成主题画廊
- `--recommend <id...>`: 在画廊中高亮推荐主题
- `--format <wechat|html|plain>`: 输出格式，默认 `wechat`
- `--output <dir>`: 指定输出目录
- `--article-html <file>`: 指定文章 HTML 输出文件
- `--preview-html <file>`: 指定单主题预览页输出文件
- `--gallery-html <file>`: 指定画廊页输出文件
- `--assets-dir <dir>`: 指定图片输出目录
- `--vault-root <dir>`: 指定 Vault 根目录
- `--color <hex>`: 覆盖主题强调色
- `--no-open`: 不自动打开浏览器

返回 JSON 字段：

- `title`
- `author`
- `summary`
- `htmlPath`
- `previewPath`
- `galleryPath`
- `articlePath`
- `contentImages`
- `theme`
- `wordCount`

## 6. 30 套主题

全部主题 ID：

- `bauhaus`
- `bold-blue`
- `bold-green`
- `bold-navy`
- `bytedance`
- `chinese`
- `coffee-house`
- `elegant-blue`
- `elegant-green`
- `elegant-navy`
- `focus-blue`
- `focus-gold`
- `focus-red`
- `github`
- `ink`
- `lavender-dream`
- `magazine`
- `midnight`
- `minimal-blue`
- `minimal-gold`
- `minimal-gray`
- `minimal-navy`
- `minimal-red`
- `mint-fresh`
- `newspaper`
- `sports`
- `sspai`
- `sunset-amber`
- `terracotta`
- `wechat-native`

分类：

- 深度长文: `newspaper`, `magazine`, `ink`, `coffee-house`
- 科技产品: `bytedance`, `github`, `sspai`, `midnight`
- 文艺随笔: `terracotta`, `mint-fresh`, `sunset-amber`, `lavender-dream`
- 活力动态: `sports`, `bauhaus`, `chinese`, `wechat-native`
- 模板布局: `bold-*`, `elegant-*`, `focus-*`, `minimal-*`

兼容旧主题别名：

- `default` -> `wechat-native`
- `grace` -> `elegant-blue`
- `simple` -> `minimal-gray`
- `modern` -> `bytedance`

## 7. AI 排版增强规则

这个 skill 的 AI 增强只做排版增强，不改文章事实和主要措辞。

处理规则：

- 对话体：连续出现 `张三：...`、`A: ...` 这类行时，自动包成 `dialogue`
- 连续图片：3 张及以上连续图片自动包成 `gallery`
- 重点句：`核心观点:`、`结论:`、`注意:`、`提示:` 等行自动转为合适的 callout
- 结构较弱的中文文本：自动补空行、基础标题和列表

## 8. 容器语法

### dialogue

```markdown
:::dialogue[对话]
张三：第一句
李四：第二句
:::
```

### gallery

```markdown
:::gallery[图集]
![](a.png)
![](b.png)
![](c.png)
:::
```

### longimage

```markdown
:::longimage[长图]
![](long.png)
:::
```

### stat

```markdown
:::stat[数据]
增长率：43%
活跃用户：12 万
:::
```

### timeline

```markdown
:::timeline[时间线]
2024 - 立项
2025 - 上线
:::
```

### steps

```markdown
:::steps[步骤]
准备素材
渲染 HTML
复制到微信后台
:::
```

### compare

```markdown
:::compare[对比]
旧方案 | 4 套主题
新方案 | 30 套主题
:::
```

### quote

```markdown
:::quote[引用]
这是引用内容。
:::
```

### callout

```markdown
> [!important] 核心观点
> 这里是重点内容

> [!tip] 小技巧
> 这里是提示

> [!warning] 注意事项
> 这里是警告
```

支持的 callout 类型：

- `tip`
- `note`
- `important`
- `warning`
- `caution`
- `callout`

## 9. 图片与脚注

- 支持标准 Markdown 图片：`![](image.png)`
- 支持 Obsidian 图片：`![[image.png]]`
- 本地图片会复制到输出目录下的 `images/`
- 外部链接会转换成文末 `参考链接`
- 手写脚注 `[^1]` 也会生成脚注区

## 10. 输出说明

默认会生成：

- `article.html`: 最终文章 HTML
- `preview.html`: 单主题预览页

启用 `--gallery` 时会生成：

- `article.html`
- `gallery.html`

`sweety-post-to-wechat` 读取的是 `article.html`，并从里面抽取 `<div id="output">...</div>` 作为正文。

## 11. 与 sweety-post-to-wechat 的替换方式

当前替换点是：

- `skills/sweety-post-to-wechat/scripts/md-to-wechat.ts`

它已经切换为调用：

- `skills/sweety-markdown-to-html/scripts/engine.ts`

兼容策略：

- 保留 `--theme`
- 保留 `--color`
- 保留 `--no-cite` 参数位，当前作为兼容参数接受
- 输出仍返回 `title`、`author`、`summary`、`htmlPath`、`contentImages`

## 12. 与 tujie-wanwu-wechat 的集成说明

真实调用链：

1. `tujie-wanwu-wechat/scripts/publish-draft.ts`
2. `sweety-post-to-wechat/scripts/wechat-api.ts`
3. `sweety-post-to-wechat/scripts/md-to-wechat.ts`
4. `sweety-markdown-to-html/scripts/engine.ts`

因此验收重点不是修改 `tujie-wanwu-wechat` 本身，而是确认这条链路在 `--theme`、`--color`、`--no-cite`、HTML 路径和图片占位符上不回归。

## 13. 测试命令

运行新 skill 测试：

```bash
npx -y bun test skills/sweety-markdown-to-html/scripts/engine.test.ts
```

运行兼容层测试：

```bash
npx -y bun test skills/sweety-post-to-wechat/scripts/md-to-wechat.test.ts
```

运行 dry-run 验收：

```bash
npx -y bun skills/sweety-post-to-wechat/scripts/wechat-api.ts article.md --theme default --dry-run
```

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/publish-draft.ts article.md --work-type article --account demo --theme default --dry-run
```

## 14. 验收清单

- 30 个主题都可加载
- `default/grace/simple/modern` 旧别名可用
- `article.html` 含 `<div id="output">`
- 微信模式输出为内联样式 HTML
- 画廊页含 5 大分类和 30 个主题按钮
- 画廊页含推荐高亮、复制按钮、15px/16px 字号切换和 localStorage 持久化
- 对话体自动转 `dialogue`
- 连续图片自动转 `gallery`
- 金句和提示自动转 callout
- 外链转为 `参考链接`
- Markdown 图片和 `![[image]]` 可复制到输出目录
- `sweety-post-to-wechat/scripts/md-to-wechat.ts` 输出 JSON 契约不变
- `wechat-api.ts --dry-run` 可跑通
- `tujie-wanwu-wechat/scripts/publish-draft.ts --dry-run` 可沿真实链路跑通
