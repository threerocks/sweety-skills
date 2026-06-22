# 掘金停止条件

出现以下情况必须停止：

- 未登录，无法进入编辑器。
- 页面不是掘金创作页。
- 标题或 Markdown 编辑器无法写入。
- 用户没有提供必填字段。
- 标签超过 5 个。
- 简介超过 100 字。
- 标题超过 80 字。
- 封面路径不存在。
- 用户提供了封面，但封面上传无法确认成功。
- Codex Chrome 插件路径上传本地文件时被 Chrome 扩展文件权限拦截。
- 用户要求使用普通 Chrome 登录态，但 Codex Chrome Extension 通信失败或连续超时。
- 发布设置面板无法打开。
- 简介、分类或标签填入后无法回读验证。
- 页面结构变化到无法确认当前状态。

默认不要继续点击最终发布。只有显式 `--publish` 或用户本轮明确要求最终发布时才继续。

封面上传失败时必须给出可恢复动作：

- 如果是 Codex Chrome Extension 路径，提示用户在 `chrome://extensions` 为 Codex extension 打开 `Allow access to file URLs`。
- 如果是普通 Chrome 登录态但扩展通信失败，提示恢复 Codex Chrome Extension 连接；不要切换到默认隔离 profile。
- 如果是 CDP 脚本路径，提示检查所选 profile 是否已登录掘金，以及页面是否仍暴露文章封面 file input。
