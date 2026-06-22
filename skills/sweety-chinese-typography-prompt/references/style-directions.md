# Style Directions

Source: `https://x.com/AdrianPunk115/status/2056655062865490112`

The source argues that weak Chinese typography image prompts usually fail because they only ask the model to "generate several words" or use vague adjectives such as "good-looking", "premium", or "designed". A usable prompt should describe the typography as a design object: font category, stroke behavior, structure, weight, edges, material, lighting, background, and mood.

Base formula:

```text
"text content", font type, stroke / structure / center of gravity / edge description; add effects / material / lighting / background, overall mood.
```

## Direction Map

Use these as starting points, then make the description specific to the actual image.

| Group | Directions | Typical use |
|------|------------|-------------|
| Fashion / brand | 潮流品牌字、高级杂志字、都市潮流字、先锋设计字、极简品牌字 | fashion, personal brand, modern cover |
| Knowledge / business | 现代知识字、高级知识字、深度专栏字、商业衬线体、模块课程标题体 | courses, reports, analysis, professional content |
| Light / lifestyle | 清爽留白体、轻奢细线字、温柔细线字、女性美学字、成长笔记字 | lifestyle, Xiaohongshu, gentle covers |
| Line / single stroke | 连续线稿体、草图单线体、科技线框字、优雅单线字 | minimal, design draft, tech line art |
| Serif / editorial | 杂志衬线体、现代衬线体、轻奢衬线体、专栏衬线体 | editorial, luxury, finance, column title |
| Handwriting | 清新手迹字、成长笔记字、个人签名字、情绪手写字 | personal notes, diary, creator identity |
| Curved / soft | 柔和曲线字、音乐律动字、艺术曲线字、奶油甜品体 | soft, music, dessert, playful brand |
| Illustrated / childlike | 轮廓手绘体、插画装饰体、粗描海报体、童趣涂画体、儿童绘本蜡笔体、积木拼装标题体、零食包装跳跳体、手剪纸片拼贴体 | children, storybook, handcraft, illustration |
| Street / graffiti | 街头涂鸦字、手写标语涂鸦体、泡泡潮牌涂鸦体、爆裂摇滚涂鸦体 | youth, street, music, rebellious posters |
| Experimental / impact | 抽象构成体、展览海报体、概念实验体、创作者爆发体、强冲击夸张体、爆款封面体、强观点夸张体 | art, creator, strong opinion, cover hooks |
| Tech / cyber | 科技标题体、液态未来体、虚拟空间体、赛博断裂体、几何科技体、未来细线体 | AI, workflow, digital product, cyberpunk |
| Funny / entertainment | 趣味标题体、搞笑封面体、表情包夸张体、气球童趣体 | memes, entertainment, playful thumbnails |
| Pixel / game | 复古像素体、街机游戏体、像素故障体、方块模块体 | games, retro screens, pixel systems |
| Retro / street shop | 老电影字幕体、港式旧招牌体、复古广告字、怀旧出版体、城市霓虹门店字、夜市菜单牌字体、便利店马克笔标签体、电商促销字 | retro, local shop, food, commerce |
| Gothic / dark | 哥特风格字体、黑金属尖刺体、华丽哥特装饰体 | fantasy, dark, metal, gothic |
| Calligraphy / eastern | 报头题字毛笔体、狂草书法体、行书体、禅意题字体、东方瘦金标题体、国风牌匾体、潮流篆意体、东方海报体 | Chinese culture, authority, tea, guofeng |
| Western / road | 西部牛仔标题体、美式公路字体、荒野通缉令标题体、机车西部体 | western, road trip, biker, wanted poster |

## Prompt Fragments

Use fragments like these instead of vague adjectives:

- 字形方正厚重，笔画粗细统一，结构紧密稳定，字距克制。
- 字形修长高挑，横画短而克制，竖画细长挺拔，收笔精致干净。
- 笔画由细直线和几何折线组成，横竖转角清晰，局部有节点式连接感。
- 笔画带真实手写停顿、拖拽和急停痕迹，结构清楚但不完全工整。
- 边缘有喷漆颗粒、飞溅、干刷断裂或旧印刷磨损。
- 字形由方块像素拼成，边缘呈阶梯状锯齿感。
- 字形带书法提按、转腕、连带、牵丝、飞白和断墨。
- 每个笔画像独立纸片贴上去，保留细小缝隙、翘边和纸纤维毛边。

## Readability Guard

Always add a Chinese readability guard for generated images:

```text
保持中文文字准确可读，不要乱码、不要多字、少字、错字、拼音替代或伪文字。
```
