# 风格预设

`--style X` 展开为配色 + 渲染组合。用户可以覆盖任一维度。

| --style | 配色 | 渲染风格 |
|---------|---------|-----------|
| `elegant` | `elegant` | `hand-drawn` |
| `blueprint` | `cool` | `digital` |
| `chalkboard` | `dark` | `chalk` |
| `dark-atmospheric` | `dark` | `digital` |
| `editorial-infographic` | `cool` | `digital` |
| `fantasy-animation` | `pastel` | `painterly` |
| `flat-doodle` | `pastel` | `flat-vector` |
| `intuition-machine` | `retro` | `digital` |
| `minimal` | `mono` | `flat-vector` |
| `nature` | `earth` | `hand-drawn` |
| `notion` | `mono` | `digital` |
| `pixel-art` | `vivid` | `pixel` |
| `playful` | `pastel` | `hand-drawn` |
| `retro` | `retro` | `digital` |
| `sketch-notes` | `warm` | `hand-drawn` |
| `vector-illustration` | `retro` | `flat-vector` |
| `vintage` | `retro` | `hand-drawn` |
| `warm` | `warm` | `hand-drawn` |
| `warm-flat` | `warm` | `flat-vector` |
| `watercolor` | `earth` | `painterly` |
| `poster-art` | `retro` | `screen-print` |
| `mondo` | `mono` | `screen-print` |
| `art-deco` | `elegant` | `screen-print` |
| `propaganda` | `vivid` | `screen-print` |
| `cinematic` | `duotone` | `screen-print` |

## 覆盖示例

- `--style blueprint --rendering hand-drawn` = cool 配色 + hand-drawn 渲染
- `--style elegant --palette warm` = warm 配色 + hand-drawn 渲染

显式 `--palette`/`--rendering` 参数始终覆盖预设值。
