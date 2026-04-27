# 核心知识层补料

当候选已经进入标准化阶段后，不要只看热点层结果。对需要科普解释、定性判断、结构说明、误区纠正的话题，必须先补核心知识层。

## 适用来源优先级

优先顺序固定为：

1. 百科全书类资料，如《中国儿童百科全书》及同类权威百科
2. 论文、综述、学术期刊
3. 可追溯作者与出处的杂志科普或专业栏目
4. 教材、课程资料、教辅
5. 经过认证的培训资料、教育资料、机构公开教学材料

## 命令

```bash
${BUN_X} {baseDir}/scripts/plan-knowledge-enrichment.ts --input candidates.json --output knowledge-plan.json
```

再将任务单展开成分层检索输入：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-search.ts --input knowledge-plan.json --output knowledge-search.json
```

如需把这些输入继续变成标准抓取任务，直接运行：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-fetch-jobs.ts --input knowledge-search.json --research-dir research/core-knowledge --output knowledge-fetch-jobs.json
```

输出里的每条 job 都会带：

- `source_type`
- `priority_order`
- `query_variants`
- `goal`
- `research_note_path`

若要继续自动执行，运行：

```bash
${BUN_X} {baseDir}/scripts/execute-knowledge-fetch-jobs.ts --input knowledge-fetch-jobs.json --output knowledge-search-results.json
```

当前自动执行器的边界：

- 支持 URL 种子自动读取
- 百科全书类 URL 种子在原始站点被限流或拦截时，会自动尝试切到 Wikipedia 作为备用百科源，并清理页首菜单、编辑链接、图片表格等常见噪音，再按题目、`knowledge_angle` 和查询词选择更贴题的正文段落
- 支持公众号专业栏目路径的 Agent-Reach 搜索与读取
- 对未接入的百科、论文、教材、认证教育资料搜索源，只会明确输出 `pending`，不会伪造结果

对自动回退到 Wikipedia 的结果，建议在正式写稿前快速人工复核一次摘要是否落在当前题目的核心知识点上。

若执行后仍有 `pending`，推荐立刻生成 URL 种子模板：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-url-seeds.ts --jobs knowledge-fetch-jobs.json --execution knowledge-search-results.json --output knowledge-url-seeds.json
```

种子模板里会自动带上：

- `recommended_domains`
- `recommended_search_queries`
- `query_variants`
- `goal`
- `evidence_targets`
- `research_note_path`
- `fill_rules`

补完 `source_title` 和 `source_url` 后，再次执行：

```bash
${BUN_X} {baseDir}/scripts/execute-knowledge-fetch-jobs.ts --input knowledge-fetch-jobs.json --seed-file knowledge-url-seeds.json --output knowledge-search-results.json
```

如果更适合人工补全，推荐走 Markdown 清单：

```bash
${BUN_X} {baseDir}/scripts/render-knowledge-url-seeds.ts --input knowledge-url-seeds.json --output knowledge-url-seeds.md
${BUN_X} {baseDir}/scripts/parse-knowledge-url-seeds.ts --input knowledge-url-seeds.md --output knowledge-url-seeds.json
```

Markdown 清单只需要改每个条目里的 `可编辑种子块`，其余说明段落不需要动。

若已经填完 Markdown 清单，也可以不再手动转回 JSON，直接执行：

```bash
${BUN_X} {baseDir}/scripts/execute-knowledge-fetch-jobs.ts --input knowledge-fetch-jobs.json --seed-file knowledge-url-seeds.md --output knowledge-search-results.json
```

若已经把核心知识层资料整理进 `research/*.md`，推荐继续用下面这组命令，而不是手工回填：

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-evidence.ts --input knowledge-search.json --output knowledge-evidence.json
${BUN_X} {baseDir}/scripts/ingest-knowledge-notes.ts --title "<topic-title>" --evidence knowledge-evidence.json --dir research/ --report-output knowledge-evidence-report.json
```

如果外部检索结果已经是结构化 JSON，先写成标准研究笔记，再进入抽取和导入：

```bash
${BUN_X} {baseDir}/scripts/write-knowledge-notes.ts --input knowledge-search-results.json --research-dir research/core-knowledge
```

如需为指定题目生成任务单：

```bash
${BUN_X} {baseDir}/scripts/plan-knowledge-enrichment.ts --input candidates.json --titles "题目A||题目B"
```

## 输出说明

输出里的每个任务包含：

- `preferred_knowledge_source_types`
- `knowledge_queries`
- `evidence_targets`
- `certainty_policy`

`prepare-knowledge-search.ts` 会继续展开为：

- `search_packets`
- 每层来源的 `priority_order`
- 每层来源的 `query_variants`
- 每层来源本轮要完成的 `goal`

## 使用原则

- 热点层负责发现角度，核心知识层负责支撑结论。
- 没补够核心知识层前，不进入正文定稿。
- 若精确器官、精确部位或精确定义证据不足，降级为区域判断或保守说法。
- 对生物、海鲜、食物、结构拆解、基础科学、历史、AI 原理类内容，默认必须补核心知识层。
