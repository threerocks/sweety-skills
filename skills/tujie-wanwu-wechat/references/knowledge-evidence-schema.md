# 核心知识证据结构

当核心知识层开始补料时，统一使用证据文件，不要把补到的资料散落在随手笔记里。

## 生成模板

```bash
${BUN_X} {baseDir}/scripts/prepare-knowledge-evidence.ts --input knowledge-search.json --output knowledge-evidence.json
```

## 校验证据

```bash
${BUN_X} {baseDir}/scripts/validate-knowledge-evidence.ts --input knowledge-evidence.json --output knowledge-evidence-report.json
```

## 批量导入检索结果

```bash
${BUN_X} {baseDir}/scripts/import-knowledge-findings.ts --evidence knowledge-evidence.json --findings knowledge-findings.json
```

## 从研究笔记抽取 findings

当核心知识层资料已经整理为 `research/*.md` 时，优先先抽取，再导入：

```bash
${BUN_X} {baseDir}/scripts/extract-knowledge-findings.ts --title "<topic-title>" --dir research/ --output knowledge-findings.json
```

抽取脚本会优先读取：

- `# ...` 作为 `source_label`
- `- 标题：`
- `- 链接：`
- `- 时间：`
- `- 来源类型：`
- `## 可直接写入成稿的确定性结论`
- `## 核心信息`
- `## 摘要`
- `## 要点`

若来源类型不容易自动判断，可显式指定：

```bash
${BUN_X} {baseDir}/scripts/extract-knowledge-findings.ts --title "<topic-title>" --dir research/ --default-source-type "教材/课程资料/教辅"
```

如果外部搜索层已经给出结构化结果，先把它们写成标准研究笔记：

```bash
${BUN_X} {baseDir}/scripts/write-knowledge-notes.ts --input knowledge-search-results.json --research-dir research/core-knowledge
```

`knowledge-search-results.json` 中每条结果建议至少包含：

- `topic_title`
- `source_type`
- `source_title`
- `source_url`
- `summary` 或 `excerpt`

推荐补充：

- `source_label`
- `captured_at`
- `certainty_conclusion`
- `key_points`
- `notes`

## 单命令导入与校验

如果想把抽取、导入、校验合并成一次执行，直接用：

```bash
${BUN_X} {baseDir}/scripts/ingest-knowledge-notes.ts --title "<topic-title>" --evidence knowledge-evidence.json --dir research/ --report-output knowledge-evidence-report.json
```

若任务已经有 `publish/manifest.json`，可继续加：

```bash
--manifest publish/manifest.json --plan knowledge-plan.json --search knowledge-search.json
```

`knowledge-findings.json` 中每条结果至少包含：

- `title`
- `source_type`
- `source_label`
- `source_url`
- `source_title`
- `excerpt`

其余字段可选，脚本会自动推断：

- `evidence_for`
- `certainty`

## `knowledge-evidence.json` 中的证据项

每条 `evidence_item` 至少包含：

- `source_type`
- `source_label`
- `source_url`
- `source_title`
- `captured_at`
- `evidence_for`
- `certainty`
- `independent`
- `excerpt`
- `notes`

## 校验规则

- 证据来源必须属于当前任务允许的核心知识来源类型
- 独立来源数量必须达到 `min_knowledge_sources`
- `evidence_targets` 需要全部被覆盖
- 若证据只能支持保守结论，`certainty` 应降级为 `有限确定性`

## 使用原则

- 证据文件是核心知识层的统一真相源
- 没通过 `validate-knowledge-evidence.ts` 前，不进入正文定稿
- 若某类来源迟迟找不到，可继续沿 `remaining_queries` 补查，但不能退回只用热点层
