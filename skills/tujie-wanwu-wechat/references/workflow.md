# 工作流

本文档补充 `SKILL.md` 中的主流程，重点说明分支逻辑、进度汇报要求和各阶段产物。

## 总体顺序

1. 加载偏好设置
2. 规范化输入
3. 检索资料
4. 价值筛选
5. 候选标准化
6. 核心知识层补料任务规划
7. 核心知识层检索输入展开
8. 核心知识抓取任务生成
9. 核心知识抓取任务执行
10. 核心知识证据模板生成
11. 原始资料笔记抽取与证据导入
12. 核心知识证据校验
13. 事实门槛检查
14. 优先级脚本筛选
15. 去重检查
16. 作品类型判断
17. 自动推断微信排版风格
18. 生成标题与正文
19. 生成图片
20. 创建微信草稿
21. 写入历史

## 进度汇报要求

每一阶段结束都要告诉用户两件事：

- 当前完成了什么
- 下一步准备做什么

推荐汇报粒度：

- 输入规范化后汇报一次
- 完成检索后汇报一次
- 完成筛选并锁定话题后汇报一次
- 选定作品类型和图片 skill 后汇报一次
- 草稿创建完成后汇报一次

## 输入分支

### 用户给 URL

- 不做热点扫描
- 以 URL 为主锚点
- 补 1 个独立支持信源，除非用户明确要求更多
- 优先提炼事件、对象、争议点和适合图解的角度

### 用户给关键词

- 不做热点扫描
- 以关键词为主锚点
- 补 1 个独立支持信源，除非用户明确要求更多
- 若关键词过大，先缩小为单个事件、单个对象或单个知识问题

### 用户未给话题

- 扫最近 6 小时热点
- 再补最近 7 天热点
- 再补历史上的今天
- 先按优先级归类，再按评分与门槛筛出默认 2 个候选

优先级顺序固定为：

1. 生物 / 海鲜 / 食物可食部位；动物 / 植物 / 器官 / 身体结构 / 习性 / 在哪观赏；基础科学
2. 器物 / 工具 / 日用品结构拆解；历史事件 / 历史上的今天
3. 国漫当前剧情；AI 技术与技术原理；热点新闻延展科普

如果第一优先级已经找到合格候选，不再让第二、第三优先级插队。

将候选写成 JSON 后，交给 `scripts/topic-priority.ts` 做最终筛选。

在这之前，推荐先运行：

```bash
${BUN_X} {baseDir}/scripts/build-candidates.ts --input raw-topics.json --output candidates.json
```

若候选需要补核心知识层，继续运行：

```bash
${BUN_X} {baseDir}/scripts/plan-knowledge-enrichment.ts --input candidates.json --output knowledge-plan.json
```

生成的任务单要优先指向百科全书、论文综述、杂志科普栏目、教材课程资料、认证教育资料等核心知识来源，而不是继续在热点源里打转。

然后继续展开为真正的分层检索输入：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-search.ts --input knowledge-plan.json --output knowledge-search.json
```

若想把这些输入直接交给外部检索或 Agent-Reach 执行，再补一层抓取任务：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-fetch-jobs.ts --input knowledge-search.json --research-dir research/core-knowledge --output knowledge-fetch-jobs.json
```

若已经有 URL 种子，或当前任务属于公众号专业栏目这一路，可继续执行：

```bash
${BUN_X} {baseDir}/scripts/execute-knowledge-fetch-jobs.ts --input knowledge-fetch-jobs.json --output knowledge-search-results.json
```

其中百科全书类 URL 种子如果遇到原始站点限流、匿名访问拦截或 451 类错误，执行器会自动尝试切换到 Wikipedia 作为备用百科源，并先清理页首菜单、编辑链接、图片表格等噪音，再按题目、`knowledge_angle` 与查询词选择更贴题的正文段落；如果备用源也失败，才保留在 `failed` / `pending`。即使备用摘要已经可读，进入成稿前仍应人工快速复核一次。

若执行器无法自动覆盖某类来源，必须把该来源保留在 `pending` 中，不得直接跳过来源层级要求。

此时立刻补一层 URL 种子模板：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-url-seeds.ts --jobs knowledge-fetch-jobs.json --execution knowledge-search-results.json --output knowledge-url-seeds.json
```

把 `source_title`、`source_url` 补完后，重新执行：

```bash
${BUN_X} {baseDir}/scripts/execute-knowledge-fetch-jobs.ts --input knowledge-fetch-jobs.json --seed-file knowledge-url-seeds.json --output knowledge-search-results.json
```

补资料开始前，先生成统一证据模板：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-evidence.ts --input knowledge-search.json --output knowledge-evidence.json
```

若外部检索结果已经整理成 JSON，先写成标准研究笔记：

```bash
${BUN_X} {baseDir}/scripts/write-knowledge-notes.ts --input knowledge-search-results.json --research-dir research/core-knowledge
```

若研究材料已经整理为 `research/*.md`，再抽取成结构化 findings：

```bash
${BUN_X} {baseDir}/scripts/extract-knowledge-findings.ts --title "<topic-title>" --dir research/ --output knowledge-findings.json
```

若已经拿到一批核心知识检索结果或上一步抽取结果，优先批量导入证据，而不是一条条手填：

```bash
${BUN_X} {baseDir}/scripts/import-knowledge-findings.ts --evidence knowledge-evidence.json --findings knowledge-findings.json
```

补料后必须再做一次证据校验：

```bash
${BUN_X} {baseDir}/scripts/validate-knowledge-evidence.ts --input knowledge-evidence.json --output knowledge-evidence-report.json
```

如果想把以上三步压成一次执行，直接用：

```bash
${BUN_X} {baseDir}/scripts/ingest-knowledge-notes.ts --title "<topic-title>" --evidence knowledge-evidence.json --dir research/ --report-output knowledge-evidence-report.json
```

若本次任务已经初始化了 `publish/manifest.json`，还可以一并同步：

```bash
${BUN_X} {baseDir}/scripts/ingest-knowledge-notes.ts --title "<topic-title>" --evidence knowledge-evidence.json --dir research/ --report-output knowledge-evidence-report.json --manifest publish/manifest.json --plan knowledge-plan.json --search knowledge-search.json
```

## 作品类型判断

### 优先做文章的情况

- 需要来龙去脉
- 需要多段论证
- 需要讲机制、原理、背景或结局
- 需要同时容纳结论、误区、案例和实用提醒

### 优先做贴图的情况

- 一张图就能解决核心问题
- 面向快速识别、快速判断、快速收藏
- 内容核心是结构、部位、风险、能吃别吃、外部特征
- 内容属于账号主方向，例如可食部位、动植物观察、身体结构、器物拆解

## 微信排版风格推断

未显式传入 `--theme` 时，发布前会综合以下信号自动选择微信排版主题：

- 选定话题与 `selection.category`
- `knowledge_angle`
- 正文结构与语言风格
- `work_type`
- 已整理的核心知识标题和研究来源提示

决策原则：

- `ai-tech`、技术机制、工具工作流优先偏 `bytedance` / `github` / `sspai`
- `history-events`、来龙去脉、时间线优先偏 `newspaper` / `magazine` / `chinese`
- 生物、可食部位、自然观察优先偏 `terracotta` / `mint-fresh` / `coffee-house`
- `poster` 作品会更偏 `bauhaus` / `focus-*` / `sports`

若命令行显式传入 `--theme`，则显式值优先。

建议执行时机：

- 任务初始化后：直接读取 `manifest.formatting` 作为初始主题
- 正文初稿完成后：运行 `select-formatting-theme.ts` 重算
- 发布前：`publish-draft.ts` 会基于最终正文再次确认

## 发布前检查

发布前至少确认：

- 标题与正文承诺一致
- 图片与作品类型一致
- 图片路径与 manifest 绑定正确
- 资料来源层级达标
- 去重检查通过
- 微信账号别名已确认
- 发布方式已锁定为 API
- 如第一次 API 失败，准备第二次且仅第二次重试
- 若 `poster` 首次失败命中微信图片相关拦截，确认可切换兜底图并保留原图路径

建议统一使用：

```bash
${BUN_X} {baseDir}/scripts/publish-draft.ts <file> --work-type <article|poster> --account <alias> --manifest <publish/manifest.json>
```

## 完成定义

只有同时满足以下条件，才能视为完成：

- 任务目录已初始化
- 文本已完成
- 图片已落到正确槽位
- 微信草稿已创建成功
- 历史已写入

如果 API 连续 2 次都失败，则完成定义改为：

- 生成产物已保留
- 用户已收到明确错误说明
- 未写入历史

如果 `poster` 第 2 次通过的是兜底图草稿，则补充要求：

- `manifest.publish.manual_image_action_required = true`
- `manifest.publish.original_image_path` 指向原始高质量主图
- `manifest.publish.fallback_image_path` 指向用于 API 草稿的兜底图
- 汇报里必须明确说明“草稿已建成，但主图仍需手动替换”
