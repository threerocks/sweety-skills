import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Jimp, JimpMime } from "../../sweety-post-to-wechat/scripts/node_modules/jimp/dist/esm/index.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, "publish-draft.ts");

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("publish-draft auto-selects a theme from manifest signals when theme is omitted", { timeout: 180000 }, async () => {
  const root = await makeTempDir("tujie-publish-");
  const markdownPath = path.join(root, "article.md");
  const manifestPath = path.join(root, "manifest.json");

  await fs.writeFile(
    markdownPath,
    `---
title: GPT-5.4 为什么更适合长流程任务
author: 图解万物
summary: 一篇文章解释模型、Agent、工作流和 API 调用之间的关系。
---

# GPT-5.4 为什么更适合长流程任务

核心观点：当文章主题包含模型、Agent、API、工作流和代码结构时，更适合科技感更强的主题。

- 模型能力
- Agent 编排
- API 接口
- Markdown 到 HTML 渲染
`,
    "utf-8",
  );

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({
      topic: "GPT-5.4 为什么更适合长流程任务",
      work_type: "article",
      selection: {
        category: "ai-tech",
        priority_tier: 3,
        knowledge_angle: "模型能力、工作流、API 接口和技术边界",
      },
      research: {
        selected_sources: ["openai docs", "api reference"],
        knowledge: {
          ready_titles: ["模型能力对比", "Agent 工作流"],
        },
      },
      publish: {},
    }, null, 2)}\n`,
    "utf-8",
  );

  const { stdout } = await execFileAsync("npx", [
    "-y",
    "bun",
    SCRIPT_PATH,
    markdownPath,
    "--work-type",
    "article",
    "--account",
    "dummy",
    "--manifest",
    manifestPath,
    "--dry-run",
  ]);

  const parsed = JSON.parse(stdout.trim()) as {
    ok: boolean;
    formatting: {
      selected_theme: string;
      theme_selection_mode: string;
      theme_signals: string[];
    };
  };

  assert.equal(parsed.ok, true);
  assert.equal(parsed.formatting.theme_selection_mode, "auto");
  assert.ok(["bytedance", "github", "sspai", "midnight"].includes(parsed.formatting.selected_theme));
  assert.ok(parsed.formatting.theme_signals.length >= 1);
});

test("publish-draft falls back to poster safe preview after invalid content hint", { timeout: 180000 }, async () => {
  const root = await makeTempDir("tujie-publish-fallback-");
  const assetsDir = path.join(root, "assets", "poster");
  const publishDir = path.join(root, "publish");
  const configDir = path.join(root, ".sweety-skills", "tujie-wanwu-wechat");
  const markdownPath = path.join(root, "poster.md");
  const manifestPath = path.join(publishDir, "manifest.json");
  const imagePath = path.join(assetsDir, "poster-demo.png");
  const mockScriptPath = path.join(root, "mock-wechat-api.ts");

  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(publishDir, { recursive: true });
  await fs.mkdir(configDir, { recursive: true });

  const image = new Jimp({ width: 64, height: 64, color: 0xffd89bff });
  const imageBuffer = await image.getBuffer(JimpMime.png);
  await fs.writeFile(imagePath, imageBuffer);

  await fs.writeFile(
    markdownPath,
    `---
title: 失败后自动换图
author: 图解万物
summary: 测试 poster 草稿在命中 invalid content hint 后自动切换到兜底图。
---

正文说明。

![失败后自动换图](assets/poster/poster-demo.png)
`,
    "utf8",
  );

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({
      topic: "失败后自动换图",
      work_type: "poster",
      publish: {},
    }, null, 2)}\n`,
    "utf8",
  );

  await fs.writeFile(
    path.join(configDir, "EXTEND.md"),
    `---
version: 1
wechat_account_alias: dummy
poster_publish_fallback_enabled: true
poster_publish_fallback_mode: safe-preview
---
`,
    "utf8",
  );

  await fs.writeFile(
    mockScriptPath,
    `const filePath = process.argv[2];
const isFallback = filePath.includes(".api-fallback.md");
if (!isFallback) {
  console.error("Error: Publish failed 45166: invalid content hint");
  process.exit(1);
}
console.log(JSON.stringify({ media_id: "draft-media-id" }));
`,
    "utf8",
  );

  const { stdout } = await execFileAsync("npx", [
    "-y",
    "bun",
    SCRIPT_PATH,
    markdownPath,
    "--work-type",
    "poster",
    "--account",
    "dummy",
    "--manifest",
    manifestPath,
  ], {
    cwd: root,
    env: {
      ...process.env,
      SWEETY_WECHAT_API_SCRIPT: mockScriptPath,
    },
  });

  const parsed = JSON.parse(stdout.trim()) as {
    ok: boolean;
    result: { media_id: string };
    manual_follow_up?: {
      required: boolean;
      original_image_path: string;
      fallback_image_path: string;
      fallback_publish_file: string;
    };
  };
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
    status: string;
    publish: {
      draft_media_id: string;
      fallback_image_used: boolean;
      manual_image_action_required: boolean;
      original_image_path: string;
      fallback_image_path: string;
      fallback_publish_file: string;
    };
  };

  assert.equal(parsed.ok, true);
  assert.equal(parsed.result.media_id, "draft-media-id");
  assert.equal(parsed.manual_follow_up?.required, true);
  assert.equal(manifest.status, "completed");
  assert.equal(manifest.publish.draft_media_id, "draft-media-id");
  assert.equal(manifest.publish.fallback_image_used, true);
  assert.equal(manifest.publish.manual_image_action_required, true);
  assert.equal(manifest.publish.original_image_path, imagePath);
  assert.ok(manifest.publish.fallback_image_path.endsWith("poster-api-fallback.jpg"));
  assert.ok(manifest.publish.fallback_publish_file.endsWith("poster.api-fallback.md"));
});
