# 素材存储策略

随着任务次数增多，最占空间的通常不是 Markdown，而是图片、提示词目录和测试任务残留。

本技能默认采用保守策略：

- 已发布作品的最终成品保留
- `publish/manifest.json`、正文、研究稿保留
- 提示词目录可清理
- 测试任务和长期未完成任务可清理

## 优先清理顺序

### 第一类：测试任务和未完成任务

优先清理：

- `test-*`
- `policy-test`
- `status = initialized`
- `status = publish_failed`

这些目录通常没有长期价值，却会带着图片和中间文件。

### 第二类：已完成任务里的 prompts

`prompts/` 目录主要用于生成阶段回放，通常不是最终成品的一部分。已发布任务如果后续不打算复刻同图，可优先清理这一层。

### 第三类：重复或可复用图片

若同一张图已经在别的任务中复用，优先记录路径复用，而不是重复生成、重复存储。

## 清理脚本

```bash
${BUN_X} {baseDir}/scripts/storage-gc.ts --root wechat-tujie-wanwu --keep-days 30 --prune-prompts --prune-temporary
```

默认只输出 `dry-run` 结果，不会真的删除。

确认后再执行：

```bash
${BUN_X} {baseDir}/scripts/storage-gc.ts --root wechat-tujie-wanwu --keep-days 30 --prune-prompts --prune-temporary --apply
```

## 建议做法

- 已发布文章和贴图：保留最终主图、封面、正文、manifest、研究摘要
- 生成过程文件：定期清理 `prompts/`
- 测试任务：7 到 30 天内清掉
- 未成功发布且无复用价值的任务：尽快清掉

## 不建议自动删除

- 已发布任务的最终成品图
- `publish/manifest.json`
- `topic-history.json`
- 研究摘要和标题记录

这些内容对去重、复盘和后续复用都还有价值。
