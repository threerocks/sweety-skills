import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  GALLERY_GROUPS,
  fixCjkBoldPunctuation,
  fixCjkSpacing,
  listThemeIds,
  renderMarkdownToWechatHtml,
} from "./engine.ts";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("theme registry exposes all 30 upstream themes", () => {
  const themeIds = listThemeIds();
  assert.equal(themeIds.length, 30);
  assert.equal(new Set(themeIds).size, 30);
  assert.deepEqual(GALLERY_GROUPS.map((group) => group.name), [
    "深度长文",
    "科技产品",
    "文艺随笔",
    "活力动态",
    "模板布局",
  ]);
});

test("fixCjkSpacing inserts spaces for mixed CJK and latin text", () => {
  assert.equal(fixCjkSpacing("这是GPT工具"), "这是 GPT 工具");
  assert.equal(fixCjkSpacing("支持AI生成HTML"), "支持 AI 生成 HTML");
});

test("fixCjkBoldPunctuation moves punctuation outside bold markers", () => {
  assert.equal(fixCjkBoldPunctuation("**重点，**"), "**重点**，");
  assert.equal(fixCjkBoldPunctuation("*提示。*"), "*提示*。");
});

test("renderMarkdownToWechatHtml produces inline wechat html, footnotes and copied images", async () => {
  const root = await makeTempDir("wechat-engine-");
  const inputPath = path.join(root, "article.md");
  const imagePath = path.join(root, "demo.png");
  const outputDir = path.join(root, "out");
  const assetsDir = path.join(root, "assets");

  await fs.writeFile(imagePath, "fake-image", "utf-8");
  await fs.writeFile(
    inputPath,
    `---
title: 测试标题
author: 测试作者
summary: 测试摘要
---

这是GPT工具和AI产品。

核心观点：这是一条重点结论

张三：你好
李四：你好

![](demo.png)
![](demo.png)
![](demo.png)

访问[OpenAI](https://openai.com/)获取信息。
`,
    "utf-8",
  );

  const result = renderMarkdownToWechatHtml({
    inputPath,
    theme: "newspaper",
    outputDir,
    assetsDir,
    noOpen: true,
  });

  assert.equal(result.title, "测试标题");
  assert.equal(result.author, "测试作者");
  assert.equal(result.summary, "测试摘要");
  assert.equal(result.theme, "newspaper");
  assert.ok(result.articlePath);
  assert.ok(result.previewPath);
  assert.equal(result.contentImages.length, 3);

  const articleHtml = await fs.readFile(result.articlePath!, "utf-8");
  const previewHtml = await fs.readFile(result.previewPath!, "utf-8");
  const copiedImagePath = path.join(assetsDir, "demo.png");

  assert.match(articleHtml, /<div id="output">/);
  assert.match(articleHtml, /style="/);
  assert.match(articleHtml, /参考链接/);
  assert.match(articleHtml, /data-local-path="/);
  assert.match(articleHtml, /dialogue-block|dialogue/);
  assert.match(articleHtml, /gallery-grid|gallery/);
  assert.match(articleHtml, /这是 GPT 工具和 AI 产品/);
  assert.match(articleHtml, /核心观点/);
  assert.match(previewHtml, /复制到微信/);
  assert.match(previewHtml, /localStorage\.setItem\('wechat-format-fontsize'/);
  await fs.access(copiedImagePath);
});

test("gallery mode renders 5 groups and 30 theme buttons", async () => {
  const root = await makeTempDir("wechat-gallery-");
  const inputPath = path.join(root, "gallery.md");
  const outputDir = path.join(root, "out");

  await fs.writeFile(inputPath, "# 标题\n\n正文内容。\n", "utf-8");

  const result = renderMarkdownToWechatHtml({
    inputPath,
    gallery: true,
    recommend: ["newspaper", "bytedance", "terracotta"],
    outputDir,
    noOpen: true,
  });

  assert.ok(result.galleryPath);
  const galleryHtml = await fs.readFile(result.galleryPath!, "utf-8");
  assert.match(galleryHtml, /深度长文/);
  assert.match(galleryHtml, /科技产品/);
  assert.match(galleryHtml, /文艺随笔/);
  assert.match(galleryHtml, /活力动态/);
  assert.match(galleryHtml, /模板布局/);
  assert.equal((galleryHtml.match(/class="theme-btn/g) || []).length, 30);
  assert.match(galleryHtml, /rec-badge/);
  assert.match(galleryHtml, /复制 HTML 到剪贴板/);
  assert.match(galleryHtml, /wechat-format-fontsize/);
});
