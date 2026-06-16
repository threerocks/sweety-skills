---
name: sweety-liulei-writing-style
description: Use when writing, rewriting, diagnosing, or learning Liu Lei style Chinese articles, especially公众号深文、观点稿、技术解释、职业文章、读书稿、群聊图解、AI 腔返修、人工改稿学习。Use also when the user asks “像我写的”“刘磊风格”“文风学习”“写不出来”“卡住了”。
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-liulei-writing-style
---

# 刘磊写作风格

本 skill 已升级为《写作是门手艺》的实践系统。

旧逻辑只作为辅助：个人口吻、profile、样本 diff、AI 腔清理、朱雀边界、素材密度门禁仍然有效；但当它们和书中方法冲突时，以书中方法为准。最高目标不是“像刘磊”，而是：问题成立、输入够硬、论证可检查、读者读得懂，然后再像用户本人。

它仍可与 `sweety-humanize-writing` 配合，但顺序已经改变：

- 本 skill：先判定写作问题、输入链、论证、读者和过程。
- `sweety-humanize-writing`：在稿件有可写基础后，清理通用 AI 腔、套话、空泛连接和不自然节奏。
- 本 skill 的个人风格层：最后读取 profile 和样本，把表达取舍改得更像用户本人。

默认组合：

```text
问题/读者/输入/论证/结构门禁
-> 素材包或低保真骨架
-> 初稿或局部段落
-> sweety-humanize-writing 做通用清洁
-> 本 skill 套个人 profile
-> 人工编辑器确认
-> 文风深学习与四库归档
```

## 必读顺序

遇到任何实质写作、改写、诊断、标题、开头、结构、读书稿、深文、技术解释、职业稿、热点稿、卡住推进任务，先读：

1. `references/writing-craft-book-practice.md`
2. `references/writing-craft-tests.md`，当你要自测或处理高风险任务时读取
3. `references/media-writing-iron-laws.md`，当任务属于公众号、媒体、观点、热点、职业自救或普通人行动稿时读取
4. `references/zhuque-calibration.md`，当用户提到朱雀、Matrix、AI 检测、AI 率、人工创作特征或检测失败时读取
5. `references/writing-craft-coverage.md`，当用户问“书是否完整吸收”“这次升级覆盖了什么”时读取

然后再读个人风格库：

```bash
${SWEETY_WRITING_STYLE_HOME:-$HOME/.codex/writing-style/liulei}
```

默认读取：

1. `profiles/global/profile.md`
2. 最接近任务的子 profile
3. 最近和最相似样本的 `diff-notes.md`，必要时读 `ai-draft.md` 和 `human-final.md`

个人 profile 只决定表达取舍，不得覆盖书籍实践门禁。

## Profile 选择

| 场景 | profile |
|---|---|
| 公众号深度文章、视频整理、国漫长文、读书深文 | `wechat-deep-article` |
| 掘金技术文章、AI/Agent 观点、前端工程方案 | `juejin-technical-writing` |
| 群聊讲解图、图解卡片、观点拆解图、展示文档 | `group-infographic` |
| 技术方案、架构说明、工具实现复盘 | `technical-explanation` |
| 职业自救、普通人行动、热点观点 | 先读 `global`，再按交付物选 `wechat-deep-article` 或项目 profile |
| 场景不明确 | 先读 `global`，完成书籍门禁后再判断 |

不要把一个场景的口吻硬迁移到另一个场景。公众号口吻不能污染技术文档，技术说明也不能写成公众号爆文。

## 快速路由

| 用户输入 | 先做什么 | 禁止什么 |
|---|---|---|
| 只有大题目 | 先压成 `question_line`、`puzzle_line`、`scope_line` | 直接写正文 |
| 说“像我写的” | 先做可改性诊断、论证树、读者门禁 | 只删连接词、加口语词 |
| 说“卡住了” | 先做 `blockage_diagnosis`，给 10-20 分钟下一步 | 直接代写完整终稿 |
| 有资料包 | 先分材料角色、溯源、情境化、对话定位 | 把资料拼成文 |
| 要观点稿 | 先画问题-观点-理由-证据树 | 裸观点、情绪站队 |
| 要标题/开头 | 先确认问题、对象、读者收益和正文可兑现度 | 标题党、悬空恐吓 |
| 要读书稿 | 先说明作者问题、材料方法、我补什么 | 漂亮读后感 |
| 要深文 | 先查真实土壤、输入链、读者 profile | 临时拼贴装深 |
| 长文转展示文档 | 先重定义听众、现场、页级功能和展示后动作 | 直接切段复制长文 |

## 主流程

默认按这个顺序执行。用户明确只要某一步时，可以只交付那一步，但不能跳过它的前置门禁。

```text
任务分流
-> reader_profile + 送礼测验
-> topic_raw -> question_line -> puzzle_line -> scope_line -> variable_table
-> 输入链：有字之书 / 无字之书 / 文献对话 / 来源边界
-> 最小论证树：问题 / 观点 / 理由 / 证据 / 前提 / 反方 / 边界
-> 编码卡：读者框架 / 一句话主旨 / 张力 / 主角或问题 / 阻力 / 证据 / 不写什么
-> 结构选择：分类 / 评价 / 时间 / 比较 / 流程 / 因果 / 隐性 TAIMRDR
-> 初稿或局部产物
-> 流动门禁：抽象词下沉 / 主谓显眼 / 上下句接龙 / 段落主题句 / 段间关系
-> 个人 profile：刘磊口吻、样本取舍、句子节奏、气口
-> 文章外结论包：材料来源、写作过程、成品评分、风险边界、下一轮改法
-> 反馈回路：人工修改、读者障碍、四库归档、文风深学习
```

## 材料讲述与段落逻辑

写作不是把材料拆成一句一句罗列。只要用户要求“讲明白一个材料”、整理资料、视频转文、读书稿、观点稿或公众号深文，默认先把材料组织成连续段落，让读者顺着理解，而不是看到一串孤立判断。

成文前必须检查：

- 每个核心材料先说明它回答什么问题、出现在哪个场景、和主判断有什么关系。
- 一个段落只承担一个主要功能：交代背景、展开冲突、解释机制、给出证据、转入判断或收住边界。
- 段落内部要有推进：上一句给出对象或事实，下一句解释原因、后果、变化或和读者的关系。
- 段落之间要有关系：递进、转折、因果、对照、补充或回到主线；不能只是换行后的下一条。
- 能用自然段讲清楚时，不把正文写成清单、短句排队、金句堆叠或“一句话一个点”。
- 引用资料时不要只摘句子，要补足情境、人物/机构、动作、结果和可外推边界。
- 读者第一次接触这个材料也应能读通：谁在做什么，为什么重要，问题怎么发展，作者为什么得出这个判断。

如果初稿已经像罗列，先做 `paragraph_rebuild`，再润色：

```yaml
paragraph_rebuild:
  material_unit: 要讲清楚的核心材料
  reader_question: 读者读到这里最可能问什么
  paragraph_job: 这一段负责背景 / 冲突 / 机制 / 证据 / 判断 / 边界中的哪一项
  context: 材料发生的场景和前提
  development: 事实如何推进，变化在哪里
  explanation: 这件事为什么能支撑主判断
  transition: 它和上一篇/下一段是什么关系
  boundary: 不能外推到哪里
```

正文形态优先级：

1. 系统讲清楚一个材料的自然段。
2. 段落加少量必要清单，用清单承载步骤、字段或对照。
3. 纯清单只用于工具表、检查表和发布包；不得伪装成深文正文。

## 写作前硬门禁

正文前至少通过下面几项；不通过时，输出问题清单、素材缺口、局部示范、低保真骨架或下一步动作，不输出终稿。

```yaml
reader_profile:
  target_reader:
  reader_interest:
  reader_background:
  reader_stakes:
  reader_resistance:
craft_gate:
  topic_raw:
  question_line:
  puzzle_line:
  scope_line:
  variable_table:
    dependent_variable:
    comparison:
    constants:
    candidate_causes:
    mechanism:
    evidence_status:
  value_score:
input_chain:
  written_sources:
  lived_or_real_world_touchpoints:
  material_roles:
  source_context:
  dialogue_position:
argument_tree:
  problem:
  main_claim:
  claim_type:
  reasons:
  evidence:
  hidden_assumptions:
  strongest_counterargument:
  boundary:
encoding_card:
  one_sentence_thesis:
  tension:
  protagonist_or_problem:
  obstacle:
  expected_gain:
  discarded_materials:
craft_report:
  material_trace:
  process_trace:
  thinking_notes:
  quality_scorecard:
  risk_boundary:
  next_revision:
```

## 文章外结论包

任何实质写作、改写、视频整理、读书稿、观点稿、深文和发布前稿件，默认同时输出正文之外的 `craft_report`。正文可以保持干净；工艺报告必须放在正文前后或单独文件里，不能混入正文伪装成文章内容。

`craft_report` 必须包含：

```yaml
craft_report:
  material_trace:
    - source: 材料来源、链接、文件或逐字稿
      role: 观点 / 证据 / 案例 / 背景 / 反方 / 评论样本 / 边界
      used_for: 支撑了正文哪一段或哪个判断
      reliability: 高 / 中 / 低，以及原因
      limitation: 不能外推到哪里
  process_trace:
    reader_profile: 本文写给谁
    question_line: 本文回答什么问题
    puzzle_line: 读者为什么会被这个问题卡住
    argument_tree: 主判断、理由、证据、反方、边界
    structure_choice: 为什么按这个顺序写
    style_profile: 使用的 profile 和风格取舍
  thinking_notes:
    chosen_angle: 为什么选这个角度
    rejected_angles: 为什么没写其他角度
    key_tradeoff: 为了清楚、可信或篇幅做了什么取舍
  quality_scorecard:
    problem_sharpness: 0-10
    material_strength: 0-10
    evidence_fit: 0-10
    argument_integrity: 0-10
    reader_gain: 0-10
    structure_flow: 0-10
    style_fit: 0-10
    originality: 0-10
    fact_boundary: 0-10
    publish_readiness: 0-10
    total: 0-100
    verdict: 可发 / 需补材料 / 只适合作草稿 / 暂不建议写
  risk_boundary:
    - 可能争议、未核验、样本不足、术语不确定或需要人工确认的点
  next_revision:
    - 下一轮最该补的 1-5 个材料或修改动作
```

打分规则：

- 低于 60：不输出“终稿”，只能输出草稿、骨架或待补素材清单。
- 60-74：可作为内部草稿，但必须列出补材料项。
- 75-84：可进入人工编辑；正文仍需人工确认事实、口吻和标题。
- 85 以上：可作为较成熟稿，但仍不得承诺平台表现或 AI 检测结果。

评分必须具体说明扣分理由。不要只给分数；每个低于 8 分的维度至少写一句原因。

## 写作障碍处理

当用户说“卡住、写不出来、没感觉、不知道怎么写、拖着不想写”，这不是终稿任务，先诊断：

```yaml
blockage_diagnosis:
  material_block:
  question_block:
  structure_block:
  wording_block:
  attention_block:
  feedback_block:
  fear_block:
```

对应动作：

- 没材料：补素材、案例、文献、数据。
- 没问题：回到提问门禁。
- 没结构：先搭格子，非线性填空。
- 落不了字：用口述、语音输入、10 分钟放空式写作。
- 注意力散：给 25 分钟工作块。
- 没反馈：生成具体求助问题。
- 怕写烂：启动“先有后好”，只求从 0 到 1。

## 个人风格层

只有当书籍实践门禁基本成立后，才套个人风格。

稳定偏好：

- 先给判断，再给材料；但判断后必须有理由或证据入口。
- 个人口吻低于事实可靠、论证完整和读者理解成本。
- 内容密度优先于漂亮句子；任意连续约 300 字必须有信息增量。
- 保留真实气口：边界、争议、待补处或读者可纠正处；气口不是逻辑漏洞。
- 标题可以有主观判断，但必须有对象、问题和正文兑现能力。
- 口语、短句、停顿可以保留，但不能遮蔽主语、动作、证据和边界。
- 不学习错字、病句、事实错误、检测焦虑下的乱标点或同义词替换。

旧版八类改稿动作仍可用，但必须排在书籍门禁之后：

1. 逻辑优化：先修问题、结构、论证薄弱处和因果跳跃。
2. 整体润色：只在信息边界清楚后修语病和别扭表达。
3. 节奏调整：调长短句和停顿，但不制造伪金句。
4. 情感增强：改为经验具体化，只能来自原材料、用户经历或可核验信息。
5. 精简压缩：删除重复、弱相关和无信息句，保留核心论证。
6. 扩写丰富：只补有来源的案例、数据、细节或多角度分析。
7. 风格转换：不得覆盖事实、核心观点和 profile 边界。
8. 传播优化：标题、开头和小标题服务对象、问题、读者收益和正文兑现能力。

## AI 腔与腔调清理

先诊断再润色。逐段标注：

- 学生腔：情绪大于事实，漂亮词和升华代替论证。
- 学术腔：概念堆叠，把简单问题复杂化。
- 官腔：主语消失，责任和动作被大词遮住。
- AI 安全腔：正确、均衡、完整，但没有真实对象、取舍和新信息。

清理顺序：

1. 翻译成普通话：这句话到底说哪件事？
2. 补对象、动作、条件、结果。
3. 删装饰概念和安全套话。
4. 检查论证树和读者成本。
5. 最后调语气和节奏。

如果一句话翻译后没有信息，删掉。

## 真实素材与边界

禁止伪造用户的求职、裁员、收入、公司、家庭、病痛、关系和具体项目经历。

用户不提供个人经历时，不默认要求用户补亲历；先搜集公开案例、政策问答、法院/仲裁案例、学校就业指导、招聘场景、论坛/评论区可归纳困境，或写有来源边界的故事剧本。

虚拟人物必须在资料包记录原型来源和合成边界。正文不能伪装成投稿、粉丝私信、作者亲历或采访。

涉及 `12333` 时，必须写成具体入口或动作：拨打 12333 电话、掌上12333 App/小程序、电子社保卡、国家社会保险公共服务平台、全国人社政务服务平台、本地人社 App 或窗口。

涉及银行卡和现金流时，必须写具体工具和字段：手机银行 App/网银、微信/支付宝余额、信用卡账单、还款日、工资卡流水。

## 反馈与学习

需要让用户人工修改并记录风格时，优先使用脚本：

```bash
node ~/.codex/skills/sweety-liulei-writing-style/scripts/style-editor.mjs \
  --draft /absolute/path/article.md \
  --profile wechat-deep-article \
  --port 4178
```

也可以指定样本 id：

```bash
node ~/.codex/skills/sweety-liulei-writing-style/scripts/style-editor.mjs \
  --draft /absolute/path/article.md \
  --profile wechat-deep-article \
  --sample-id 20260602-example \
  --port 4178
```

确认后还必须做“文风深学习”：

1. 读取本次 `diff-notes.md`、`ai-draft.md`、`human-final.md`。
2. 提炼可复用规则：读者障碍、问题压缩、材料角色、结构调整、标题方式、开头锚点、判断句式、资料嵌入、建议组织和结尾收束。
3. 追加到对应 `profiles/<profile>/profile.md`，标题为 `## <date> <sample-id> 文风深学习`。
4. 只记录表达策略和删改偏好，不把单篇事实写成跨题材规则。
5. 下次同类写作前，优先读取最近的文风深学习记录。

## 输出

写作或改写完成时，简短说明：

- 使用了哪个 profile。
- 读取了哪些书籍实践 reference、样本或素材。
- 哪些门禁生效。
- 输出 `craft_report`：材料来源、过程、分维度评分、风险边界和下一轮改写建议。
- 如果没有输出终稿，说明卡在哪个门禁以及下一步怎么推进。

用户只要求正文时，正文仍保持干净；但必须在正文之外给极简 `craft_report`，或另存为独立工艺报告，除非用户明确说“不要任何过程说明和评分”。
