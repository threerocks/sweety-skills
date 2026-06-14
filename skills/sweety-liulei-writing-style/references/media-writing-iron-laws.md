# 媒体写作铁律

这些规则用于阻止空泛公众号稿。它们不是风格建议，而是写作准入门槛。

## 依据来源

- Reuters Journalistic Standards: accuracy comes before speed; sourcing must be honest; do not fabricate or plagiarise. https://reutersagency.com/about/standards-values/
- The Elements of Journalism: first obligation is truth; essence is verification; make significant things interesting and relevant; provide a forum for criticism and compromise. https://penguinrandomhousehighereducation.com/book/?isbn=9780804136792
- Solutions Journalism Network: useful solutions reporting needs response, insight, evidence and limitations. https://www.solutionsjournalism.org/learning-lab/toolkits-guides/basic-toolkit/introduction/how-do-i-know-its-solutions-journalism
- Nieman Storyboard: scenes are building blocks of narrative journalism, but journalists must report scenes, not fabricate them. https://niemanstoryboard.org/2023/04/20/narrative-journalism-reporting-writing-scenes/
- Nieman Storyboard on narrative interviews: structure is a deliberate sequence of revelation; scenes, summary and exposition each do different work. https://niemanstoryboard.org/2024/07/25/interviews-narrative-nonfiction-cinematic-scenes-details/
- Nielsen Norman Group: online readers scan more than they read word by word; digital articles must be built for scanning. https://www.nngroup.com/articles/how-people-read-online/
- Poynter / Roy Peter Clark: strong verbs, concrete details and sentence emphasis make prose work; craft is not decoration. https://www.poynter.org/reporting-editing/2006/fifty-writing-tools-quick-list/
- The Open Notebook: a topic is not yet a story; reporting and narrative approach turn a topic into a story. https://www.theopennotebook.com/2012/07/11/sharpening-ideas/

## 第一铁律：题目不是文章

禁止从一个抽象题目直接写成文。

写作前必须先把题目压成至少一种可写材料：

1. 真实案例：一个人、一个时间点、一个场景、一个选择、一个代价。
2. 解决办法：一个具体场景下可执行的步骤、材料、入口、顺序、风险。
3. 干货清单：读者今天能做的事项，每项都要有条件、路径、坑点和边界。
4. 热点观点：发生了什么，谁受影响，我的判断是什么，可能错在哪里。
5. 数据解释：一个数字为什么重要，它改变了普通人的哪个选择。
6. 对照拆解：错误做法和更好做法放在一起，让读者看出差异。

没有以上任一材料，不许写正文，只能继续做资料包。

## 素材包最低格式

写作前必须先形成一个素材包。最小字段如下：

```json
{
  "topic": "",
  "material_modes": ["case|procedure|checklist|hot_take|data_explainer|comparison"],
  "case_cards": [
    {
      "source": "原型来源",
      "scene": "人物在什么时间和场景遇到什么问题",
      "choice": "他/她做了什么选择",
      "cost": "付出了什么代价或遇到什么后果",
      "boundary": "哪些细节被匿名/合成/不可写死"
    }
  ],
  "action_cards": [
    {
      "who": "适用对象",
      "trigger": "触发场景",
      "path": "入口/路径/步骤",
      "materials": "需要准备什么",
      "standard": "怎么判断做完或有效",
      "pitfalls": "常见坑",
      "boundary": "政策/地区/专业边界"
    }
  ],
  "hot_take_chain": {
    "facts": "关键事实",
    "controversy": "争议点",
    "my_judgment": "作者判断",
    "counterpoint": "反方可能对在哪里",
    "ordinary_action": "普通人下一步动作",
    "uncertainty": "哪些只是推测"
  },
  "data_cards": [
    {
      "number": "关键数字",
      "comparison": "和什么对比",
      "affected_people": "影响谁",
      "misread": "容易怎么误读",
      "use": "普通人怎么用"
    }
  ],
  "comparison_cards": [
    {
      "wrong_way": "常见错误做法",
      "why_wrong": "为什么错",
      "better_way": "更好做法",
      "example": "示例",
      "boundary": "适用边界"
    }
  ]
}
```

任何正文如果无法追溯到以上字段，判为无依据写作。

## 第二铁律：虚拟人物必须有原型材料

可以把真实案例改写成虚拟人物，但不能凭空编故事。

合格的虚拟人物必须来自：

- 用户自己的真实经历。
- 公开报道中的多个相似案例。
- 评论区、论坛、问答平台中可归纳的真实困境。
- 官方案例、法院案例、政策问答或办事指南中的典型情境。

虚拟化时要做到：

- 改姓名、城市、公司、时间等识别信息。
- 保留真实困境、选择、代价和操作路径。
- 不添加原材料没有的收入、家庭、疾病、裁员、offer、公司细节。
- 在资料包里记录“原型来源”和“虚构处理边界”。

## 第三铁律：解决方案必须能执行

任何“建议”都必须写成操作。

最少交付：

- 适用对象：谁能用，谁不能用。
- 触发场景：什么时候该做。
- 操作路径：去哪里，点什么，准备什么材料，按什么顺序。
- 判断标准：做完后怎么看是否有效。
- 常见坑：哪里容易误解、过期、地区差异、资格不符。
- 风险边界：哪些属于法律/财务/医疗/政策咨询，必须回到官方或专业渠道。

只写“调整心态、提升能力、主动沟通、学会复盘”这类句子，判为空话。

## 第四铁律：热点必须有自己的判断链

热点稿不能复述新闻。

必须回答：

- 这件事的关键事实是什么。
- 它和普通人有什么关系。
- 我同意什么，反对什么，担心什么。
- 这件事可能往哪里走。
- 我从中学到什么，下一次会怎么做。
- 哪些判断只是推测，不能写死。

如果没有个人判断链，只能做资料摘要，不能写观点文章。

## 第五铁律：结构来自材料，不来自模板

文章结构必须从材料里长出来。

常用结构：

- 故事型：场景 -> 冲突 -> 选择 -> 代价 -> 方法 -> 边界。
- 办事型：问题 -> 条件 -> 入口 -> 材料 -> 顺序 -> 坑点 -> 复查。
- 热点型：事实 -> 争议 -> 我的判断 -> 反方可能对 -> 普通人动作。
- 数据型：数字 -> 对比 -> 影响的人 -> 错误解读 -> 正确用法。
- 对照型：错误做法 -> 为什么错 -> 更好做法 -> 示例 -> 适用边界。

不得默认使用“背景、原因、方法、总结”的安全结构。

## 第六铁律：每 300 字必须有信息增量

任意连续 300 字里，至少出现一类新信息：

- 新事实、数字、来源或时间点。
- 新场景、新人物动作或具体代价。
- 新步骤、新材料、新入口或新判断标准。
- 新反例、新边界或新坑点。
- 新观点、新推论或新反方。

连续 300 字只是在解释同一个判断，判为空稿。

## 第七铁律：可读性服务信息密度

线上读者会扫描，所以排版要让信息露出来：

- 小标题必须是信息，不是情绪口号。
- 列表必须承载步骤、条件、材料或坑点，不做装饰。
- 加粗只加关键判断、操作入口、风险边界。
- 结尾问题要能引出案例、纠错或补充，不要客服腔。

## 第八铁律：真实性高于爽感

不得为了故事性、共鸣、爆款、AI 检测或评论率牺牲事实。

- 不编采访。
- 不编经历。
- 不编数据。
- 不编政策口径。
- 不把单个网友故事写成普遍事实。
- 不把未经核验的做法写成可执行建议。

宁可文章慢一点，也不能用顺滑感替代核验。

## 写作前停机条件

命中以下任一条件，停止写作，只输出“待补素材清单”：

- 资料包只有链接和摘要，没有 `material_modes`。
- 虚拟人物没有原型来源。
- 办事建议没有入口、材料、顺序和坑点。
- 干货清单不能让读者今天照着做。
- 热点观点没有反方边界。
- 数据没有对比和误读提醒。
- 连续 300 字只能看见观点，看不见事实、动作、步骤或代价。
