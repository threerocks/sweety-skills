---
name: sweety-negative-short-tweet
description: 生产负能量短推候选。用于用户要写中文 X/Twitter 短推、反鸡汤、冷幽默、自嘲、职场/生活/关系/成长焦虑类短句，或要求“负能量短推”“丧一点”“毒舌但别低级”“没灵感给几个方向”时；根据人设、用户输入、日期/天气/热点/记忆选择 3 个合适方向产出候选，并做平台风险与可信度过滤。
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-negative-short-tweet
---

# 生产负能量短推

这个 skill 用于生成中文短推候选。目标不是输出攻击性语录，而是把“反鸡汤、冷幽默、现实感、自嘲”转成可发布前再挑选的候选池。

## 偏好设置 (EXTEND.md)

先检查 EXTEND.md，优先级如下：

```bash
test -f .sweety-skills/sweety-negative-short-tweet/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-negative-short-tweet/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-negative-short-tweet/EXTEND.md" && echo "user"
```

| 路径 | 位置 |
|------|------|
| `.sweety-skills/sweety-negative-short-tweet/EXTEND.md` | 项目目录 |
| `$XDG_CONFIG_HOME/sweety-skills/sweety-negative-short-tweet/EXTEND.md` | XDG 配置目录 |
| `$HOME/.sweety-skills/sweety-negative-short-tweet/EXTEND.md` | 用户目录 |

| 结果 | 操作 |
|------|------|
| 找到 | 读取并应用人设、禁用话题、常用平台、语气强度、长度、输出数量 |
| 未找到 | 使用本文默认规则 |

## 工作流

1. **读取输入**
   - 提取主题、平台、目标读者、人设、语气强度、禁用话题、是否需要跟热点。
   - 如果用户没有输入主题，使用当天日期、节气/工作日、天气、可用记忆、近期热点作为素材来源。
   - 近期热点必须联网核验；天气必须用可用天气工具查询。无法联网或查询时，明确说明并改用日期、工作日、通用生活场景和用户记忆。

2. **建立人设**
   - 优先使用用户明确给出的人设。
   - 其次使用当前项目、对话或记忆里的稳定偏好。
   - 都没有时，默认人设为：克制、冷幽默、现实主义、自嘲多于骂人，像一个观察生活的人，不像营销号。

3. **选择 3 个方向**
   - 从 [references/direction-bank.md](references/direction-bank.md) 选择 3 个最贴合的方向。
   - 每个方向必须说明选择理由，理由要连接“人设 + 输入主题 + 当前语境”。
   - 不要从同一方向里硬凑 3 组，宁可选择冲突感更强、生活感更具体的方向。

4. **生成短推候选**
   - 每个方向输出 3-5 条候选。
   - 单条默认 20-90 个中文字符，最多不超过 140 个中文字符；需要英文或 X 字符限制时再单独适配。
   - 句子要短、准、带反转；少用解释性长句。
   - 多写具体场景：周一、下雨、工资、会议、地铁、朋友圈、热搜、体检、睡前、月底、节后、年中等。

5. **风险过滤**
   - 不攻击真实个人，不做人肉、造谣或事实指控。
   - 不攻击受保护属性或群体，包括种族、国籍、性别、性取向、宗教、残障、疾病等。
   - 不输出外貌羞辱、贫穷羞辱、学历羞辱、地域羞辱、性羞辱。
   - 不鼓励自伤、自杀、厌世行动；涉及心理低谷时改成“情绪观察”和“自嘲”，必要时建议暂停发布。
   - 不把热点谣言、未核实传闻、政治风险话题包装成确定结论。
   - 不做“转发/评论/点赞/不看不是人”等互动绑架。

## 方向选择原则

优先选择能让读者觉得“这话有点难听，但像真的”的方向：

- 现实反转优于纯辱骂。
- 自嘲优于攻击别人。
- 具体场景优于抽象人生道理。
- 小痛点优于宏大批判。
- 可共鸣的尴尬优于平台高风险的仇恨。

如果用户要求“狠一点”，可以提高锋利度，但仍要把攻击对象转成现象、习惯、机制或第一人称自嘲。

## 输出模板

默认输出：

```markdown
## 方向 1：方向名
选择理由：...
1. ...
2. ...
3. ...

## 方向 2：方向名
选择理由：...
1. ...
2. ...
3. ...

## 方向 3：方向名
选择理由：...
1. ...
2. ...
3. ...

## 我建议优先发
...

## 风险处理
已避开：...
```

如果用户只要结果，不要分析，输出 3 个方向标题和候选即可，省略长解释。

## 可用素材

方向池见 [references/direction-bank.md](references/direction-bank.md)。需要写具体短推时读取该文件。

## Extension Support

Custom configurations via EXTEND.md. See **偏好设置 (EXTEND.md)** for paths and supported options.
