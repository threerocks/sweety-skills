---
name: sweety-video-gen
description: 通用 AI 视频生成。对接实现 /v1/media 开放协议的视频生成服务（如 seedance 2.0 中转源），用户只需配置服务地址和 API Key。支持文生视频、参考图生视频（图生视频）、时长与宽高比设置、任务查询、失败重试、自动轮询和结果下载。当用户要求生成视频、图生视频、文生视频、AI 视频时使用。
version: 0.1.0
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-video-gen
    requires:
      anyBins:
        - bun
        - npx
---

# 通用视频生成（/v1/media 协议）

对接任意实现 `/v1/media` 开放协议的视频生成服务（当前源为 seedance 2.0 中转）。不绑定具体厂商：换源只需改 `base_url`，无需改代码。

## 脚本目录

**Agent 执行流程**：
1. `{baseDir}` = 本 SKILL.md 文件所在目录
2. 脚本路径 = `{baseDir}/scripts/main.ts`
3. 确定 `${BUN_X}` 运行时：若已安装 `bun` → `bun`；若有 `npx` → `npx -y bun`；否则建议安装 bun

| 脚本 | 用途 |
|------|------|
| `scripts/main.ts` | 创建任务、查询状态、重试、下载结果的统一入口 |

## 步骤 0：加载配置 ⛔ 阻塞步骤

生成前必须确认两项配置存在（缺一不可）：

| 配置 | 来源（优先级从高到低） |
|------|------------------------|
| 服务地址 | `--base-url` > EXTEND.md `base_url` > 环境变量 `VIDEO_GEN_BASE_URL` |
| API Key | `--api-key` > 环境变量 `VIDEO_GEN_API_KEY` |

环境变量加载顺序：`process.env` > `<cwd>/.sweety-skills/.env` > `~/.sweety-skills/.env`。

**首次使用**：若缺配置，脚本会报错并给出提示。引导用户把以下两行写入 `~/.sweety-skills/.env`（不要让用户在对话中粘贴 key，让用户自己编辑文件）：

```bash
VIDEO_GEN_BASE_URL=https://your-host/
VIDEO_GEN_API_KEY=your-api-key
```

EXTEND.md 为可选偏好配置，检查路径（优先级：项目 → XDG → 用户）：

```bash
test -f .sweety-skills/sweety-video-gen/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-video-gen/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-video-gen/EXTEND.md" && echo "user"
```

**EXTEND.md 支持字段**（YAML frontmatter）：`base_url` | `default_model` | `default_duration` | `default_aspect_ratio` | `poll_interval_seconds` | `timeout_minutes` | `price_per_point`（积分单价，元，用于成本估算）

## 使用方法

```bash
# 文生视频（默认 video-v1，10 秒，16:9，完成后自动下载）
${BUN_X} {baseDir}/scripts/main.ts --prompt "海边日落，慢镜头" --output out.mp4

# 图生视频（本地参考图自动上传，最多按服务端支持数量传入）
${BUN_X} {baseDir}/scripts/main.ts --prompt "让画面动起来" --ref 1.jpg 2.png --output out.mp4

# 指定时长和竖屏比例
${BUN_X} {baseDir}/scripts/main.ts --prompt "城市夜景延时" --duration 15 --ar 9:16 --output out.mp4

# 只创建任务不等待（拿到 task_id 后续再取）
${BUN_X} {baseDir}/scripts/main.ts --prompt "..." --no-wait

# 查询任务状态 / 继续等待并下载 / 重试失败任务
${BUN_X} {baseDir}/scripts/main.ts --status 123
${BUN_X} {baseDir}/scripts/main.ts --wait 123 --output out.mp4
${BUN_X} {baseDir}/scripts/main.ts --retry 123 --output out.mp4

# 查询可用模型
${BUN_X} {baseDir}/scripts/main.ts --models
```

**执行建议**：视频生成通常需要几分钟，默认会轮询到完成（超时 30 分钟）。在 agent 环境中建议用后台方式运行生成命令，或用 `--no-wait` 拿到 task_id 后再 `--wait` 取结果。

## 选项

| 选项 | 说明 |
|------|------|
| `--prompt <text>`, `-p` | 生成提示词（创建任务时必填） |
| `--ref <files...>` | 参考图，本地文件自动上传；也接受 `http(s)://` 或 `/uploads/` 开头的已上传地址 |
| `--model <id>`, `-m` | 模型 ID（默认 `video-v1`，可用 `--models` 查询） |
| `--duration <sec>`, `-d` | 视频时长秒数，仅 5/10/15 有对应价目（默认 10），其它时长可能按兜底价计费 |
| `--ar <ratio>` | 宽高比，如 `16:9`、`9:16`（默认 `16:9`） |
| `--output <path>`, `-o` | 输出文件路径（默认 `video-<task_id>.mp4`） |
| `--no-wait` | 创建后立即返回 task_id，不轮询 |
| `--no-download` | 完成后只打印结果 URL，不下载 |
| `--status <task_id>` | 查询一次任务状态 |
| `--wait <task_id>` | 轮询已有任务直到完成并下载 |
| `--retry <task_id>` | 重试失败任务（仅限本 key 创建的 failed 任务） |
| `--poll-interval <sec>` | 轮询间隔（默认 15） |
| `--timeout-minutes <min>` | 等待超时（默认 30） |
| `--usage` | 查看历史任务成本统计 |
| `--base-url <url>` / `--api-key <key>` | 覆盖服务地址 / API Key |
| `--json` | JSON 输出（含 `download_url`、`output`） |

## 任务流程与状态

1. 有本地参考图 → 先 `POST /v1/media/upload` 逐张上传
2. `POST /v1/media/generate` 创建任务，返回 `task_id`
3. 轮询 `GET /v1/media/status?task_id=`，以 `state` + `is_final` 判断：`pending`/`running` 继续等，`success` 下载，`failed` 报错并提示 `--retry`
4. 下载地址优先取 `video_url`（去水印），否则 `result_url`；相对路径自动拼接 `base_url`

## 成本统计

- 每个任务到达终态后自动追加一条记录到 `~/.sweety-skills/sweety-video-gen/usage.jsonl`（task_id、时长、积分、估算金额、prompt、输出路径）
- `--usage` 汇总历史成本；EXTEND.md 配置 `price_per_point`（积分单价，元）后会折算金额
- 计费参考（`GET /task/cost-rules` 公开可查）：视频 5s=5 积分、10s=10、15s=15，即 1 积分/秒；未匹配时长按兜底 15 积分

## 错误处理

- 缺服务地址或 API Key → 报错并提示写入 `~/.sweety-skills/.env`
- 任务失败 → 打印失败原因，提示 `--retry <task_id>`
- 等待超时 → 任务仍在服务端运行，用 `--status` / `--wait` 继续跟进
- `API Key无效或已禁用` → 让用户检查 key 配置与后台状态

## 与其他 skill 的分工

- 生成图片默认用 `sweety-image-gen`；本协议的 `image-v1` 系列模型可通过 `--model` 直接使用，但仅作为备用通道
- 生成的视频封面图可配合 `sweety-cover-image`

## 扩展支持

通过 EXTEND.md 自定义默认模型、时长、比例和轮询参数。路径和字段见**步骤 0**。
