---
name: sweety-broad-hotspot-fetch
description: Use when the user asks to get today's broad hotspots, 泛热点, 热榜, 借势热点, 今日热点, or to judge whether current general trends can be naturally used by Sweety content projects. Do not use as a vertical search or Xiaohongshu/Douyin topic-research substitute.
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-broad-hotspot-fetch
---

# 泛热点获取

这个 skill 用于调用本机 NewsNow、DailyHotApi 和 Trend Gateway 获取“泛热点”，再判断这些热点是否值得各内容项目借势。它不是垂类趋势搜索，不负责小红书/抖音定向检索。

## 边界

使用本 skill：

- 用户说“今日热点”“泛热点”“热榜”“借势热点”“看看今天能蹭什么”。
- 用户要给多个内容项目找可借势的大盘热点。
- 用户要 Codex 调用已部署的 `NewsNow + DailyHotApi + Trend Gateway`。

不要把本 skill 当成：

- 穿搭、小红书、抖音、商品、AI 论文等垂类搜索系统。
- 最终选题决策器。
- 事实核验器。
- 发布建议器。

核心原则：热点只提供机会，不决定选题。不自然就不蹭。

## 服务入口

优先使用 MCP 工具；没有 MCP 时用本地 HTTP。

| 层 | 用途 | 入口 |
|---|---|---|
| Trend Gateway | 统一缓存、健康状态、跨源聚合 | `http://127.0.0.1:7777` |
| NewsNow | 按 source id 取热点 | `http://127.0.0.1:4444` |
| DailyHotApi | 按路由取平台热榜 | `http://127.0.0.1:6688` |

常用 HTTP：

```bash
curl "http://127.0.0.1:7777/api/trends?limit=50&refresh=1"
curl "http://127.0.0.1:7777/api/sources"
curl "http://127.0.0.1:4444/api/s?id=zhihu"
curl "http://127.0.0.1:6688/all"
```

如果服务未启动，先提示用户启动：

```bash
/Users/liulei/Documents/Codex/2026-06-19/yi-x/outputs/start-trend-services.command
```

## 获取流程

1. 先读健康状态。
   - `Trend Gateway` 可用时，以它为主。
   - 记录哪些源可用，哪些源失败。
   - 不因单源失败停止；失败源只降权或标注。

2. 拉泛热点。
   - 默认从 `trend_gateway` 取 30-80 条。
   - 如果需要更完整，再补 NewsNow 的 `zhihu`、`weibo`、`douyin`、`toutiao`、`baidu`、`bilibili-hot-search`、`bilibili-hot-video` 等 source。
   - 如果只需要快速建议，不要扩展太多源。

3. 去重与粗分组。
   - 合并相同事件的不同标题。
   - 粗分为：社会事件、娱乐影视、科技商业、生活消费、体育游戏、平台热梗、节日天气。

4. 借势判断。
   - 只判断“是否有自然连接”，不要硬凑。
   - 每个候选说明适合哪些项目、不适合哪些项目、为什么。
   - 优先给 1 个可执行推荐；用户要求多方案时再给候选池。

## 借势评分

对每个热点给 0-5 分，不需要复杂计算：

| 维度 | 问题 |
|---|---|
| 自然相关性 | 和账号主题、人设、内容线是否自然相连？ |
| 可生产性 | 能否当天转成具体标题、开头、素材或观点？ |
| 风险 | 是否涉及灾难、隐私、政治、未证实指控、医疗金融承诺？ |
| 受众价值 | 读者是否能得到信息、情绪、判断或行动建议？ |
| 新鲜度 | 是今天仍在热，还是已经过时？ |

默认输出：

```markdown
## 今日泛热点概览
- 可用来源：...
- 失败来源：...

## 值得考虑
1. 热点：...
   适合项目：...
   借势方式：...
   风险：...
   结论：建议/谨慎/跳过

## 不建议硬蹭
- ...

## 今日建议
...
```

## 风险规则

- 不把热度当作发布理由。
- 不蹭灾难、伤亡、公共危机、未成年人伤害和私人悲剧。
- 不把未核实传闻写成事实。
- 不为了贴热点扭曲项目人设。
- 不替任何项目做最终外部发布决定。
- 遇到事实性主张时，转交搜索/来源核验流程；泛热榜本身只是发现入口。

## 和其他 skill 的关系

- 需要深度证据包、平台搜索、X/网页抓取时，改用 `sweety-trend-source-intake` 或联网检索流程。
- 需要标题时，用 `sweety-trustworthy-title`。
- 需要开头时，用 `sweety-viral-opening`。
- 需要写具体文章时，遵守目标项目自己的 AGENTS、门禁和发布边界。
