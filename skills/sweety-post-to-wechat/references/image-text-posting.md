# 贴图发表（原图文）

发布多图贴图消息到微信公众号。默认使用官方 API 的图片消息 `newspic`；浏览器方式保留为完整 fallback。

> **注意**：微信已将公众号菜单中的「图文」更名为「贴图」（2026年起）。

## 用法

```bash
# API：使用图片目录发布到草稿箱
${BUN_X} ./scripts/wechat-api.ts ./images/ --type newspic --title "标题" --content "正文"

# API：使用 Markdown 中的图片发布贴图
${BUN_X} ./scripts/wechat-api.ts source.md --type newspic --theme default

# 浏览器 fallback：使用 Markdown 文件和图片目录
${BUN_X} ./scripts/wechat-browser.ts --markdown source.md --images ./images/ --submit

# 浏览器 fallback：指定标题和内容
${BUN_X} ./scripts/wechat-browser.ts --title "标题" --content "内容" --image img1.png --image img2.png --submit
```

## 参数

### API 参数

| 参数 | 说明 |
|------|------|
| `<images_dir>` | 图片目录，按文件名排序，最多 20 张 |
| `--type newspic` | 使用微信官方图片消息草稿类型 |
| `--title <text>` | 贴图标题 |
| `--content <text>` | 贴图正文；图片目录模式必填 |
| `--account <alias>` | 按别名选择账号 |
| `--dry-run` | 仅解析，不上传、不保存草稿 |

### 浏览器 fallback 参数

| 参数 | 说明 |
|------|------|
| `--markdown <path>` | 用于提取标题/内容的 Markdown 文件 |
| `--images <dir>` | 包含图片的目录（按文件名排序） |
| `--title <text>` | 文章标题（最多 20 字，超长自动压缩） |
| `--content <text>` | 文章内容（最多 1000 字，超长自动压缩） |
| `--image <path>` | 单张图片文件（可重复使用） |
| `--submit` | 保存为草稿（默认：仅预览） |
| `--profile <dir>` | Chrome 配置目录 |

## 从 Markdown 自动提取标题/内容

使用 `--markdown` 时，脚本会：

1. **解析 frontmatter** 获取标题和作者：
   ```yaml
   ---
   title: 文章标题
   author: 作者名
   ---
   ```

2. **回退到 H1 标题**（无 frontmatter 标题时）：
   ```markdown
   # 这将成为标题
   ```

3. **压缩标题** 至 20 字以内：
   - 原始："如何在一天内彻底重塑你的人生"
   - 压缩后："一天彻底重塑你的人生"

4. **提取首段文字** 作为内容（最多 1000 字）

## 图片目录模式

API 使用 `<images_dir> --type newspic` 时：

- 目录中所有 PNG/JPG/JPEG/GIF/WEBP/BMP 文件都会被上传为永久图片素材
- 文件按字母顺序排序
- 最多 20 张，首张图片即为封面图
- 每张图片通过 `material/add_material?type=image` 获取永久 `media_id`
- 草稿通过 `draft/add`，`article_type` 为 `newspic`

浏览器 fallback 使用 `--images <dir>` 时：

- 目录中所有 PNG/JPG 文件都会被上传
- 文件按字母顺序排序
- 命名规范：`01-cover.png`、`02-content.png` 等

## 限制

| 字段 | 最大长度 | 备注 |
|------|----------|------|
| 标题 | 32 字 | API；浏览器 fallback 会压缩到 20 字 |
| 内容 | 纯文本 | API 图片消息仅支持纯文本和部分特殊功能标签；浏览器 fallback 最多 1000 字 |
| 图片 | 最多 20 张 | API `newspic`；浏览器 fallback 仍按后台页面限制处理 |

## 官方 API 依据

- 新增草稿：`https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add`
- 上传永久素材：`https://developers.weixin.qq.com/doc/service/api/material/permanent/api_addmaterial`
- 上传发表内容中的图片：`https://developers.weixin.qq.com/doc/service/api/notify/message/api_uploadimage.html`

## 示例流程

```
用户: /post-to-wechat --type newspic --title "标题" --content "正文" ./xhs-images/

执行过程:
1. 在 xhs-images/ 目录找到图片并排序
2. 逐张调用永久素材上传接口获取 `image_media_id`
3. 调用 `draft/add`，`article_type` 为 `newspic`
4. 返回草稿 `media_id`
5. 若 API 失败，回退执行 `wechat-browser.ts --images ./xhs-images/ --submit`
```

## 脚本

| 脚本 | 用途 |
|------|------|
| `wechat-api.ts` | 贴图 API 主脚本 |
| `wechat-browser.ts` | 贴图浏览器 fallback |
| `cdp.ts` | Chrome DevTools Protocol 工具 |
| `copy-to-clipboard.ts` | 剪贴板操作 |
