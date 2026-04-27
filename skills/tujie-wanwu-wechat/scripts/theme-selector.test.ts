import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inferWechatFormatting } from "./theme-selector.ts";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("explicit theme override wins over auto inference", () => {
  const result = inferWechatFormatting({
    filePath: "/tmp/anything.md",
    workType: "article",
    explicitTheme: "terracotta",
    explicitColor: "#A93226",
  });

  assert.equal(result.theme, "terracotta");
  assert.equal(result.color, "#A93226");
  assert.equal(result.selectionMode, "explicit");
});

test("ai-tech article prefers tech-oriented themes", async () => {
  const root = await makeTempDir("theme-ai-tech-");
  const markdownPath = path.join(root, "article.md");
  const manifestPath = path.join(root, "manifest.json");

  await fs.writeFile(markdownPath, "# GPT 工作流\n\n- API\n- Agent\n- Markdown\n", "utf-8");
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({
      topic: "GPT 工作流",
      selection: {
        category: "ai-tech",
        knowledge_angle: "模型能力、工作流、API 接口和技术边界",
      },
      research: {
        selected_sources: ["openai docs"],
        knowledge: {
          ready_titles: ["Agent 工作流"],
        },
      },
    }, null, 2)}\n`,
    "utf-8",
  );

  const result = inferWechatFormatting({
    filePath: markdownPath,
    workType: "article",
    manifestPath,
  });

  assert.ok(["bytedance", "github", "sspai", "midnight"].includes(result.theme));
  assert.equal(result.selectionMode, "auto");
});

test("poster mode falls back to poster-friendly themes", () => {
  const result = inferWechatFormatting({
    filePath: "/tmp/poster-topic.md",
    workType: "poster",
  });

  assert.ok(["bauhaus", "focus-blue", "sports"].includes(result.theme));
  assert.equal(result.selectionMode, "auto");
});
