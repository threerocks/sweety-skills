---
name: sweety-post-to-wechat
description: 发布内容到微信公众号，支持 API 或 Chrome CDP 方式。支持文章发表（HTML、Markdown 或纯文本输入）和贴图发表（多图）。Markdown 文章模式默认将外部链接转为底部引用。触发词："发布公众号"、"post to wechat"、"微信公众号"、"贴图/图文/文章"。
version: 1.56.1
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-post-to-wechat
    requires:
      anyBins:
        - bun
        - npx
---

# 发布到微信公众号

## 语言

**匹配用户语言**：使用与用户相同的语言回复。用户使用中文则用中文回复，使用英文则用英文回复。

## 脚本目录

**Agent 执行方式**：以本 SKILL.md 所在目录为 `{baseDir}`，脚本路径为 `{baseDir}/scripts/<name>.ts`。运行时解析 `${BUN_X}`：若已安装 `bun` → 使用 `bun`；若有 `npx` → 使用 `npx -y bun`；否则提示安装 bun。

| 脚本 | 用途 |
|------|------|
| `scripts/wechat-browser.ts` | 贴图发表（浏览器 fallback） |
| `scripts/wechat-article.ts` | 文章发表（浏览器方式） |
| `scripts/wechat-api.ts` | 文章 / 贴图发表（API 方式，`--type newspic` 可直接发贴图） |
| `scripts/md-to-wechat.ts` | Markdown → 微信适配 HTML（含图片占位符） |
| `scripts/check-permissions.ts` | 检查环境与权限 |

## 偏好设置 (EXTEND.md)

按优先级检查 EXTEND.md 是否存在：

```bash
# macOS, Linux, WSL, Git Bash
test -f .sweety-skills/sweety-post-to-wechat/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-post-to-wechat/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-post-to-wechat/EXTEND.md" && echo "user"
```

```powershell
# PowerShell (Windows)
if (Test-Path .sweety-skills/sweety-post-to-wechat/EXTEND.md) { "project" }
$xdg = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { "$HOME/.config" }
if (Test-Path "$xdg/sweety-skills/sweety-post-to-wechat/EXTEND.md") { "xdg" }
if (Test-Path "$HOME/.sweety-skills/sweety-post-to-wechat/EXTEND.md") { "user" }
```

┌────────────────────────────────────────────────────────┬───────────────┐
│                         路径                           │     位置      │
├────────────────────────────────────────────────────────┼───────────────┤
│ .sweety-skills/sweety-post-to-wechat/EXTEND.md           │ 项目目录      │
├────────────────────────────────────────────────────────┼───────────────┤
│ $HOME/.sweety-skills/sweety-post-to-wechat/EXTEND.md     │ 用户主目录    │
└────────────────────────────────────────────────────────┴───────────────┘

┌──────────┬───────────────────────────────────────────────────────────────────────────┐
│   结果   │                                  操作                                     │
├──────────┼───────────────────────────────────────────────────────────────────────────┤
│ 找到     │ 读取、解析、应用设置                                                       │
├──────────┼───────────────────────────────────────────────────────────────────────────┤
│ 未找到   │ 执行首次设置（[references/config/first-time-setup.md](references/config/first-time-setup.md)）→ 保存 → 继续 │
└──────────┴───────────────────────────────────────────────────────────────────────────┘

**EXTEND.md 支持的配置项**：默认主题 | 默认颜色 | 默认发布方式 (api/browser) | 默认作者 | 默认开启评论 | 默认仅粉丝可评论 | Chrome 配置目录 | API 请求地址 (base_url)

首次设置：[references/config/first-time-setup.md](references/config/first-time-setup.md)

**最小支持键**（不区分大小写，接受 `1/0` 或 `true/false`）：

| 键 | 默认值 | 映射 |
|----|--------|------|
| `default_author` | 空 | 未通过 CLI/frontmatter 提供时的回退作者 |
| `need_open_comment` | `1` | `draft/add` 请求中的 `articles[].need_open_comment` |
| `only_fans_can_comment` | `0` | `draft/add` 请求中的 `articles[].only_fans_can_comment` |
| `base_url` | `https://api.weixin.qq.com` | 微信 API 请求的基础地址 |

**推荐 EXTEND.md 示例**：

```md
default_theme: default
default_color: blue
default_publish_method: api
default_author: 作者名
need_open_comment: 1
only_fans_can_comment: 0
chrome_profile_path: /path/to/chrome/profile
```

**主题选项**：default, grace, simple, modern

**颜色预设**：blue, green, vermilion, yellow, purple, sky, rose, olive, black, gray, pink, red, orange（或十六进制值）

**配置优先级**：
1. CLI 参数
2. Frontmatter
3. EXTEND.md（账号级 → 全局级）
4. 技能默认值

## API 请求地址配置 (base_url)

默认使用微信官方 API 地址 `https://api.weixin.qq.com`。如需自定义，可在 EXTEND.md 中配置 `base_url`：

```md
base_url: https://your-proxy.example.com
```

> **⚠️ 稳定 IP 建议**：微信公众号 API 推送最好使用稳定的出口 IP 地址。如果你的网络出口 IP 不稳定（如家庭宽带、动态 IP 环境），建议在拥有稳定固定 IP 的服务器上搭建转发代理，然后将 `base_url` 指向该代理地址。这样可以避免因 IP 变化导致微信 API 调用失败（微信公众号后台需要配置 IP 白名单）。

### 内置转发代理

本技能提供了一个零依赖的 Node.js 转发代理脚本 `scripts/wechat-proxy.mjs`，可直接部署到拥有固定 IP 的服务器上：

```bash
# 默认监听 9100 端口
node wechat-proxy.mjs

# 自定义端口
node wechat-proxy.mjs 8080
```

然后在 EXTEND.md 中配置：

```md
base_url: http://你的服务器IP:9100
```

## 多账号支持

EXTEND.md 支持管理多个微信公众号。当存在 `accounts:` 块时，每个账号可以拥有独立的凭据、Chrome 配置和默认设置。

**兼容性规则**：

| 条件 | 模式 | 行为 |
|------|------|------|
| 无 `accounts` 块 | 单账号 | 当前行为，无变化 |
| `accounts` 含 1 个条目 | 单账号 | 自动选择，不提示 |
| `accounts` 含 2+ 个条目 | 多账号 | 发布前提示选择 |
| `accounts` 含 `default: true` | 多账号 | 预选默认账号，用户可切换 |

**多账号 EXTEND.md 示例**：

```md
default_theme: default
default_color: blue

accounts:
  - name: 技术分享
    alias: tech
    default: true
    default_publish_method: api
    default_author: 作者名
    need_open_comment: 1
    only_fans_can_comment: 0
    app_id: your_wechat_app_id
    app_secret: your_wechat_app_secret
  - name: AI工具集
    alias: ai-tools
    default_publish_method: browser
    default_author: AI工具集
    need_open_comment: 1
    only_fans_can_comment: 0
```

**账号级键**（可设置在账号内或全局作为回退）：
`default_publish_method`, `default_author`, `need_open_comment`, `only_fans_can_comment`, `app_id`, `app_secret`, `chrome_profile_path`

**全局键**（所有账号共享）：
`default_theme`, `default_color`, `base_url`

### 账号选择（步骤 0.5）

在文章发布工作流的步骤 0 和步骤 1 之间插入：

```
if 无 accounts 块:
    → 单账号模式（当前行为）
elif accounts.length == 1:
    → 自动选择唯一账号
elif --account <alias> CLI 参数:
    → 选择匹配的账号
elif 某账号设置 default: true:
    → 预选该账号，显示: "使用账号: <name>（--account 切换）"
else:
    → 提示用户:
      "已配置多个微信公众号:
       1) <name1> (<alias1>)
       2) <name2> (<alias2>)
       请选择账号 [1-N]:"
```

### 凭据解析（API 方式）

对于选中的账号（alias 为 `{alias}`）：

1. EXTEND.md 账号块中的 `app_id` / `app_secret`
2. 环境变量 `WECHAT_{ALIAS}_APP_ID` / `WECHAT_{ALIAS}_APP_SECRET`（alias 大写，连字符转下划线）
3. `.sweety-skills/.env` 中带前缀的键 `WECHAT_{ALIAS}_APP_ID`
4. `~/.sweety-skills/.env` 中带前缀的键
5. 回退到无前缀的 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`

**.env 多账号示例**：

```bash
# 账号: tech
WECHAT_TECH_APP_ID=your_wechat_app_id
WECHAT_TECH_APP_SECRET=your_wechat_app_secret

# 账号: ai-tools
WECHAT_AI_TOOLS_APP_ID=your_ai_tools_wechat_app_id
WECHAT_AI_TOOLS_APP_SECRET=your_ai_tools_wechat_app_secret
```

### Chrome 配置（浏览器方式）

每个账号使用隔离的 Chrome 配置目录以保持独立的登录会话：

| 来源 | 路径 |
|------|------|
| EXTEND.md 中账号的 `chrome_profile_path` | 直接使用 |
| 根据 alias 自动生成 | `{shared_profile_parent}/wechat-{alias}/` |
| 单账号回退 | 使用共享默认配置目录（当前行为） |

### CLI `--account` 参数

所有发布脚本均接受 `--account <alias>`：

```bash
${BUN_X} {baseDir}/scripts/wechat-api.ts <file> --theme default --account ai-tools
${BUN_X} {baseDir}/scripts/wechat-article.ts --markdown <file> --theme default --account sweety
${BUN_X} {baseDir}/scripts/wechat-browser.ts --markdown <file> --images ./photos/ --account sweety
```

## Pre-flight Check (Optional)

Before first use, suggest running the environment check. User can skip if they prefer.

```bash
${BUN_X} {baseDir}/scripts/check-permissions.ts
```

Checks: Chrome, profile isolation, Bun, Accessibility, clipboard, paste keystroke, API credentials, Chrome conflicts.

**If any check fails**, provide fix guidance per item:

| Check | Fix |
|-------|-----|
| Chrome | Install Chrome or set `WECHAT_BROWSER_CHROME_PATH` env var |
| Profile dir | Shared profile at `sweety-skills/chrome-profile` (see `docs/chrome-profile.md`) |
| Bun runtime | `brew install oven-sh/bun/bun` (macOS) or `npm install -g bun` |
| Accessibility (macOS) | System Settings → Privacy & Security → Accessibility → enable terminal app |
| Clipboard copy | Ensure Swift/AppKit available (macOS Xcode CLI tools: `xcode-select --install`) |
| Paste keystroke (macOS) | Same as Accessibility fix above |
| Paste keystroke (Linux) | Install `xdotool` (X11) or `ydotool` (Wayland) |
| API credentials | Follow guided setup in Step 2, or manually set in `.sweety-skills/.env` |

## Image-Text Posting (贴图 / 图片消息)

**默认走 API。** 微信官方 `draft/add` 文档支持 `article_type: "newspic"`，即图片消息；贴图图片列表使用 `image_info.image_list[].image_media_id`，图片 `media_id` 必须来自永久素材上传。

```bash
${BUN_X} {baseDir}/scripts/wechat-api.ts ./images/ --type newspic --title "标题" --content "正文" --account <alias>
${BUN_X} {baseDir}/scripts/wechat-api.ts article.md --type newspic --theme default --account <alias>
```

官方依据：
- 新增草稿：`https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add`
- 上传永久素材：`https://developers.weixin.qq.com/doc/service/api/material/permanent/api_addmaterial`
- 上传发表内容中的图片：`https://developers.weixin.qq.com/doc/service/api/notify/message/api_uploadimage.html`

API 贴图失败时，完整回退到浏览器方式，不修改内容、不继续尝试其他发送路径：

```bash
${BUN_X} {baseDir}/scripts/wechat-browser.ts --markdown article.md --images ./images/ --submit
${BUN_X} {baseDir}/scripts/wechat-browser.ts --title "标题" --content "正文" --image img.png --submit
```

See [references/image-text-posting.md](references/image-text-posting.md) for details.

## Article Posting Workflow (文章)

Copy this checklist and check off items as you complete them:

```
Publishing Progress:
- [ ] Step 0: Load preferences (EXTEND.md)
- [ ] Step 0.5: Resolve account (multi-account only)
- [ ] Step 1: Determine input type
- [ ] Step 2: Select method and configure credentials
- [ ] Step 3: Resolve theme/color and validate metadata
- [ ] Step 4: Publish to WeChat
- [ ] Step 5: Report completion
```

### Step 0: Load Preferences

Check and load EXTEND.md settings (see Preferences section above).

**CRITICAL**: If not found, complete first-time setup BEFORE any other steps or questions.

Resolve and store these defaults for later steps:
- `default_theme` (default `default`)
- `default_color` (omit if not set — theme default applies)
- `default_author`
- `need_open_comment` (default `1`)
- `only_fans_can_comment` (default `0`)

### Step 1: Determine Input Type

| Input Type | Detection | Action |
|------------|-----------|--------|
| HTML file | Path ends with `.html`, file exists | Skip to Step 3 |
| Markdown file | Path ends with `.md`, file exists | Continue to Step 2 |
| Plain text | Not a file path, or file doesn't exist | Save to markdown, continue to Step 2 |

**Plain Text Handling**:

1. Generate slug from content (first 2-4 meaningful words, kebab-case)
2. Create directory and save file:

```bash
mkdir -p "$(pwd)/post-to-wechat/$(date +%Y-%m-%d)"
# Save content to: post-to-wechat/yyyy-MM-dd/[slug].md
```

3. Continue processing as markdown file

**Slug Examples**:
- "Understanding AI Models" → `understanding-ai-models`
- "人工智能的未来" → `ai-future` (translate to English for slug)

### Step 2: Select Publishing Method and Configure

**Ask publishing method** (unless specified in EXTEND.md or CLI):

| Method | Speed | Requirements |
|--------|-------|--------------|
| `api` (Recommended) | Fast | API credentials |
| `browser` | Slow | Chrome, login session |

**If API Selected - Check Credentials**:

```bash
# macOS, Linux, WSL, Git Bash
test -f .sweety-skills/.env && grep -q "WECHAT_APP_ID" .sweety-skills/.env && echo "project"
test -f "$HOME/.sweety-skills/.env" && grep -q "WECHAT_APP_ID" "$HOME/.sweety-skills/.env" && echo "user"
```

```powershell
# PowerShell (Windows)
if ((Test-Path .sweety-skills/.env) -and (Select-String -Quiet -Pattern "WECHAT_APP_ID" .sweety-skills/.env)) { "project" }
if ((Test-Path "$HOME/.sweety-skills/.env") -and (Select-String -Quiet -Pattern "WECHAT_APP_ID" "$HOME/.sweety-skills/.env")) { "user" }
```

**If Credentials Missing - Guide Setup**:

```
WeChat API credentials not found.

To obtain credentials:
1. Visit https://mp.weixin.qq.com
2. Go to: 开发 → 基本配置
3. Copy AppID and AppSecret

Where to save?
A) Project-level: .sweety-skills/.env (this project only)
B) User-level: ~/.sweety-skills/.env (all projects)
```

After location choice, prompt for values and write to `.env`:

```
WECHAT_APP_ID=<user_input>
WECHAT_APP_SECRET=<user_input>
```

### Step 3: Resolve Theme/Color and Validate Metadata

1. **Resolve theme** (first match wins, do NOT ask user if resolved):
   - CLI `--theme` argument
   - EXTEND.md `default_theme` (loaded in Step 0)
   - Fallback: `default`

2. **Resolve color** (first match wins):
   - CLI `--color` argument
   - EXTEND.md `default_color` (loaded in Step 0)
   - Omit if not set (theme default applies)

3. **Validate metadata** from frontmatter (markdown) or HTML meta tags (HTML input):

| Field | If Missing |
|-------|------------|
| Title | Prompt: "Enter title, or press Enter to auto-generate from content" |
| Summary | Prompt: "Enter summary, or press Enter to auto-generate (recommended for SEO)" |
| Author | Use fallback chain: CLI `--author` → frontmatter `author` → EXTEND.md `default_author` |

**Auto-Generation Logic**:
- **Title**: First H1/H2 heading, or first sentence
- **Summary**: First paragraph, truncated to 120 characters

4. **Cover Image Check** (required for API `article_type=news`):
   1. Use CLI `--cover` if provided.
   2. Else use frontmatter (`coverImage`, `featureImage`, `cover`, `image`).
   3. Else check article directory default path: `imgs/cover.png`.
   4. Else fallback to first inline content image.
   5. If still missing, stop and request a cover image before publishing.

### Step 4: Publish to WeChat

**CRITICAL**: Publishing scripts handle markdown conversion internally. Do NOT pre-convert markdown to HTML — pass the original markdown file directly. This ensures the API method renders images as `<img>` tags (for API upload) while the browser method uses placeholders (for paste-and-replace workflow).

**Markdown citation default**:
- For markdown input, ordinary external links are converted to bottom citations by default.
- Use `--no-cite` only if the user explicitly wants to keep ordinary external links inline.
- Existing HTML input is left as-is; no extra citation conversion is applied.

**API method** (accepts `.md`, `.html`, or an image directory with `--type newspic`):

```bash
${BUN_X} {baseDir}/scripts/wechat-api.ts <file> --theme <theme> [--color <color>] [--title <title>] [--summary <summary>] [--author <author>] [--cover <cover_path>] [--no-cite]
${BUN_X} {baseDir}/scripts/wechat-api.ts <images_dir> --type newspic --title <title> --content <content>
```

**CRITICAL**: Always include `--theme` parameter. Never omit it, even if using `default`. Only include `--color` if explicitly set by user or EXTEND.md.

**`draft/add` payload rules**:
- Use endpoint: `POST https://api.weixin.qq.com/cgi-bin/draft/add?access_token=ACCESS_TOKEN`
- `article_type`: `news` (default) or `newspic`
- For `news`, include `thumb_media_id` (cover is required)
- For `newspic`, include `image_info.image_list[].image_media_id`; upload local images through `material/add_material?type=image` to get permanent MediaIDs
- Always resolve and send:
  - `need_open_comment` (default `1`)
  - `only_fans_can_comment` (default `0`)
- `author` resolution: CLI `--author` → frontmatter `author` → EXTEND.md `default_author`

If script parameters do not expose the two comment fields, still ensure final API request body includes resolved values.

**Browser method** (accepts `--markdown` or `--html`):

```bash
${BUN_X} {baseDir}/scripts/wechat-article.ts --markdown <markdown_file> --theme <theme> [--color <color>] [--no-cite]
${BUN_X} {baseDir}/scripts/wechat-article.ts --html <html_file>
```

### Step 5: Completion Report

**For API method**, include draft management link:

```
WeChat Publishing Complete!

Input: [type] - [path]
Method: API
Theme: [theme name] [color if set]

Article:
• Title: [title]
• Summary: [summary]
• Images: [N] inline images
• Comments: [open/closed], [fans-only/all users]

Result:
✓ Draft saved to WeChat Official Account
• media_id: [media_id]

Next Steps:
→ Manage drafts: https://mp.weixin.qq.com (登录后进入「内容管理」→「草稿箱」)

Files created:
[• post-to-wechat/yyyy-MM-dd/slug.md (if plain text)]
[• slug.html (converted)]
```

**For Browser method**:

```
WeChat Publishing Complete!

Input: [type] - [path]
Method: Browser
Theme: [theme name] [color if set]

Article:
• Title: [title]
• Summary: [summary]
• Images: [N] inline images

Result:
✓ Draft saved to WeChat Official Account

Files created:
[• post-to-wechat/yyyy-MM-dd/slug.md (if plain text)]
[• slug.html (converted)]
```

## Detailed References

| Topic | Reference |
|-------|-----------|
| Image-text parameters, auto-compression | [references/image-text-posting.md](references/image-text-posting.md) |
| Article themes, image handling | [references/article-posting.md](references/article-posting.md) |

## Feature Comparison

| Feature | Image-Text | Article (API) | Article (Browser) |
|---------|------------|---------------|-------------------|
| Plain text input | ✗ | ✓ | ✓ |
| HTML input | ✗ | ✓ | ✓ |
| Markdown input | Title/content | ✓ | ✓ |
| Multiple images | ✓ (up to 9) | ✓ (inline) | ✓ (inline) |
| Themes | ✗ | ✓ | ✓ |
| Auto-generate metadata | ✗ | ✓ | ✓ |
| Default cover fallback (`imgs/cover.png`) | ✗ | ✓ | ✗ |
| Comment control (`need_open_comment`, `only_fans_can_comment`) | ✗ | ✓ | ✗ |
| Requires Chrome | ✓ | ✗ | ✓ |
| Requires API credentials | ✗ | ✓ | ✗ |
| Speed | Medium | Fast | Slow |

## Prerequisites

**For API method**:
- WeChat Official Account API credentials
- Guided setup in Step 2, or manually set in `.sweety-skills/.env`

**For Browser method**:
- Google Chrome
- First run: log in to WeChat Official Account (session preserved)

**Config File Locations** (priority order):
1. Environment variables
2. `<cwd>/.sweety-skills/.env`
3. `~/.sweety-skills/.env`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Missing API credentials | Follow guided setup in Step 2 |
| Access token error | Check if API credentials are valid and not expired |
| Not logged in (browser) | First run opens browser - scan QR to log in |
| Chrome not found | Set `WECHAT_BROWSER_CHROME_PATH` env var |
| Title/summary missing | Use auto-generation or provide manually |
| No cover image | Add frontmatter cover or place `imgs/cover.png` in article directory |
| Wrong comment defaults | Check `EXTEND.md` keys `need_open_comment` and `only_fans_can_comment` |
| Paste fails | Check system clipboard permissions |

## Extension Support

Custom configurations via EXTEND.md. See **Preferences** section for paths and supported options.
