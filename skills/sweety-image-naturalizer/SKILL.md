---
name: sweety-image-naturalizer
description: 为生图任务去除 AI 味，将用户的图像需求改写成更自然、更可信、更少 AI 模板感的视觉创作 brief 和生成提示词。适用于“生图去除AI味”“图片去 AI 味”“写真实感图片提示词”“Pinterest/VHTC 风格图像 brief”“让 AI 图像更像人工策划/拍摄/图解”等请求。
version: 1.79.2
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-image-naturalizer
---

# 生图去除AI味

这个 skill 用于在生图前把图片需求写成更像真人编辑、摄影师、设计师或教育图解作者会给出的视觉 brief。目标不是隐藏来源，而是减少模板化 AI 视觉：过度完美、蜡质皮肤、失真的解剖和物理、空泛高级感、无上下文装饰、文字和物体功能错误。

## 偏好设置 (EXTEND.md)

检查 EXTEND.md 是否存在，优先级如下：

```bash
test -f .sweety-skills/sweety-image-naturalizer/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-image-naturalizer/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-image-naturalizer/EXTEND.md" && echo "user"
```

| 路径 | 位置 |
|------|------|
| `.sweety-skills/sweety-image-naturalizer/EXTEND.md` | 项目目录 |
| `$XDG_CONFIG_HOME/sweety-skills/sweety-image-naturalizer/EXTEND.md` | XDG 配置目录 |
| `$HOME/.sweety-skills/sweety-image-naturalizer/EXTEND.md` | 用户目录 |

| 结果 | 操作 |
|------|------|
| 找到 | 读取并应用用户偏好，例如默认平台、构图比例、禁用风格词、常用品牌语气、输出语言 |
| 未找到 | 使用本文默认规则 |

## 使用边界

- 只帮助提升原创视觉质量、信息表达和真实感，不帮助伪造新闻证据、身份证明、医疗诊断图、违法宣传或误导性纪实图片。
- 如果用户要求“让别人看不出是 AI 生成”且语境可能用于欺骗，改为提供透明标注、创作质量提升和事实校验建议。
- 若最终交付物是 PNG/JPG/WebP 等静态位图，默认配合图像生成 skill；本 skill 负责写作 brief，不直接替代生成步骤。

## 工作流

1. **确认交付物**
   - 明确图片类型：封面、配图、海报、信息图、教育图解、社媒图、产品图、人物照、场景照。
   - 明确平台和比例：公众号、Pinterest、X、小红书、网页、幻灯片、打印。
   - 若交付物类型不明确，先询问用户，不把静态图任务改成网页、SVG、Canvas 或截图合成。

2. **拆解真实世界约束**
   - 写清主体是什么、在哪里、谁在看、用于什么场景。
   - 为画面加入可验证的物理约束：光源方向、阴影、镜头高度、焦距感、材质、尺度关系、遮挡关系。
   - 为人物或动物加入解剖约束：手指数量、关节姿态、眼睛焦点、牙齿、头颈比例、肢体与衣物/物体的接触方式。
   - 为物件加入功能约束：按钮、背包带、餐具、衣扣、标牌、工具、医学标注必须符合用途。

3. **选择风格母体**
   - Pinterest 式：用于情绪板、封面、生活方式、灵感收藏、强视觉第一眼。读 [references/style-system.md](references/style-system.md) 的 Pinterest 部分。
   - VHTC 式：用于医学、解剖、学习卡、考试资料、结构化知识图。读 [references/style-system.md](references/style-system.md) 的 VHTC 部分。
   - 若用户给了参考图或站点，先从参考中抽取“布局、信息密度、标注方式、色彩、材质、观看距离”，不要只模仿表层配色。

4. **写出生成 brief**
   输出优先使用这个结构：

```markdown
## 视觉目标
一句话说明这张图要让观众立刻看懂什么。

## 画面设定
主体、环境、时间、光线、镜头、比例、材质和必要的不完美细节。

## 信息结构
标题、标签、标注线、分区、重点层级、留白和阅读路径。

## 去 AI 味约束
解剖、物理、功能、社会文化、文字可读性、背景一致性。

## 生成提示词
可直接交给图像模型的提示词。

## 负面约束
避免项，写具体问题，不堆泛词。
```

5. **做去 AI 味检查**
   - 生成前，用 [references/de-ai-image-checklist.md](references/de-ai-image-checklist.md) 检查 brief。
   - 检查不通过时，先修 brief，再生成；不要靠“更高清”“更真实”“大师级”等空泛词补救。

## 写作原则

- 用具体场景替代抽象审美词。例如不写“高级、真实、电影感”，改写成“下午 4 点窗边侧光，墙面有柔和反射，桌面边缘有轻微磨损”。
- 用有目的的不完美替代随机噪声。例如“纸张边缘轻微卷曲、手写标注有微小笔压差异”，不要写“随机瑕疵很多”。
- 用编辑判断替代模型口号。说明为什么这样构图、为什么保留某个空白、为什么某处不需要装饰。
- 避免连续堆叠流行 AI 词：ultra realistic、8k、cinematic、award-winning、hyper detailed、masterpiece、dramatic lighting。
- 对中文图像文字保持克制。需要可读文字时，优先少字、大字号、明确层级；复杂说明放在图外正文。

## 输出要求

- 默认输出简体中文。
- 如果用户只要提示词，输出“生成提示词”和“负面约束”两段即可。
- 如果用户要完整方案，输出完整 brief，并附一段“检查结果”说明已处理哪些 AI 味风险。
- 不输出长篇来源综述；需要依据时，简短说明使用了哪些参考原则。

## Extension Support

Custom configurations via EXTEND.md. See **偏好设置 (EXTEND.md)** for paths and supported options.
