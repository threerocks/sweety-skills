# tujie-wanwu-wechat

`tujie-wanwu-wechat` 是一个面向公众号图解万物的中文专用生产技能。

它不是单点写作提示词，而是一条可执行的内容流水线。目标是把选题发现、资料检索、核心知识补料、成稿生成、图片路由、去重记录和微信草稿发布串起来，让图解万物稳定产出偏科普、偏解释、偏可保存的公众号内容。

## 这个技能解决什么问题

图解万物的内容并不适合只追热点。它更适合做能收藏、能复看、能解释清楚的图解型科普。所以这个技能的核心不是热点捕捉，而是把热点、关键词或用户给定话题，转成真正适合账号调性的图解作品。

这个技能重点解决四类问题：

1. 选题不能只看热度，要优先偏科普。
2. 结论不能只靠新闻或社媒，要补核心知识层。
3. 图片、文章、贴图、研究资料、发布记录必须严格绑定，不能串图。
4. 自动化流程要能失败得清楚，不能黑盒。
5. 微信发布前要能根据话题、资料、正文和作品类型自动挑到合适的排版主题。

## 设计原则

本技能的设计原则固定如下：

- 全程使用中文简体。
- 热点只能作为入口，正文主体必须回到知识解释、误区澄清、结构拆解或机制说明。
- 对结构、机制、定性判断、历史解释、技术原理类内容，不能只靠热点层来源。
- 第一优先级题材优先做，低优先级热点不能插队。
- 资料、图片、草稿、历史都要落盘，可追溯、可复查、可清理。
- 发布固定走 `sweety-post-to-wechat` 的 API 路径，最多尝试 2 次。
- 未显式指定 `--theme` 时，发布前自动推断微信排版主题；显式指定时以手动值为准。

## 适用内容

默认优先级已经固化在技能中。

第一优先级：

- 生物 / 海鲜 / 食物可食部位图解
- 动物 / 植物 / 器官 / 身体结构 / 习性 / 在哪观赏
- 基础科学 / 物理小实验 / 化学与自然现象原理

第二优先级：

- 器物 / 工具 / 日用品结构拆解
- 历史事件 / 历史上的今天 / 来龙去脉

第三优先级：

- 国漫当前剧情 / 人物关系 / 最新剧情解读
- AI 技术 / 技术原理 / 新技术怎么工作
- 热点新闻延展科普

如果高优先级已经有合格候选，低优先级内容不会插队。

## 双层信源体系

这是本技能最重要的底层设计。

### 1. 热点发现层

热点发现层只负责回答两件事：

- 最近什么值得做
- 公众在关注什么角度

默认会优先使用 Agent-Reach 可连接的通道，并显式考虑：

- Google News
- 今日头条
- 财联社
- IT之家
- 36 氪
- 虎嗅
- 澎湃新闻
- Reddit
- 微信公众号搜索

热点层的作用是发现题，不是支撑结论。

### 2. 核心知识层

核心知识层负责回答：

- 它到底是什么
- 为什么会这样
- 哪些判断是可信的
- 哪些说法只能保守表达

核心知识来源优先级固定如下，不能随意改顺序：

1. 百科全书类资料
2. 论文、综述、学术期刊
3. 可追溯作者与出处的杂志科普或专业栏目
4. 教材、课程资料、教辅
5. 经过认证的培训资料、教育资料、机构公开教学材料

只要进入结构解释、机制解释、误区纠正、历史因果、技术原理，核心知识层就是必需的。

## 内容生产总流程

完整流程可以分成 8 段：

1. 输入规范化
2. 热点扫描或锚点检索
3. 候选标准化与优先级筛选
4. 核心知识层补料
5. 证据校验
6. 成稿与图片生成
7. 微信草稿发布
8. 历史写入与素材治理

简化后的主链路如下：

```text
scan-topics
-> collect-topics
-> build-candidates
-> plan-knowledge-enrichment
-> prepare-knowledge-search
-> prepare-knowledge-fetch-jobs
-> execute-knowledge-fetch-jobs
-> prepare-knowledge-evidence
-> write-knowledge-notes / ingest-knowledge-notes
-> import-knowledge-findings
-> validate-knowledge-evidence
-> topic-priority
-> publish-draft
-> topic-history
```

## 目录结构

技能目录：

```text
skills/tujie-wanwu-wechat/
├── SKILL.md
├── README.md
├── scripts/
└── references/
```

运行产物默认输出到：

```text
wechat-tujie-wanwu/YYYYMMDD/<topic-slug>/
├── research/
├── assets/
│   ├── cover/
│   ├── inline/
│   └── poster/
└── publish/
    └── manifest.json
```

去重历史默认保存到：

```text
.sweety-skills/tujie-wanwu-wechat/
```

## 配置方式

本技能支持 `EXTEND.md`，读取顺序如下：

1. 项目内 `.sweety-skills/tujie-wanwu-wechat/EXTEND.md`
2. `XDG_CONFIG_HOME` 下的配置
3. 用户目录 `~/.sweety-skills/tujie-wanwu-wechat/EXTEND.md`

关键配置包括：

- `wechat_account_alias`
- `agent_reach_skill_name`
- `default_topic_count`
- `scan_window_hours`
- `recent_hot_window_days`
- `dedupe_hours`
- `output_dir`
- `publish_mode`
- `image_pipeline`
- `google_proxy_enabled`
- `poster_publish_fallback_enabled`
- `poster_publish_fallback_mode`
- `poster_publish_fallback_image`

具体字段解释见：

- [preferences-schema.md](references/config/preferences-schema.md)
- [first-time-setup.md](references/config/first-time-setup.md)

## 脚本分组说明

### 一、输入与候选层

- `scan-topics.ts`
  用于 URL、关键词、热点扫描。
- `collect-topics.ts`
  把扫描结果转成原始候选。
- `build-candidates.ts`
  做门槛标准化，输出结构化候选。
- `topic-priority.ts`
  按科普优先级选出最终话题。

### 二、核心知识层

- `plan-knowledge-enrichment.ts`
  生成补料任务单。
- `prepare-knowledge-search.ts`
  把任务单展开为按来源层级分组的检索输入。
- `prepare-knowledge-fetch-jobs.ts`
  把检索输入转成抓取任务。
- `execute-knowledge-fetch-jobs.ts`
  执行抓取任务。
- `prepare-knowledge-url-seeds.ts`
  把未完成任务转成 URL 种子模板。
- `render-knowledge-url-seeds.ts`
  把种子模板导出为 Markdown 清单。
- `parse-knowledge-url-seeds.ts`
  从 Markdown 清单回读为 JSON。
- `write-knowledge-notes.ts`
  把结构化抓取结果写成标准研究笔记。
- `extract-knowledge-findings.ts`
  从 `research/*.md` 抽取 findings。
- `import-knowledge-findings.ts`
  把 findings 导入证据文件。
- `prepare-knowledge-evidence.ts`
  生成证据模板。
- `validate-knowledge-evidence.ts`
  校验证据是否达标。
- `append-knowledge-evidence.ts`
  手工补单条证据。
- `sync-knowledge-report.ts`
  把知识层状态回写到 manifest。
- `ingest-knowledge-notes.ts`
  把研究笔记一步抽取、导入、校验并同步。

### 三、任务与发布层

- `init-run.ts`
  初始化任务目录和 manifest，兼容 `--mode` 与 `--work-type` 两种传参写法，也兼容 `--topic` 与 `--topic-title`，并写入初始排版主题。
- `select-formatting-theme.ts`
  基于 manifest、正文和作品类型重算微信排版主题，适合在成稿前后单独调用。
- `publish-draft.ts`
  固定走微信 API 草稿发布，并在发布前结合最终正文再确认一次排版主题。
- `topic-history.ts`
  做 72 小时去重和近 3 次角度去重。
- `storage-gc.ts`
  清理历史素材和提示词，控制空间占用。

## 最常用的几条命令

### 1. 用户给关键词时

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/scan-topics.ts \
  --keyword "帝王蟹 可食部位" \
  --output /tmp/scan.json

npx -y bun skills/tujie-wanwu-wechat/scripts/collect-topics.ts \
  --input /tmp/scan.json \
  --output /tmp/raw-topics.json

npx -y bun skills/tujie-wanwu-wechat/scripts/build-candidates.ts \
  --input /tmp/raw-topics.json \
  --output /tmp/candidates.json
```

### 2. 进入核心知识层补料

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/plan-knowledge-enrichment.ts \
  --input /tmp/candidates.json \
  --output /tmp/knowledge-plan.json

npx -y bun skills/tujie-wanwu-wechat/scripts/prepare-knowledge-search.ts \
  --input /tmp/knowledge-plan.json \
  --output /tmp/knowledge-search.json

npx -y bun skills/tujie-wanwu-wechat/scripts/prepare-knowledge-fetch-jobs.ts \
  --input /tmp/knowledge-search.json \
  --output /tmp/knowledge-fetch-jobs.json
```

### 3. 自动执行核心知识抓取

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/execute-knowledge-fetch-jobs.ts \
  --input /tmp/knowledge-fetch-jobs.json \
  --output /tmp/knowledge-search-results.json
```

当前自动执行器已支持两种路径：

- URL 种子读取
- 公众号专业栏目路径的 Agent-Reach 搜索与读取

补充规则：

- 百科全书类 URL 种子如果遇到原始站点限流、匿名访问拦截或 451 类错误，执行器会自动尝试切到 Wikipedia 页面作为备用百科源
- 备用百科源会自动过滤一轮页面顶部的菜单、编辑链接、图片表格等噪音，再按题目、`knowledge_angle` 和查询词优先选择更贴题的正文段落；但百科回退结果仍建议人工快速复核一次

### 4. 若执行器返回 pending

先生成种子模板：

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/prepare-knowledge-url-seeds.ts \
  --jobs /tmp/knowledge-fetch-jobs.json \
  --execution /tmp/knowledge-search-results.json \
  --output /tmp/knowledge-url-seeds.json
```

如果想人工填写得更轻松：

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/render-knowledge-url-seeds.ts \
  --input /tmp/knowledge-url-seeds.json \
  --output /tmp/knowledge-url-seeds.md
```

填写完之后有两种方式：

方式 A，先回读：

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/parse-knowledge-url-seeds.ts \
  --input /tmp/knowledge-url-seeds.md \
  --output /tmp/knowledge-url-seeds.json
```

方式 B，直接执行，跳过回读步骤：

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/execute-knowledge-fetch-jobs.ts \
  --input /tmp/knowledge-fetch-jobs.json \
  --seed-file /tmp/knowledge-url-seeds.md \
  --output /tmp/knowledge-search-results.json
```

### 5. 证据校验

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/prepare-knowledge-evidence.ts \
  --input /tmp/knowledge-search.json \
  --output /tmp/knowledge-evidence.json

npx -y bun skills/tujie-wanwu-wechat/scripts/write-knowledge-notes.ts \
  --input /tmp/knowledge-search-results.json \
  --research-dir research/core-knowledge

npx -y bun skills/tujie-wanwu-wechat/scripts/ingest-knowledge-notes.ts \
  --title "Google Gemini Workspace 更新" \
  --evidence /tmp/knowledge-evidence.json \
  --dir research/core-knowledge \
  --report-output /tmp/knowledge-evidence-report.json
```

## Markdown 种子清单怎么填

Markdown 清单里只需要改每个条目的 `可编辑种子块`。

最关键的字段有三个：

- `source_label`
- `source_title`
- `source_url`

其中 `source_url` 是必须的。没有 URL，执行器不会拿这条种子继续抓取。

`extra_notes` 可选，适合补：

- DOI
- 教材版本
- 期刊名
- 机构名
- 你为什么认为这个链接适合当前证据目标

## 作品类型判断

### 文章

适合：

- 历史事件
- AI 原理解释
- 基础科学机制说明
- 多段论证或需要背景铺垫的内容

固定配置：

- 封面 1 张
- 插图 1 张

### 贴图

适合：

- 可食部位
- 动植物外部结构
- 快速判断型内容
- 一图看懂型内容

固定配置：

- 主图 1 张

## 图片路线

图片 skill 不是凭名字猜的，必须先读目标 skill 的 `SKILL.md`。

默认路由原则：

- 生物 / 海鲜 / 食物 / 器物拆解优先 `sweety-image-gen`
- 抽象系统 / AI / 历史流程优先 `sweety-infographic`
- 国漫剧情 / 连续叙事优先 `sweety-comic`
- 文章封面可用 `sweety-cover-image`
- 文章插图可用 `sweety-article-illustrator`

详细规则见：

- [image-routing.md](references/image-routing.md)

## 发布规则

发布固定由 `publish-draft.ts` 负责，并且只走 API 路径。

主题选择不再只发生在发布瞬间：

- `init-run.ts` 会先根据话题、类目、知识角度和作品类型写入一版初始主题
- `select-formatting-theme.ts` 可以在正文成稿前后重算主题
- `publish-draft.ts` 会在最终发布前结合正文内容再做一次精修

规则固定如下：

- 只走 `sweety-post-to-wechat` API
- 最多尝试 2 次
- 两次都失败就立即报错
- 失败时不写入历史

## 去重规则

去重由 `topic-history.ts` 维护。

固定规则：

- 72 小时内不重复相同核心事件
- 三次定时运行内不重复相同角度
- 重大新进展才允许重新进入

详细结构见：

- [history-schema.md](references/history-schema.md)

## 文本生成约束

所有正文、标题、图中文字都必须遵守这些原则：

- 保留原文核心信息与核心意图
- 不改变事实与观点
- 自然书面表达
- 减少机械化句式
- 非必要不堆列表
- 不使用破折号
- 不使用 不是……而是…… 句式
- 避免过度修饰

详细规则见：

- [writing-system.md](references/writing-system.md)

## 素材治理与空间控制

运行久了以后，研究稿、提示词、图片、测试目录会越来越大。

空间治理由 `storage-gc.ts` 负责，默认只做 dry-run。

推荐先预览：

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/storage-gc.ts \
  --root wechat-tujie-wanwu \
  --keep-days 30 \
  --prune-prompts \
  --prune-temporary
```

确认后再执行真实清理：

```bash
npx -y bun skills/tujie-wanwu-wechat/scripts/storage-gc.ts \
  --root wechat-tujie-wanwu \
  --keep-days 30 \
  --prune-prompts \
  --prune-temporary \
  --apply
```

## 常见失败场景

### 1. 扫描结果全是营销、探店、菜谱

这是正常失败形态，不要硬做。

处理方式：

- 看 `collect-topics.ts` 和 `build-candidates.ts` 的净化结果
- 继续走知识型改写词
- 若仍然无结果，转核心知识层补种子

### 2. 核心知识抓取返回 pending

这说明自动执行器暂时没覆盖该来源，不代表流程断了。

处理方式：

- 先生成 URL 种子模板
- 优先看 `recommended_domains`
- 填写 Markdown 清单
- 直接把 Markdown 清单交回执行器

### 3. 公众号读取失败

当前环境下常见原因：

- 网络问题
- Agent-Reach 微信搜索无结果
- 公众号文章读取工具依赖不可用

失败时结果会落到：

- `pending`
- `failed`

不会静默吞掉。

### 4. 证据未达标

这不是异常，是门槛机制生效。

处理方式：

- 继续补核心知识来源
- 看 `remaining_queries`
- 在不确定时降级表述，不强行精确定名

## 推荐阅读顺序

如果你是第一次接手这个技能，建议按这个顺序读：

1. [SKILL.md](SKILL.md)
2. [workflow.md](references/workflow.md)
3. [source-policy.md](references/source-policy.md)
4. [knowledge-base-policy.md](references/knowledge-base-policy.md)
5. [knowledge-enrichment-pipeline.md](references/knowledge-enrichment-pipeline.md)
6. [knowledge-evidence-schema.md](references/knowledge-evidence-schema.md)
7. [image-routing.md](references/image-routing.md)

## 当前自动化边界

到目前为止，技能已经完成了大部分链路自动化，但不是所有来源都已经全自动搜索。

已经稳定接入的能力：

- 热点扫描
- 候选标准化
- 核心知识任务拆解
- URL 种子驱动的知识抓取
- 公众号专业栏目自动搜索与读取
- 研究笔记标准化
- 证据抽取与校验
- 微信 API 草稿发布

仍需要更多外部搜索源支持的部分：

- 百科全书类资料的自动定向搜索
- 论文 / 综述 / 学术期刊的自动定向搜索
- 教材 / 课程资料 / 教辅的自动定向搜索
- 认证教育资料的自动定向搜索

所以当前最稳的工作方式是：

- 先自动发现和拆任务
- 自动跑能跑的部分
- 对 `pending` 任务用 Markdown 清单补种子
- 再回到自动执行链

这也是当前这个技能最实用、最稳的一种工作模式。
