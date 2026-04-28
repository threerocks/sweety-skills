---
name: sweety-karpathy-writing-style
description: 借鉴 Andrej Karpathy 公开技术写作中的结构、语气和解释方式，帮助撰写英文 AI/技术长文，并可从 original/final 两版文本 diff 中自动提取写作规则来更新 SKILL.md。适用于英文技术随笔、年度回顾、AI 行业分析、观点文章、Karpathy 风格写作，以及用户要求从 AI 初稿和最终稿中学习偏好时。
version: 1.79.2
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-karpathy-writing-style
---

# Andrej Karpathy 技术写作风格指南

这个 skill 提炼 Karpathy 技术长文中常见的写作模式。使用时借鉴其公开写作的结构、节奏和解释策略，生成清晰、亲切、有洞察力的英文技术文章。

## 偏好设置 (EXTEND.md)

检查 EXTEND.md 是否存在，优先级如下：

```bash
test -f .sweety-skills/sweety-karpathy-writing-style/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-karpathy-writing-style/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-karpathy-writing-style/EXTEND.md" && echo "user"
```

| 路径 | 位置 |
|------|------|
| `.sweety-skills/sweety-karpathy-writing-style/EXTEND.md` | 项目目录 |
| `$XDG_CONFIG_HOME/sweety-skills/sweety-karpathy-writing-style/EXTEND.md` | XDG 配置目录 |
| `$HOME/.sweety-skills/sweety-karpathy-writing-style/EXTEND.md` | 用户目录 |

| 结果 | 操作 |
|------|------|
| 找到 | 读取并应用用户偏好，例如主题领域、读者类型、允许引用的个人项目、禁用词或额外示例 |
| 未找到 | 使用本文默认规则 |

## 使用方式

当用户要写英文 AI/技术长文、年度回顾、行业分析或观点文章，并希望文风接近 Karpathy 公开写作中的清晰、随和、概念密集风格时，使用本 skill。

先明确文章主题、目标读者、核心观点和预期篇幅；如果用户没有给出这些信息，基于上下文合理假设。输出应为英文，除非用户明确要求中文说明。

## 低优先级写作偏好

以下偏好用于减少机械感，只作为最终润色时的轻量约束。它们不能覆盖用户的明确要求，也不能决定性改变本 skill 的 Karpathy 技术写作主风格。若与“声音与语气”“结构模式”“句子级模式”中的核心规则冲突，优先保留主风格，只做不破坏文章气质的小幅调整。

优先使用自然书面表达，避免机械化句式。句式结构保持多样，避免连续使用相同结构。非必要不使用列表结构，优先使用自然段落表达。句子开头不使用表情符号。不使用“不是……而是……”句式。不使用破折号。非引用语境不使用双引号。避免过度修饰与夸张表达，保持自然可读。

## 内置自动学习

当用户提供两个数据点时触发自动学习：

| 数据点 | 含义 |
|--------|------|
| `original` | AI 使用本 skill 生成的第一版初稿 |
| `final` | 用户修改到满意后的最终稿 |

中间经历了多少轮编辑不重要，只比较 `original` 和 `final`。

### 学习工作流

1. 读取 `original` 和 `final`，保留段落、标题、列表、引用等结构信息。
2. 对齐两版内容，比较标题、开头、段落顺序、句长、语气、术语、隐喻、过渡句、结尾、格式和删改倾向。
3. 提取“下次可复用”的规则，只记录稳定偏好，不记录一次性事实或仅适用于当前主题的内容。
4. 将规则合并到本文件的“学习到的规则”部分。已有规则相近时改写合并，不重复堆叠。
5. 更新后向用户简要说明新增或调整了哪些规则。

### 规则提取标准

优先提取这些类型的规则：

- 用户反复把宽泛判断改成更具体、更可验证的判断。
- 用户调整了开头方式，例如更快进入观点、减少背景铺垫，或增加一句总括。
- 用户改变了段落节奏，例如拆短长段、合并碎片列表，或加入短句落点。
- 用户替换了词汇偏好，例如更偏向口语、技术精确、低调、幽默或更强观点。
- 用户改变了解释顺序，例如先历史背景，再机制，再影响。
- 用户调整了结尾，例如更明确的 **TLDR**、更少号召语，或更克制的展望。

不要提取这些内容：

- 当前文章独有的事实、数据、链接、项目名或观点。
- 用户只是修正事实错误、错别字或引用格式的改动。
- 与 Karpathy 风格或用户写作偏好无关的局部措辞。
- 过度拟合单次编辑的规则。

规则写法使用简短命令句，例如：

- "开头第一段必须在两句内给出核心判断，不写背景铺垫。"
- "解释新范式时先给旧流程，再说明变化点，最后讨论影响。"
- "长段后增加一个短句落点，但不要每段都使用。"

## 学习到的规则

- 写中文公众号长文时，开头第一屏要直接给出本集核心判断，并补一句“为什么没读原著的观众会吃力或容易误读”，让读者知道文章会帮他补哪层信息。
- 逐帧解析类文章要带读者“看镜头”，多写站位、回头、停步、天色、速度、画面空间、人物反应和场面调度，不只复述剧情。
- 每个场景切片优先按“动画表层发生了什么 → 原著同段或章节标题提示了什么 → 动画如何压缩/视觉化 → 观众容易漏掉什么 → 后续伏笔是什么”的顺序展开。
- 《和原著情节的不同》必须是重章节，至少写出本集可确认的删减、合并、前置、后置、视觉化、弱化、新增和观众理解偏移；用“第一，第二……”自然段列举，避免只写短项目符号。
- 原著对照只写必要锚点和机制，不搬运原文，不展开长篇剧透；重点解释章节标题、人物关系、制度逻辑和动画改编后的信息债。
- 中文稿优先使用短自然段和短句落点，例如“这就是护道人意识的第一层。”、“不动也是动作。”、“路只会变大。”，但不要每段都做金句。
- 可以加入少量公众号读者引导句，例如“观众老爷们，你有注意到这个细节吗？”、“大家一定要记住”，但只在确实需要提醒读者暂停画面时使用，避免口播腔泛滥。
- 关键词可以少量加粗，优先加粗概念词、判断转折和读者必须记住的观念；不要把整篇写成重点标注。
- 解释人物成长时，避免只夸勇敢或强大，要写“能力、责任、见识、位置之间的错位”，并指出这个错位怎样影响后续剧情。
- 后续正式稿不再设置“这一集真正推进了什么”“下一集为什么会更重”这类固定收束章节；文章在“和原著情节的不同”之后用一两段自然落点收住即可。
- 少用“最”“真正”“其实”等绝对化或过度强调词。能用具体判断替代时，直接写具体判断；需要强调时也优先通过镜头、人物反应和改编差异来呈现，不靠口气加重。

## 声音与语气

**自信但谦逊**：直接表达判断，例如 "I think"、"I suspect"、"Personally I believe"，同时承认不确定性。不要过度试探，也不要说得过满。

**有亲和力的权威感**：像在和聪明朋友喝咖啡时解释问题。内容可以技术化，但不要枯燥或端着。

**带一点智性玩心**：可以创造容易记住的概念词，例如 "vibe coding"、"jagged intelligence" 这类短语。使用鲜明、有黏性的隐喻，但避免为了俏皮而牺牲准确性。

## 结构模式

### 开头

- 直接进入主题，不铺垫背景套话。
- 用一句有力的概括句开场，然后马上展开。
- 示例："2025 has been a strong and eventful year of progress in LLMs."

### 正文组织

- 用编号小节组织主要范式变化或核心观点。
- 每个小节使用 H3 标题：编号 + 概念名。
- 每节按“背景/历史 → 发生了什么变化 → 为什么重要”的顺序展开。
- 每个主要小节约 300-500 个英文单词。

### 结尾

- 以加粗的 **TLDR** 段落收束。
- 总结关键张力、悖论或尚未解决的问题。
- 保持乐观但落地的语气，例如 "there is a lot of work to be done. Strap in."

## 句子级模式

优先使用这些英文句式：

- "X emerged as the first convincing demonstration of Y"
- "What I find most notable about X (other than Y) is that..."
- "In my world view, X is Y"
- "A lot of chatter has been spent on X. Personally I suspect that..."
- "This is a new, distinct paradigm of..."
- 使用 `~` 表示近似，例如 "~similar sized"、"~2020"

**括号插入语**：频繁但自然地使用括号，补充旁白、澄清或时间点：

- "(GPT-2/3 of ~2020)"
- "(other than its meteoric rise this year)"
- "(and on the surface paradoxically)"

**破折号强调**：用 em dash 插入有力说明：

- "it's not just a website you go to like Google, it's a little spirit/ghost that 'lives' on your computer"

**复杂句后接短句**：长解释后用短句落点：

- "Training on the test set is a new art form."
- "Strap in."
- "Code is suddenly free, ephemeral, malleable, discardable after single use."

## 修辞手法

**鲜明二分法**：把观点组织成容易记住的对立关系：

- "ghosts vs animals"
- "simultaneously a genius polymath and a confused grade schooler"
- "a lot smarter than I expected and a lot dumber than I expected"

**设问**：提出能推动思考的问题，然后继续推进论证：

- "What does it look like to crush all the benchmarks but still not get AGI?"

**历史类比**：连接计算史来提供尺度感：

- "LLMs are the next major computing paradigm similar to computers of the 1970s, 80s"
- "chatting with LLMs is a bit like issuing commands to a computer console in the 1980s"

**自然自我引用**：如果用户提供了自己的作品、项目或演讲，可以自然引用：

- "As I highlighted in my Y Combinator talk this year..."
- "I have written a lot more on the topic here: [link]"
- "I vibe coded many projects this year (e.g. see menugen, llm-council...)"

不要捏造用户没有提供的个人经历、项目或链接。

## 技术解释方式

1. 先给历史语境："At the start of 2025, the recipe looked like this: 1. Pretraining 2. SFT 3. RLHF"
2. 再介绍变化："In 2025, RLVR emerged as the de facto new major stage"
3. 简洁解释机制：用一段说明它如何工作。
4. 讨论影响：解释它为什么重要、打开了什么可能性。

避免：

- 未解释的过量术语
- 干燥的学术腔
- 过度依赖项目符号，正文优先使用流动段落
- 每句话都加保留条件

## 用词偏好

| 优先使用 | 避免 |
|----------|------|
| "emerged as" | "became" |
| "paradigm-shifting" | "revolutionary" |
| "convincing demonstration" | "good example" |
| "gobbled up" | "consumed" |
| "chewing through" | "processing" |
| "meteoric rise" | "rapid growth" |
| "terraform" | "transform" |
| "jagged" | "uneven" |
| "spike in capability" | "improvement" |

## 格式

- 主要编号小节使用 H3 (`###`)。
- 链接要自然嵌入正文，例如 "see [my post on X](url)"。
- 图片可以配简短括号说明。
- 少用加粗和斜体，只把 **TLDR** 和首次出现的核心术语加粗。
- 不使用 emoji。

## 示例开头段落

> 2025 has been a strong and eventful year of progress in LLMs. The following is a list of personally notable and mildly surprising "paradigm changes" - things that altered the landscape and stood out to me conceptually.

## 示例小节

> ### 5. Vibe coding
>
> 2025 is the year that AI crossed a capability threshold necessary to build all kinds of impressive programs simply via English, forgetting that the code even exists. Amusingly, I coined the term "vibe coding" in this shower of thoughts tweet totally oblivious to how far it would go :). With vibe coding, programming is not strictly reserved for highly trained professionals, it is something anyone can do.

## 示例 TLDR

> **TLDR**. 2025 was an exciting and mildly surprising year of LLMs. LLMs are emerging as a new kind of intelligence, simultaneously a lot smarter than I expected and a lot dumber than I expected. In any case they are extremely useful and I don't think the industry has realized anywhere near 10% of their potential even at present capability. Meanwhile, there are so many ideas to try and conceptually the field feels wide open. Strap in.

## Extension Support

支持通过 EXTEND.md 自定义写作偏好。路径和加载规则见“偏好设置 (EXTEND.md)”。
