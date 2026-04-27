---
name: font-dimension
description: 封面图字体风格维度
---

# 字体维度

控制字体风格和文字性格。

## 取值

| 字体 | 视觉风格 | 线条质感 | 性格 |
|------|----------|----------|------|
| `clean` | 几何无衬线 | 锐利、均匀 | 现代、精确、中性 |
| `handwritten` | 手写、毛笔 | 有机、变化 | 温暖、个人、友好 |
| `serif` | 经典衬线、优雅 | 精致、结构化 | 编辑、权威 |
| `display` | 粗体、装饰性 | 厚重、表现力 | 吸着眼球、趣味 |

## 详情

### clean

现代、通用的字体，中性性格。

**特征**：
- 几何无衬线字形
- 锐利、均匀的线条粗细
- 干净边缘，无装饰
- 各尺寸下可读性高
- 最小个性，最大清晰度

**适用场景**：
- 技术文档
- 专业/企业内容
- 极简设计
- 数据驱动文章
- 现代品牌美学

**Prompt 提示**：
- Use clean geometric sans-serif typography
- Modern, minimal letterforms
- Sharp edges, uniform stroke weight
- High contrast against background

### handwritten

温暖、有机的字体，个人性格。

**特征**：
- 手写或毛笔风格
- 有机、变化的线条粗细
- 自然的不完美
- 亲切、人文感
- 休闲但有意图

**适用场景**：
- 个人故事
- 生活方式内容
- 健康与自我提升
- 创意教程
- 友好品牌声音

**Prompt 提示**：
- Use warm hand-lettered typography with organic brush strokes
- Friendly, personal feel
- Natural variation in stroke weight
- Approachable, human character

### serif

经典、优雅的字体，带有编辑权威感。

**特征**：
- 传统衬线字形
- 精致、结构化笔触
- 优雅的比例
- 永恒的精致感
- 正式、值得信赖

**适用场景**：
- 编辑内容
- 学术文章
- 奢侈品牌内容
- 历史题材
- 文学作品

**Prompt 提示**：
- Use elegant serif typography with refined letterforms
- Classic, editorial character
- Structured, proportional spacing
- Authoritative, sophisticated feel

### display

粗体、装饰性字体，最大化视觉冲击。

**特征**：
- 厚重、表现力强的字形
- 装饰性元素
- 强烈视觉存在感
- 趣味或戏剧性性格
- 专为标题设计

**适用场景**：
- 公告
- 娱乐内容
- 推广材料
- 活动营销
- 游戏题材

**Prompt 提示**：
- Use bold decorative display typography
- Heavy, expressive headlines
- Strong visual impact
- Attention-grabbing character

## 默认值

`clean` — 通用，与大多数渲染风格搭配良好。

## 渲染风格兼容性

| 字体 × 渲染 | flat-vector | hand-drawn | painterly | digital | pixel | chalk | screen-print |
|--------------|:-----------:|:----------:|:---------:|:-------:|:-----:|:-----:|:------------:|
| clean | ✓✓ | ✗ | ✗ | ✓✓ | ✓ | ✗ | ✓ |
| handwritten | ✓ | ✓✓ | ✓✓ | ✓ | ✗ | ✓✓ | ✗ |
| serif | ✓ | ✗ | ✓ | ✓✓ | ✗ | ✗ | ✓ |
| display | ✓✓ | ✓ | ✓ | ✓✓ | ✓✓ | ✓ | ✓✓ |

✓✓ = 强烈推荐 | ✓ = 兼容 | ✗ = 不推荐

## 类型兼容性

| 字体 × 类型 | hero | conceptual | typography | metaphor | scene | minimal |
|--------------|:----:|:----------:|:----------:|:--------:|:-----:|:-------:|
| clean | ✓ | ✓✓ | ✓✓ | ✓ | ✗ | ✓✓ |
| handwritten | ✓✓ | ✓ | ✓ | ✓✓ | ✓✓ | ✓ |
| serif | ✓ | ✓ | ✓✓ | ✓ | ✓ | ✓ |
| display | ✓✓ | ✓ | ✓✓ | ✓ | ✓ | ✗ |

## 配色交互

字体风格根据配色特征调整：

| 配色类别 | clean | handwritten | serif | display |
|----------|-------|-------------|-------|--------|
| 暖色系 (warm, earth, pastel) | 柔和字重 | 自然契合 | 温暖色调 | 趣味活力 |
| 冷色系 (cool, mono, elegant) | 完美搭配 | 对比效果 | 经典配对 | 大胆声明 |
| 暗色系 (dark, vivid) | 高对比 | 发光效果 | 戏剧性 | 最大冲击 |
| 复古系 (retro) | 现代对比 | 怀旧感 | 年代感 | 复古标题 |
| 双色系 (duotone) | 锐利对比 | 不推荐 | 戏剧性配对 | 电影感冲击 |

## 自动选择

未指定 `--font` 时，根据内容信号选择：

| 内容信号 | 字体 |
|----------|------|
| 个人、生活方式、人文、温暖、友好、故事 | `handwritten` |
| 技术、专业、简洁、现代、极简、数据 | `clean` |
| 编辑、学术、奢华、经典、文学 | `serif` |
| 公告、娱乐、促销、大胆、活动、游戏 | `display` |

默认：`clean`
