# Preferences Schema

本技能的 EXTEND.md 使用 YAML frontmatter。

## 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `version` | number | `1` | 配置版本 |
| `wechat_account_alias` | string | `""` | 发布草稿时使用的公众号账号别名 |
| `agent_reach_skill_name` | string | `agent-reach` | 资料检索主 skill 名称 |
| `agent_reach_bin` | string | `""` | Agent Reach 可执行文件路径，留空则走默认路径 |
| `agent_reach_python` | string | `""` | Agent Reach Python 解释器路径，用于公众号搜索 |
| `default_topic_count` | number | `2` | 未指定数量时默认输出的话题数 |
| `scan_window_hours` | number | `6` | 热点扫描窗口 |
| `recent_hot_window_days` | number | `7` | 近几天热点补充窗口 |
| `dedupe_hours` | number | `72` | 核心事件去重窗口 |
| `output_dir` | string | `wechat-tujie-wanwu` | 单次任务输出根目录 |
| `publish_mode` | string | `draft` | 只支持草稿模式 |
| `image_pipeline` | string | `hybrid-real-first` | 图片路线策略 |
| `google_proxy_enabled` | boolean | `true` | Google 图像路线是否默认启用代理 |
| `poster_publish_fallback_enabled` | boolean | `true` | `poster` 首次因微信图片相关拦截失败时，是否允许第 2 次自动切到兜底图 |
| `poster_publish_fallback_mode` | string | `safe-preview` | 兜底图策略。当前支持 `safe-preview`，会从原图生成低 OCR 风险的安全预览图 |
| `poster_publish_fallback_image` | string | `""` | 可选。显式指定兜底图文件路径；设置后优先使用该图片 |
| `storage_keep_days` | number | `30` | 临时任务目录的默认保留天数 |
| `storage_prune_prompts` | boolean | `true` | 是否允许清理已完成任务的 prompts 目录 |
| `storage_prune_temporary` | boolean | `true` | 是否允许清理测试或未完成任务目录 |

## 示例

```yaml
---
version: 1
wechat_account_alias: 万物小导游
agent_reach_skill_name: agent-reach
agent_reach_bin: /Users/liulei/micromamba-agent-reach/bin/agent-reach
agent_reach_python: /Users/liulei/micromamba-agent-reach/bin/python
default_topic_count: 2
scan_window_hours: 6
recent_hot_window_days: 7
dedupe_hours: 72
output_dir: wechat-tujie-wanwu
publish_mode: draft
image_pipeline: hybrid-real-first
google_proxy_enabled: true
poster_publish_fallback_enabled: true
poster_publish_fallback_mode: safe-preview
poster_publish_fallback_image: ""
storage_keep_days: 30
storage_prune_prompts: true
storage_prune_temporary: true
---
```

## 说明

- `publish_mode` 当前固定走草稿流程，不建议改为正式发布。
- `image_pipeline` 推荐保持 `hybrid-real-first`。
- `poster_publish_fallback_enabled` 建议保持开启，这样 `poster` 在微信 API 因主图失败时，仍能保住草稿。
- `poster_publish_fallback_image` 适合后续接 OpenClaw 或飞书机器人时指定统一占位图；不设置时默认自动生成安全预览图。
- 若微信账号通过 `sweety-post-to-wechat` 的多账号机制管理，则 `wechat_account_alias` 应与那边的账号别名一致。
- `storage_keep_days` 只建议用于临时任务和测试任务，不建议自动删除已发布成品。
