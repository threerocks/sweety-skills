# 历史记录结构

本技能通过历史文件做选题去重。

## 存储位置

默认保存到：

- `.sweety-skills/tujie-wanwu-wechat/topic-history.json`

## 记录字段

每条记录至少包含：

- `core_event_key`
- `angle_key`
- `topic_slug`
- `work_type`
- `drafted_at`
- `wechat_account_alias`
- `run_kind`
- `major_new_development`

## 字段含义

### `core_event_key`

同一核心事件的稳定标识。

示例：

- 同一条新闻事件
- 同一个海鲜对象的同一判断主题
- 同一个模型发布事件

### `angle_key`

话题角度标识。

示例：

- 同样写虾，但一个角度是能吃别吃，另一个角度是结构识别
- 同样写某国漫剧情，但一个角度是人物结局，另一个角度是人物关系

## 判重规则

- 72 小时内不重复同一 `core_event_key`
- 三次每日定时运行内不重复同一 `angle_key`
- 若出现重大新进展，可通过 `major_new_development=true` 放行核心事件去重

## 建议命名

- `core_event_key`：稳定、概括、避免带时间戳
- `angle_key`：突出视角，不要只写大类
