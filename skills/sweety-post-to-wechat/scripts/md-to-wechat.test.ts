import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, "md-to-wechat.ts");

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("md-to-wechat preserves compatibility contract and supports legacy theme alias", async () => {
  const root = await makeTempDir("md-to-wechat-");
  const markdownPath = path.join(root, "article.md");
  const imagePath = path.join(root, "inline.png");

  await fs.writeFile(imagePath, "fake-image", "utf-8");
  await fs.writeFile(
    markdownPath,
    `---
title: 兼容测试
author: 兼容作者
summary: 兼容摘要
---

这是GPT插件。

![](inline.png)

访问[示例](https://example.com)。
`,
    "utf-8",
  );

  const { stdout } = await execFileAsync("npx", ["-y", "bun", SCRIPT_PATH, markdownPath, "--theme", "default", "--color", "#A93226"]);
  const parsed = JSON.parse(stdout.trim()) as {
    title: string;
    author: string;
    summary: string;
    htmlPath: string;
    contentImages: Array<{ localPath: string }>;
  };

  assert.equal(parsed.title, "兼容测试");
  assert.equal(parsed.author, "兼容作者");
  assert.equal(parsed.summary, "兼容摘要");
  assert.equal(parsed.contentImages.length, 1);

  const html = await fs.readFile(parsed.htmlPath, "utf-8");
  assert.match(html, /<div id="output">/);
  assert.match(html, /style="/);
  assert.match(html, /参考链接/);
  assert.match(html, /#A93226/i);
});
