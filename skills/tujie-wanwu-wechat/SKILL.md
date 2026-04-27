---
name: tujie-wanwu-wechat
description: 为公众号图解万物生成并发布微信草稿的中文专用技能。根据用户提供的话题、URL、关键词或自动发现的热点，完成资料检索、价值筛选、成稿生成、图片路由、去重记录与公众号草稿发布。适用于图解科普、结构拆解、历史事件、国漫剧情、AI 与技术解释类内容。
version: 1.86.0
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#tujie-wanwu-wechat
    requires:
      anyBins:
        - bun
        - npx
---

# 图解万物微信技能

面向公众号图解万物的中文专用生产技能。目标不是给出草稿建议，而是把选题、资料、配图、成稿、草稿发布串成一条能跑通的流程。

## 基本原则

- 全程使用中文简体输出。
- 每完成一步都要及时通知当前进度和结果。
- 用户给 URL 或关键词时，跳过热点扫描，直接把该输入作为主锚点。
- 用户未给话题时，默认扫描最近 6 小时热点，并补充最近 7 天热点与历史上的今天。
- 资料检索默认依赖已安装的 `Agent-Reach`。若未安装或不可用，停止并明确提示缺少该前置能力。
- 不得仅凭热点就输出知识性结论。凡涉及结构、机制、定性判断、历史解释、技术原理，必须叠加核心知识库来源。
- 账号整体调性优先偏科普、偏解释、偏可保存，不优先做单纯追新闻。
- 热点只能作为切入口，正文主体必须回到知识解释、误区澄清、结构拆解或机制说明。

## 外部依赖

### Agent-Reach

本技能默认把 `Agent-Reach` 视为资料检索主通道。

使用规则：

1. 先确认 `Agent-Reach` 已安装且可调用。
2. 有 URL 或关键词时，直接围绕该锚点检索。
3. 无话题时，优先用 Agent-Reach 连接的通道进行热点发现。
4. 无论热点从哪里来，最终都要补足可信支撑来源。

## 脚本目录

**重要**：本技能的脚本位于 `scripts/` 子目录。

**Agent 执行方式**：
1. 将本 `SKILL.md` 所在目录记为 `{baseDir}`
2. 脚本路径 = `{baseDir}/scripts/<script-name>.ts`
3. 解析 `${BUN_X}` 运行时：若已安装 `bun` 则用 `bun`；若有 `npx` 则用 `npx -y bun`；否则提示安装 bun
4. 将文档中的 `{baseDir}` 和 `${BUN_X}` 替换为实际值

**脚本列表**：
| 脚本 | 用途 |
|------|------|
| `scripts/init-run.ts` | 初始化单次任务目录、素材清单和发布清单 |
| `scripts/select-formatting-theme.ts` | 基于 manifest、正文和作品类型推断或重算微信排版主题 |
| `scripts/topic-history.ts` | 选题去重检查与历史写入 |
| `scripts/scan-topics.ts` | 直接调用 Agent Reach 相关通道做 URL、关键词或热点扫描 |
| `scripts/collect-topics.ts` | 将检索扫描结果转成原始候选 JSON |
| `scripts/build-candidates.ts` | 将原始候选标准化为可筛选的结构化 JSON |
| `scripts/plan-knowledge-enrichment.ts` | 为需要补核心知识层的候选生成补资料任务单 |
| `scripts/prepare-knowledge-search.ts` | 将补资料任务单展开为按来源层级分组的检索输入 |
| `scripts/prepare-knowledge-fetch-jobs.ts` | 将检索输入展开为可执行的核心知识抓取任务清单 |
| `scripts/execute-knowledge-fetch-jobs.ts` | 执行核心知识抓取任务，当前支持 URL 种子读取和公众号专业栏目自动搜索 |
| `scripts/prepare-knowledge-url-seeds.ts` | 将 pending 抓取任务转成可填写的 URL 种子模板 |
| `scripts/render-knowledge-url-seeds.ts` | 将 URL 种子模板渲染成人工可编辑的 Markdown 清单 |
| `scripts/parse-knowledge-url-seeds.ts` | 从 Markdown 清单回读已填写的 URL 种子 JSON |
| `scripts/prepare-knowledge-evidence.ts` | 生成统一的核心知识证据模板 |
| `scripts/write-knowledge-notes.ts` | 将外部搜索结果写成标准 `research/*.md` 知识笔记 |
| `scripts/extract-knowledge-findings.ts` | 将 `research/*.md` 原始资料笔记抽取为 `knowledge-findings.json` |
| `scripts/import-knowledge-findings.ts` | 将一批核心知识检索结果自动导入证据文件 |
| `scripts/ingest-knowledge-notes.ts` | 将原始资料笔记直接抽取、导入证据、校验，并按需同步回 manifest |
| `scripts/validate-knowledge-evidence.ts` | 校验核心知识证据是否达到可成稿门槛 |
| `scripts/topic-priority.ts` | 按固定优先级和科普门槛筛选候选话题 |
| `scripts/publish-draft.ts` | 固定走 API 发布微信草稿，最多尝试 2 次 |
| `scripts/storage-gc.ts` | 统计和清理旧素材，控制空间占用 |

## 偏好设置 (EXTEND.md)

开始任何生成前，先检查 EXTEND.md 是否存在：

```bash
test -f .sweety-skills/tujie-wanwu-wechat/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/tujie-wanwu-wechat/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/tujie-wanwu-wechat/EXTEND.md" && echo "user"
```

```powershell
if (Test-Path .sweety-skills/tujie-wanwu-wechat/EXTEND.md) { "project" }
$xdg = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { "$HOME/.config" }
if (Test-Path "$xdg/sweety-skills/tujie-wanwu-wechat/EXTEND.md") { "xdg" }
if (Test-Path "$HOME/.sweety-skills/tujie-wanwu-wechat/EXTEND.md") { "user" }
```

| 结果 | 操作 |
|------|------|
| 找到 | 读取、解析、显示摘要后继续 |
| 未找到 | 执行 [references/config/first-time-setup.md](references/config/first-time-setup.md) |

支持的关键配置见 [references/config/preferences-schema.md](references/config/preferences-schema.md)。

## 进度清单

复制并跟踪以下进度：

```text
图解万物进度：
- [ ] 步骤 0：加载偏好设置与依赖检查
- [ ] 步骤 1：规范化输入
- [ ] 步骤 2：资料检索
- [ ] 步骤 3：价值筛选与事实门槛检查
- [ ] 步骤 4：初始化任务目录与去重检查
- [ ] 步骤 5：确定作品类型与图片路线
- [ ] 步骤 6：生成标题、正文与图中文字
- [ ] 步骤 7：生成图片素材
- [ ] 步骤 8：发布微信草稿
- [ ] 步骤 9：写入历史并完成报告
```

## 工作流程

### 步骤 0：加载偏好设置与依赖检查

1. 读取本技能的 EXTEND.md。
2. 检查 `Agent-Reach` 是否可用。
3. 检查本次可能调用的外部技能是否已安装：
   - `sweety-image-gen`
   - `sweety-infographic`
   - `sweety-cover-image`
   - `sweety-comic`
   - `sweety-article-illustrator`
   - `sweety-post-to-wechat`
   - `sweety-xhs-images`
4. 汇报已加载的默认值：
   - 微信账号别名
   - 默认选题数量
   - 去重窗口
   - 输出目录
   - 图片路线

### 步骤 1：规范化输入

先判断输入属于哪一类：

| 输入类型 | 动作 |
|---------|------|
| URL | 跳过热点扫描，以 URL 为主锚点，默认补 1 个独立支持信源 |
| 关键词 | 跳过热点扫描，以关键词为主锚点，默认补 1 个独立支持信源 |
| 明确话题描述 | 跳过热点扫描，以该话题为主锚点 |
| 无明确话题 | 执行热点发现 |

热点发现规则：

- 默认扫描最近 6 小时热点
- 额外补最近 7 天热点和历史上的今天
- 扫描组合显式包含 Google News、今日头条、财联社、IT之家、36 氪、虎嗅、澎湃新闻、Reddit
- 扫到热点后，不直接按热度排序，而是先按本科普优先级归类，再决定是否进入候选池

无明确话题时，按以下优先级选题：

- 第一优先级：生物 / 海鲜 / 食物可食部位图解；动物 / 植物 / 器官 / 身体结构 / 习性 / 在哪观赏科普；基础科学 / 物理小实验 / 化学与自然现象原理
- 第二优先级：器物 / 工具 / 日用品结构拆解；历史事件 / 历史上的今天 / 来龙去脉
- 第三优先级：国漫当前剧情 / 人物关系 / 结局走向 / 最新剧情解读 / 最新剧情下一集；AI 技术 / 技术原理 / 新技术是怎么工作的；热点新闻延展科普

如果高优先级类目已经有可做题材，不要让低优先级热点插队。

### 步骤 2：资料检索

检索分两层进行：

1. 热点发现层：找出值得做的候选题
2. 核心知识层：补足解释所需的可信支撑

检索规则：

- 优先用 Agent-Reach 的连接通道
- 需要更强验证时，同时查公众号讨论和官方发布页
- 军事、名人、健康、社会冲突等话题执行更高门槛
- 所有检索材料统一整理到 `research/`

推荐先运行统一扫描入口：

```bash
${BUN_X} {baseDir}/scripts/scan-topics.ts --keyword <keyword> --output <scan-results.json>
${BUN_X} {baseDir}/scripts/scan-topics.ts --url <url> --output <scan-results.json>
${BUN_X} {baseDir}/scripts/scan-topics.ts --hot --output <scan-results.json>
```

关键词扫描时，脚本会自动判断题材并在必要时补跑知识型改写词。若首轮结果大多是营销、探店、菜谱或促销内容，不要直接进入后续成稿，先使用补跑后的扫描结果。

当检索得到一批扫描结果后，先转换为原始候选：

```bash
${BUN_X} {baseDir}/scripts/collect-topics.ts --input <scan-results.json> --output <raw-topics.json>
```

转换时要先做一轮内容净化，过滤明显偏营销、探店、菜谱、促销的结果，尤其是海鲜和食物类关键词下混进来的餐饮标题。

来源使用规则见：

- [references/source-policy.md](references/source-policy.md)
- [references/knowledge-base-policy.md](references/knowledge-base-policy.md)

### 步骤 3：价值筛选与事实门槛检查

对每个候选话题，先做价值提炼，再做打分与否决。

价值筛选只保留同时满足以下方向的话题：

- 实用性强：读者能直接用得上
- 稀缺性高：不是烂大街内容
- 引发共鸣：能戳中真实痛点或兴趣点

额外判断：

- 若话题只是热点本身，没有足够的知识延展空间，直接淘汰
- 若话题可以通过结构图、机制图、时间线或误区澄清做出明确科普收益，优先保留
- AI 与国漫类内容默认降一档处理，除非它们本身具备很强的原理解释价值或明确的剧情关系解读价值

然后按以下权重打分：

- 新鲜度 30
- 传播力 30
- 深度潜力 20
- 人文关联 20

否决门槛：

- 事实可证性
- 可解释性
- 平台安全性

默认输出 2 个话题，用户明确指定数量时按用户要求执行。

当原始候选来自热点扫描、人工整理或外部检索时，先做标准化：

```bash
${BUN_X} {baseDir}/scripts/build-candidates.ts --input <raw-topics.json> --output <candidates.json>
```

标准化结果里必须保留双层信源字段，包括：

- 是否必须补核心知识层
- 最少需要的核心知识来源数量
- 优先补哪些核心知识来源类型
- 下一步可直接用于补知识层的查询词

若候选仍需补核心知识层，继续生成补资料任务单：

```bash
${BUN_X} {baseDir}/scripts/plan-knowledge-enrichment.ts --input <candidates.json> --output <knowledge-plan.json>
```

再将任务单展开成可直接执行的检索输入：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-search.ts --input <knowledge-plan.json> --output <knowledge-search.json>
${BUN_X} {baseDir}/scripts/prepare-knowledge-fetch-jobs.ts --input <knowledge-search.json> --research-dir <research/core-knowledge> --output <knowledge-fetch-jobs.json>
${BUN_X} {baseDir}/scripts/execute-knowledge-fetch-jobs.ts --input <knowledge-fetch-jobs.json> --output <knowledge-search-results.json>
```

若执行后仍有 `pending`，立刻生成 URL 种子模板，而不是手工整理：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-url-seeds.ts --jobs <knowledge-fetch-jobs.json> --execution <knowledge-search-results.json> --output <knowledge-url-seeds.json>
${BUN_X} {baseDir}/scripts/execute-knowledge-fetch-jobs.ts --input <knowledge-fetch-jobs.json> --seed-file <knowledge-url-seeds.json> --output <knowledge-search-results.json>
```

`knowledge-url-seeds.json` 至少会给出：

- `recommended_domains`
- `recommended_search_queries`
- `fill_rules`
- `goal`
- `evidence_targets`

如果不想直接编辑 JSON，优先转成 Markdown 清单：

```bash
${BUN_X} {baseDir}/scripts/render-knowledge-url-seeds.ts --input <knowledge-url-seeds.json> --output <knowledge-url-seeds.md>
${BUN_X} {baseDir}/scripts/parse-knowledge-url-seeds.ts --input <knowledge-url-seeds.md> --output <knowledge-url-seeds.json>
```

或者直接把已填写的 Markdown 清单交给执行器：

```bash
${BUN_X} {baseDir}/scripts/execute-knowledge-fetch-jobs.ts --input <knowledge-fetch-jobs.json> --seed-file <knowledge-url-seeds.md> --output <knowledge-search-results.json>
```

开始补核心知识层时，先生成证据模板，再校验是否达标：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-evidence.ts --input <knowledge-search.json> --output <knowledge-evidence.json>
${BUN_X} {baseDir}/scripts/write-knowledge-notes.ts --input <knowledge-search-results.json> --research-dir <research/core-knowledge>
${BUN_X} {baseDir}/scripts/extract-knowledge-findings.ts --title <topic-title> --dir <research/> --output <knowledge-findings.json>
${BUN_X} {baseDir}/scripts/import-knowledge-findings.ts --evidence <knowledge-evidence.json> --findings <knowledge-findings.json>
${BUN_X} {baseDir}/scripts/validate-knowledge-evidence.ts --input <knowledge-evidence.json> --output <knowledge-evidence-report.json>
```

当前 `execute-knowledge-fetch-jobs.ts` 的自动执行边界：

- 已支持：URL 种子自动读取
- 已支持：公众号专业栏目路径的 Agent-Reach 搜索与读取
- 未完全自动化：百科、论文、教材、认证教育资料的通用搜索入口

对未完全自动化的来源，不得伪造结果。必须在结果里保留 `pending` 和失败原因，等待人工补种子 URL 或后续扩展真实搜索入口。

如果研究材料已经整理成 `research/*.md`，优先直接走单命令入口：

```bash
${BUN_X} {baseDir}/scripts/ingest-knowledge-notes.ts --title <topic-title> --evidence <knowledge-evidence.json> --dir <research/> --report-output <knowledge-evidence-report.json>
```

当存在多个候选时，使用脚本执行优先级筛选：

```bash
${BUN_X} {baseDir}/scripts/topic-priority.ts --input <candidates.json> --limit <N>
```

详细规则见 [references/value-filter.md](references/value-filter.md)。

### 步骤 4：初始化任务目录与去重检查

在进入内容生成前，先初始化本次任务目录：

```bash
${BUN_X} {baseDir}/scripts/init-run.ts --slug <topic-slug> --mode <article|poster> --topic <topic-title>
```

初始化后，`publish/manifest.json` 会先写入一版初始排版主题，供封面、配图和正文联动参考。若后续话题角度变化、正文结构变化或需要在成稿前重算，可执行：

```bash
${BUN_X} {baseDir}/scripts/select-formatting-theme.ts --manifest <publish/manifest.json> --file <article.md|poster.md>
```

然后执行历史检查：

```bash
${BUN_X} {baseDir}/scripts/topic-history.ts check --core-event-key <core-key> --angle-key <angle-key> --run-kind <manual|scheduled>
```

去重规则：

- 72 小时内不重复相同核心事件，除非有重大新进展
- 三次每日定时运行中不重复相同话题角度

历史结构见 [references/history-schema.md](references/history-schema.md)。

### 步骤 5：确定作品类型与图片路线

作品类型只能二选一：

- `article`：1 张封面 + 1 张插图
- `poster`：1 张主图

判断逻辑：

- 历史事件、AI 技术、基础科学、机制解释、多段论证类内容优先文章
- 生物、海鲜、食物部位、器物结构、风险提醒、一图看懂类内容优先贴图
- 对账号主方向最匹配的题材，默认优先贴图，尤其是可食部位、结构识别、身体构成、器物拆解、观察科普

图片路线见 [references/image-routing.md](references/image-routing.md)。

### 步骤 6：生成标题、正文与图中文字

先生成 3 个标题候选，每个标题附推荐分与理由。

再生成正文、图中文字、图例文案和提示框文案。所有文本必须遵守 [references/writing-system.md](references/writing-system.md)。

默认文风要求：

- 保留原文核心信息与核心意图
- 自然书面表达
- 句式多样
- 非必要不使用列表
- 不用句首表情符号
- 不用不是……而是……句式
- 不用破折号
- 非引用语境不加双引号
- 避免空泛夸张

### 步骤 7：生成图片素材

根据步骤 5 选择的外部技能生成图片。

**硬规则**：

当需要调用下列任一技能时，必须先读取对应技能的 `SKILL.md`，再按需读取关键 `references/`，然后严格按照它们的文档执行：

- `sweety-image-gen`
- `sweety-infographic`
- `sweety-cover-image`
- `sweety-comic`
- `sweety-article-illustrator`
- `sweety-post-to-wechat`
- `sweety-xhs-images`

禁止仅凭技能名猜测参数。

调用前必须明确：

- 为什么选这个 skill
- 这次调用的参数依据是什么
- 产物应该写入本技能哪个槽位

Google / Gemini 图像路线需要先设置代理：

```bash
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890
export all_proxy=http://127.0.0.1:7890
```

非 Google 路线不设置该代理。

### 步骤 8：发布微信草稿

发布前再次读取 `sweety-post-to-wechat/SKILL.md`。

规则：

- 文章模式走文章草稿流程
- 贴图模式走贴图草稿流程
- 本技能默认只创建草稿，不直接正式发布
- 因环境权限限制，固定只走 `sweety-post-to-wechat` 的 API 发布路径，不走浏览器发布路径
- API 发布最多连续尝试 2 次
- `poster` 首次若命中微信图片相关拦截，可在第 2 次自动切到兜底图，优先保住草稿
- 若 2 次都失败，立即停止发布并明确通知用户发布错误，不再继续重试
- 若兜底图发布成功，必须明确告知用户原始高质量主图仍需手动补传，并汇报 `manifest.publish.original_image_path` 与 `manifest.publish.fallback_image_path`
- 发布使用的图片、标题、摘要、作者、微信账号别名都要写入 `publish/manifest.json`

发布调用统一走脚本：

```bash
${BUN_X} {baseDir}/scripts/publish-draft.ts <file> --work-type <article|poster> --account <alias> --manifest <publish/manifest.json>
```

### 步骤 9：写入历史并完成报告

仅当草稿创建成功后，才写入历史：

```bash
${BUN_X} {baseDir}/scripts/topic-history.ts record --core-event-key <core-key> --angle-key <angle-key> --topic-slug <topic-slug> --work-type <article|poster>
```

完成报告必须包含：

- 话题
- 作品类型
- 使用的主要信源层级
- 选择的外部技能
- 输出目录
- 发布结果
- 是否已写入去重历史

## 参考文档

- [references/workflow.md](references/workflow.md)
- [references/source-policy.md](references/source-policy.md)
- [references/knowledge-base-policy.md](references/knowledge-base-policy.md)
- [references/topic-taxonomy.md](references/topic-taxonomy.md)
- [references/value-filter.md](references/value-filter.md)
- [references/candidate-pipeline.md](references/candidate-pipeline.md)
- [references/writing-system.md](references/writing-system.md)
- [references/image-routing.md](references/image-routing.md)
- [references/history-schema.md](references/history-schema.md)
- [references/storage-policy.md](references/storage-policy.md)
- [references/config/first-time-setup.md](references/config/first-time-setup.md)
- [references/config/preferences-schema.md](references/config/preferences-schema.md)

## Extension Support

通过 EXTEND.md 自定义默认账号、默认数量、检索窗口、图片路线和去重窗口。详见 **偏好设置 (EXTEND.md)**。
