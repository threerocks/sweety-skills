---
name: sweety-image-reprocess
description: 对已生成的图片做像素层重处理（注入真实高斯噪声、非均匀锐化、非整数重采样、JPEG 重编码、抹元数据），扰乱扩散/GAN 模型在频域与噪声层留下的统计指纹，降低"半真实"内容被 AI 检测器误判的概率。适用于"图片重处理""去 AI 频域指纹""降低 AI 检测概率""real grain/翻拍替代""图片重压破指纹"等请求。本 skill 只处理像素，不写提示词、不改提示词层 AI 味。
version: 0.1.0
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-image-reprocess
    requires:
      anyBins:
        - bun
        - npx
---

# 图片像素层重处理

把一张已有图片（通常是 AI 生成图）的**像素本身**重处理一遍，覆盖掉生成模型留下的、人眼看不见但检测器敏感的统计指纹：频域周期峰、合成噪声分布、纹理过度规整。

## 这个 skill 解决什么 / 不解决什么

| ✅ 能处理（低层像素指纹） | ❌ 不能处理（必须在选图阶段解决） |
|---|---|
| 频域/上采样网格伪影 | 手指数量、牙齿、首饰对称错误 |
| 合成噪声分布异常 | 反光、阴影、物理逻辑破绽 |
| 纹理过度平滑/规整 | 背景语义不合理 |

**铁律：先选语义干净的图，再跑本 skill。** 重处理一张"六根手指"的图，只会得到一张"高清真实噪声的六根手指图"——低层骗过、高层照样露馅。

## 使用边界

- 仅用于提升原创/半原创视觉内容的发布稳健性，**不用于**伪造新闻、身份、医疗、证据类图片，或任何欺骗性纪实用途。
- 若用户意图是"让人误信这是真人拍摄以行骗"，改为建议透明标注（符合生成式 AI 内容标识规定）+ 内容质量提升。
- 重处理 ≠ 永久免疫。检测器与生成器是军备竞赛，任何处理都有半衰期；本 skill 是降低误判概率，不承诺"过检测"。

## 工作流

1. **确认意图与合规**：确认是发布稳健性需求而非欺骗用途；提醒平台 AI 标识规定。
2. **先验语义**：让用户确认图片无语义级破绽（手/眼/反光/背景）。有破绽 → 回去重选图，本 skill 不补救。
3. **选强度**：
   - `light`：日常配图、本就接近真实的图。轻噪声 + 96% 重采样 + Q88。
   - `medium`（默认）：标准 AI 图发布前处理。
   - `strong`：检测压力大、可接受画质轻微下降时。
4. **运行脚本**（见下）。
5. **告知用户后续链路**：
   - 元数据进一步真实化 → `sweety-image-privacy`（注入类 iPhone EXIF）。
   - 生图阶段就去 AI 味 → `sweety-image-naturalizer`（提示词层）。
   - **最强手段仍是物理翻拍/拍屏**：本 skill 是软件替代，效果弱于真实相机重采集。

## Script Directory

**Important**: All scripts are located in the `scripts/` subdirectory of this skill.

**Agent Execution Instructions**:
1. Determine this SKILL.md file's directory path as `{baseDir}`
2. Script path = `{baseDir}/scripts/main.ts`
3. Resolve `${BUN_X}` runtime: if `bun` installed → `bun`; if `npx` available → `npx -y bun`; else suggest installing bun
4. Replace all `{baseDir}` and `${BUN_X}` in this document with actual values

**Script Reference**:
| Script | Purpose |
|--------|---------|
| `scripts/main.ts` | 重处理链 CLI 入口 |

### 运行

```bash
${BUN_X} {baseDir}/scripts/main.ts <输入图> [-o 输出图] [--intensity light|medium|strong] [--keep-metadata] [--json]
```

示例：

```bash
# 默认 medium，输出 <name>.reprocessed.jpg
${BUN_X} {baseDir}/scripts/main.ts portrait.png

# 强处理 + 指定输出
${BUN_X} {baseDir}/scripts/main.ts portrait.png -o out.jpg --intensity strong
```

### 引擎

| 引擎 | 能力 | 说明 |
|------|------|------|
| **ImageMagick**（首选，`magick`/`convert`） | 全链路：高斯噪声 + 锐化 + 重采样 + JPEG + strip | `brew install imagemagick` |
| **sips**（macOS 自带，降级） | 仅重采样 + JPEG 重压 + 抹元数据 | **无法加噪声**，频域去除弱，会明确告警 |

脚本自动检测；若只有 sips，会处理但打印降级告警，建议安装 ImageMagick 后重跑。

## 重处理链原理（每步对应一类指纹）

| 步骤 | 操作 | 打击的指纹 |
|------|------|-----------|
| 1 | 注入真实高斯噪声 | 覆盖扩散模型的合成噪声分布 |
| 2 | 非均匀锐化 | 破坏纹理全局规整性 |
| 3 | 非整数重采样（如 92%） | 位移上采样网格在频谱的周期峰 |
| 4 | 抹元数据 | 去掉生成工具标识 |
| 5 | JPEG 重编码（中质量） | 块状量化进一步淹没高频指纹 |

顺序固定：**加噪 → 锐化 → 重采样 → 抹元数据 → 重压**，最后一步必须是有损压缩。
