---
name: first-time-setup
description: sweety-post-to-wechat 首次偏好设置流程
---

# 首次设置

## 概述

当未找到 EXTEND.md 时，引导用户完成偏好设置。

**阻塞操作**：此设置流程必须在任何其他工作流步骤之前完成。不可以：
- 询问要发布的内容或文件
- 询问主题或发布方式
- 直接进入内容转换或发布流程

只能按此设置流程提问，保存 EXTEND.md 后再继续。

## 设置流程

```
未找到 EXTEND.md
        |
        v
+---------------------+
| AskUserQuestion     |
| (所有问题)           |
+---------------------+
        |
        v
+---------------------+
| 创建 EXTEND.md       |
+---------------------+
        |
        v
    继续步骤 1
```

## 问题

**语言**：使用用户输入语言或已保存的语言偏好。

使用 AskUserQuestion 一次提出所有问题：

### 问题 1：默认主题

```yaml
header: "主题"
question: "文章转换的默认主题？"
options:
  - label: "default（推荐）"
    description: "经典布局 - 居中标题带边框，白字彩色 H2（默认蓝色）"
  - label: "grace"
    description: "优雅风格 - 文字阴影、圆角卡片、精致引用块（默认紫色）"
  - label: "simple"
    description: "极简现代 - 不对称圆角、干净留白（默认绿色）"
  - label: "modern"
    description: "大圆角、胶囊标题、宽松排版（默认橙色）"
```

### 问题 2：默认颜色

```yaml
header: "颜色"
question: "默认颜色预设？（不设置则使用主题默认色）"
options:
  - label: "主题默认色（推荐）"
    description: "使用主题内置的默认颜色"
  - label: "blue"
    description: "#0F4C81 经典蓝"
  - label: "red"
    description: "#A93226 中国红"
  - label: "green"
    description: "#009874 翡翠绿"
```

注：用户可选择"其他"来输入任意预设名（vermilion, yellow, purple, sky, rose, olive, black, gray, pink, orange）或十六进制值。

### 问题 3：默认发布方式

```yaml
header: "发布方式"
question: "默认发布方式？"
options:
  - label: "api（推荐）"
    description: "速度快，需要 API 凭据（AppID + AppSecret）"
  - label: "browser"
    description: "速度慢，需要 Chrome 和登录会话"
```

### 问题 4：默认作者

```yaml
header: "作者"
question: "文章的默认作者名？"
options:
  - label: "不设置默认值"
    description: "留空，每篇文章单独指定"
```

注：用户通常会选择"其他"来输入自己的作者名。

### 问题 5：开启评论

```yaml
header: "评论"
question: "默认是否开启文章评论？"
options:
  - label: "是（推荐）"
    description: "允许读者对文章发表评论"
  - label: "否"
    description: "默认关闭评论"
```

### 问题 6：仅粉丝可评论

```yaml
header: "仅粉丝"
question: "是否限制仅关注者可评论？"
options:
  - label: "否（推荐）"
    description: "所有读者均可评论"
  - label: "是"
    description: "仅关注者可评论"
```

### 问题 7：保存位置

```yaml
header: "保存"
question: "偏好设置保存到哪里？"
options:
  - label: "项目（推荐）"
    description: ".sweety-skills/（仅当前项目）"
  - label: "用户"
    description: "~/.sweety-skills/（所有项目）"
```

## 保存位置

| 选择 | 路径 | 范围 |
|------|------|------|
| 项目 | `.sweety-skills/sweety-post-to-wechat/EXTEND.md` | 当前项目 |
| 用户 | `~/.sweety-skills/sweety-post-to-wechat/EXTEND.md` | 所有项目 |

## 设置完成后

1. 如需要则创建目录
2. 写入 EXTEND.md
3. 确认："偏好设置已保存到 [路径]"
4. 继续步骤 0（加载已保存的偏好设置）

## EXTEND.md 模板

### 单账号（默认）

```md
default_theme: [default/grace/simple/modern]
default_color: [预设名、十六进制值，或留空使用主题默认色]
default_publish_method: [api/browser]
default_author: [作者名或留空]
need_open_comment: [1/0]
only_fans_can_comment: [1/0]
chrome_profile_path:
```

### 多账号

```md
default_theme: [default/grace/simple/modern]
default_color: [预设名、十六进制值，或留空使用主题默认色]

accounts:
  - name: [显示名称]
    alias: [短标识，如 "tech"]
    default: true
    default_publish_method: [api/browser]
    default_author: [作者名]
    need_open_comment: [1/0]
    only_fans_can_comment: [1/0]
    app_id: [微信 App ID，可选]
    app_secret: [微信 App Secret，可选]
  - name: [第二账号名称]
    alias: [短标识，如 "ai-tools"]
    default_publish_method: [api/browser]
    default_author: [作者名]
    need_open_comment: [1/0]
    only_fans_can_comment: [1/0]
```

## 后续添加更多账号

初始设置完成后，用户可通过编辑 EXTEND.md 添加账号：

1. 添加 `accounts:` 块并列出账号条目
2. 将账号级设置（作者、发布方式、评论）移入各账号条目
3. 全局设置（主题、颜色）保留在顶层
4. 每个账号需要唯一的 `alias`（用于 CLI `--account` 参数和 Chrome 配置目录命名）
5. 在主要账号上设置 `default: true`

## 修改偏好设置

用户可直接编辑 EXTEND.md，或删除它以重新触发设置流程。
