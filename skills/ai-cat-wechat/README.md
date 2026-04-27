# ai-cat-wechat

`ai-cat-wechat` 是一个面向微信公众号的课程目录驱动型自动化技能。

它解决的不是一次性写稿，而是连续栏目生产：

- 儿童线按课程目录连载
- 成人线按课程目录连载
- 晚间档优先拆解 AI 实战热点，没有合格案例就回退到作品集课
- 晚上 9 点固定补 AI 新闻

## 设计重点

- 先锁课程目录，再连续推进
- 优先使用稳定课程源和预置 evergreen 课程池
- 默认贴图优先
- 贴图发布失败自动转文章
- 多公众号发布复用 `sweety-post-to-wechat`

## 默认数据目录

项目内默认使用：

```text
.sweety-skills/ai-cat-wechat/
├── EXTEND.md
├── course-watchlists.json
├── course-catalogs.json
├── track-state.json
├── run-history.json
└── hot-case-history.json
```

## 默认运行入口

```bash
npx -y bun skills/ai-cat-wechat/scripts/catalog-sync.ts --track kids
npx -y bun skills/ai-cat-wechat/scripts/run.ts --slot kids --account 你的账号别名 --publish
npx -y bun skills/ai-cat-wechat/scripts/status.ts
```

## 当前实现边界

- 课程目录同步已经支持“种子目录 + 抓公开页面 + source pack”的三路径
- `kids` 首发课《AI 来了》已切到 source-backed catalog，运行时会把章节研究材料写入 `research/brief.json`
- 课程推进、章节状态、失败回滚、贴图转文章都已落到脚本
- 热点案例和新闻输入可以接本地 JSON，也可以接自动抓取结果 URL
- `adult` / `evening` / `news` 的高质量知识补料仍建议由上游自动抓取结果喂入，`kids` 当前先走本地课程包闭环
- 图片资产会优先尝试 `sweety-image-gen`，未配置或失败时自动回退到本地结构化贴图
