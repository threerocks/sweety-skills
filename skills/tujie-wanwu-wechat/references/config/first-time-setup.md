---
name: first-time-setup
description: First-time setup flow for tujie-wanwu-wechat preferences
---

# First-Time Setup

当未找到本技能的 EXTEND.md 时，必须先完成此设置，再进入内容流程。

## 阻塞规则

未完成设置前，不要：

- 直接进入选题
- 直接进入图片路线判断
- 直接进入微信草稿发布

## 推荐提问内容

使用一次 AskUserQuestion 收集这些默认值：

1. 微信账号别名
2. 默认选题数量
3. 默认去重窗口
4. 输出目录
5. 图片路线
6. Google 代理是否默认开启
7. poster 失败时是否自动启用兜底图
8. poster 是否使用固定兜底图
9. 配置保存位置

## 保存位置

| 选择 | 路径 |
|------|------|
| Project | `.sweety-skills/tujie-wanwu-wechat/EXTEND.md` |
| User | `~/.sweety-skills/tujie-wanwu-wechat/EXTEND.md` |

## EXTEND.md 模板

```yaml
---
version: 1
wechat_account_alias: ""
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
