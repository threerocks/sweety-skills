# 候选话题标准化

当热点扫描、人工整理或外部检索返回一批原始候选时，不要直接交给 `topic-priority.ts`。

先用 `scripts/build-candidates.ts` 把原始候选标准化，再把生成结果里的 `candidates` 交给 `scripts/topic-priority.ts`。

## 推荐顺序

1. 收集原始候选
2. 写成 `raw-topics.json`
3. 先做内容净化，过滤营销、菜谱、探店、促销型结果
4. 运行 `build-candidates.ts`
5. 运行 `topic-priority.ts`
6. 取最终入选话题进入成稿

## 命令

```bash
${BUN_X} {baseDir}/scripts/build-candidates.ts --input raw-topics.json --output candidates.json
${BUN_X} {baseDir}/scripts/topic-priority.ts --input candidates.json --limit 2
```

## 原始候选字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 话题标题 |
| `category` | 是 | 类目，如 `bio-edible`、`basic-science`、`history-events` |
| `freshness` | 是 | 新鲜度，0-30 |
| `spread` | 是 | 传播力，0-30 |
| `depth` | 是 | 深度潜力，0-20 |
| `humanity` | 是 | 人文关联，0-20 |
| `practical` | 是 | 实用性，可填 `true/false` 或数值 |
| `scarcity` | 是 | 稀缺性，可填 `true/false` 或数值 |
| `resonance` | 是 | 共鸣度，可填 `true/false` 或数值 |
| `support_sources` | 是 | 独立可信来源数量 |
| `knowledge_sources` | 否 | 核心知识来源数量 |
| `explain_points` | 否 | 可解释点列表，例如结构、机制、误区、案例、实用要点 |
| `safe` | 是 | 是否安全 |
| `content_fit` | 否 | 是否通过内容净化，默认应为 `true` |
| `content_flags` | 否 | 被判为营销、菜谱、探店、促销的原因 |
| `requires_core_knowledge` | 否 | 是否必须补核心知识层 |
| `min_knowledge_sources` | 否 | 最少需要的核心知识来源数量 |
| `preferred_knowledge_source_types` | 否 | 优先补的核心知识来源类型 |
| `knowledge_queries` | 否 | 后续补核心知识时建议直接使用的查询词 |
| `knowledge_angle` | 是 | 该话题准备转成什么科普角度 |

## 标准化规则

- 三大价值标准至少命中两项，否则淘汰
- 独立可信来源少于 2 个，默认淘汰
- 若明显偏营销、促销、菜谱、探店内容，先淘汰
- 缺少明确 `knowledge_angle`，淘汰
- 无法支撑解释、机制、误区、案例、实用要点中的至少两项，淘汰
- 热点本身再热，只要没有知识增量，也应被淘汰

## 输出说明

`build-candidates.ts` 输出：

- `candidates`：可直接给 `topic-priority.ts` 的标准化候选
- `needs_knowledge_enrichment`：是否还需要补核心知识层
- `preferred_knowledge_source_types`：下一步优先查哪些知识来源
- `knowledge_queries`：下一步可直接执行的补资料查询
- `accepted_titles`：通过基础门槛的话题
- `rejected`：被淘汰的话题和原因
