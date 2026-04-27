---
name: ai-cat-wechat
description: 全自动课程驱动的微信公众号生产技能。按固定栏目时间自动推进儿童线、成人线、晚间实战案例/作品集课和新闻补充，默认贴图优先，贴图发布失败自动降级为文章。
version: 0.1.0
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#ai-cat-wechat
    requires:
      anyBins:
        - bun
        - npx
---

# ai-cat-wechat

## 语言

- 全程使用中文简体。

## 目标

- 按课程目录连续产出，不临时拼选题。
- 默认无人值守，只有发布失败、全部生图链路失败、课程源池耗尽这类硬失败才停止。
- 公众号默认贴图优先，复杂内容或贴图发布失败时自动转文章。

## 固定栏目

- `08:00 kids`：儿童线，首发锁定《科普周报 AI 来了》。
- `12:00 adult`：成人线，首发锁定 Agent / Codex 工程化。
- `18:00 evening`：优先 AI 热点实战案例，无合格案例则补位到 `portfolio` 课程目录。
- `21:00 news`：AI 新闻简报，固定 3 到 5 条。

## 硬规则

- 课程线必须按目录顺序连续推进。
- 当前课程讲完后，自动切到下一门已验证课程。
- 主源池没有新课时，自动切备用 evergreen 课程。
- 贴图发布失败时，自动改发文章：
  - 保留原贴图
  - 自动重做文章封面
  - 将原贴图插进正文
  - 再调用文章发布链

## 默认文风

- 保留原文核心信息与核心意图
- 自然书面表达
- 句式多样
- 非必要不使用列表
- 不用句首表情符号
- 不用不是……而是……句式
- 不用破折号
- 非引用语境不加双引号
- 避免空泛夸张

## 可执行入口

以本文件所在目录为 `{baseDir}`：

```bash
${BUN_X:-npx -y bun} {baseDir}/scripts/catalog-sync.ts --track <kids|adult|portfolio>
${BUN_X:-npx -y bun} {baseDir}/scripts/run.ts --slot <kids|adult|evening|news> --account <alias> --publish
${BUN_X:-npx -y bun} {baseDir}/scripts/status.ts [--track <kids|adult|portfolio|news>]
${BUN_X:-npx -y bun} {baseDir}/scripts/retry.ts --run-id <id>
```

## 配置与状态

默认读取项目内：

- `.sweety-skills/ai-cat-wechat/EXTEND.md`
- `.sweety-skills/ai-cat-wechat/course-watchlists.json`
- `.sweety-skills/ai-cat-wechat/course-catalogs.json`
- `.sweety-skills/ai-cat-wechat/track-state.json`
- `.sweety-skills/ai-cat-wechat/run-history.json`
- `.sweety-skills/ai-cat-wechat/hot-case-history.json`

## 自动化工作流

### 1. 同步课程目录

- 读取 `course-watchlists.json`
- 优先使用 source pack，其次内置种子目录
- 若未提供结构化 source pack，再抓 `catalog_source_url`
- 目录项少于 3 条直接判定为失败
- 同步成功后写入 `course-catalogs.json`

### 2. 选择当天栏目内容

- `kids` / `adult`：
  - 取当前课程当前章节
  - 课程讲完则自动切下一门
- `evening`：
  - 先查 AI 实战热点案例
  - 没有合格案例，再推进 `portfolio`
- `news`：
  - 从新闻输入中取最近 24 小时高分条目，输出 3 到 5 条

### 3. 生成运行产物

每次运行都落盘到：

```text
ai-cat-wechat-runs/YYYYMMDD-slot-topic/
├── article.md / poster.md
├── assets/
│   ├── cover/
│   ├── inline/
│   └── poster/
├── publish/manifest.json
└── research/brief.json
```

- 若课程源包含 lesson pack，会把场景、核心观点、章节展开和证据源一并写入 `research/brief.json`
- 图片会优先尝试 `sweety-image-gen`，失败时自动回退到本地结构化贴图，避免因生图链路失效而阻塞整条栏目

### 4. 发布

- 默认调用 [tujie-wanwu-wechat](../tujie-wanwu-wechat/SKILL.md) 的发布脚本链
- 多账号配置继续复用 [sweety-post-to-wechat](../sweety-post-to-wechat/SKILL.md)
- 必须显式传 `--account`
- 发布失败时保留明确错误到 `run-history.json`

## 执行要求

- 在执行 `run.ts` 前，不需要人工挑课程、挑章节或挑账号之外的任何内容。
- 如果 `news` 或 `evening` 需要外部输入源，优先通过 `--news-file` / `--hot-case-file` 或外部自动抓取结果喂给脚本。
- 若发布返回失败，必须立即结束当前 run，不允许偷偷推进章节号。
