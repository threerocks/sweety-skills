#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const defaultStyleRoot = path.join(process.env.SWEETY_WRITING_STYLE_HOME || path.join(process.env.HOME || "", ".codex", "writing-style", "liulei"));

function parseArgs(argv) {
  const args = {
    port: 4178,
    profile: "global",
    styleRoot: defaultStyleRoot,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith("--") ? next : true;
    if (args[key] === next) index += 1;
  }
  args.port = Number(args.port || 4178);
  if (!args.draft) {
    console.error("Usage: node style-editor.mjs --draft /absolute/path/article.md --profile wechat-deep-article [--sample-id id] [--port 4178]");
    process.exit(1);
  }
  args.draft = path.resolve(String(args.draft));
  args.profile = String(args.profile || "global");
  args.styleRoot = path.resolve(String(args.styleRoot || defaultStyleRoot));
  args.sampleId = String(args["sample-id"] || path.basename(path.dirname(args.draft)) || new Date().toISOString().slice(0, 10));
  return args;
}

function safeName(name) {
  const cleaned = String(name).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "sample";
}

function splitFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) return [{}, markdown];
  const end = markdown.indexOf("\n---\n", 4);
  if (end === -1) return [{}, markdown];
  const raw = markdown.slice(4, end).trim();
  const body = markdown.slice(end + 5).trimStart();
  const meta = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (match) meta[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return [meta, body];
}

function visibleText(markdown) {
  return markdown
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[[^\]]*]\([^)]+\)/g, "")
    .replace(/[>*_`~-]/g, "")
    .replace(/\s+/g, "");
}

function paragraphs(markdown) {
  return markdown
    .replace(/^---[\s\S]*?---\n/, "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function headings(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^#{1,4}\s+/.test(line))
    .map((line) => line.replace(/^#{1,4}\s+/, "").trim());
}

function commonPrefix(a, b) {
  let index = 0;
  const max = Math.min(a.length, b.length);
  while (index < max && a[index] === b[index]) index += 1;
  return index;
}

function extractLearning(aiText, humanText) {
  const [aiMeta, aiBody] = splitFrontmatter(aiText);
  const [humanMeta, humanBody] = splitFrontmatter(humanText);
  const aiChars = visibleText(aiText).length;
  const humanChars = visibleText(humanText).length;
  const aiParagraphs = paragraphs(aiBody);
  const humanParagraphs = paragraphs(humanBody);
  const aiOpening = aiParagraphs[0] || "";
  const humanOpening = humanParagraphs[0] || "";
  const aiLikePatterns = ["首先", "其次", "最后", "此外", "值得注意的是", "不难看出", "总结来说", "综上所述", "从某种意义上说", "本文将从", "深度解析", "全面解读", "带你看懂"];
  const deletedPatterns = aiLikePatterns.filter((phrase) => aiText.includes(phrase) && !humanText.includes(phrase));
  const addedJudgment = humanParagraphs.filter((para) => !aiBody.includes(para) && /我|觉得|其实|更像|问题是|关键|该|不该/.test(para)).slice(0, 6);
  const rules = [];

  if ((aiMeta.title || "") !== (humanMeta.title || "")) {
    rules.push("标题需要向人工版靠拢：减少模板判断，保留对象、问题和点击理由。");
  }
  if (commonPrefix(aiOpening, humanOpening) < Math.min(aiOpening.length, humanOpening.length) * 0.4) {
    rules.push("开头不要只做总述，优先使用人工版那种判断、画面或争议入口。");
  }
  if (humanChars < aiChars * 0.9) {
    rules.push("初稿偏长，下次先压缩解释段，保留事实链和判断链。");
  }
  if (humanParagraphs.length < aiParagraphs.length) {
    rules.push("人工版倾向合并段落，下次减少过度分段和报告感停顿。");
  }
  if (deletedPatterns.length) {
    rules.push(`下次避免或少用：${deletedPatterns.join("、")}。`);
  }
  if (addedJudgment.length) {
    rules.push("人工版会补更直接的作者判断，下次不要只做中性摘要。");
  }
  if (!rules.length) rules.push("本次人工改动较小，继续沿用当前 profile 的写法。");

  return {
    aiMeta,
    humanMeta,
    aiChars,
    humanChars,
    charDelta: humanChars - aiChars,
    aiParagraphCount: aiParagraphs.length,
    humanParagraphCount: humanParagraphs.length,
    aiHeadings: headings(aiBody),
    humanHeadings: headings(humanBody),
    deletedPatterns,
    addedJudgment,
    rules,
  };
}

function renderDiffNotes({ args, learning, notes }) {
  const lines = [];
  lines.push(`# 人工改稿学习记录：${args.sampleId}`);
  lines.push("");
  lines.push(`- profile: ${args.profile}`);
  lines.push(`- draft: ${args.draft}`);
  lines.push(`- recordedAt: ${new Date().toISOString()}`);
  lines.push(`- 字数变化：${learning.aiChars} -> ${learning.humanChars}（${learning.charDelta >= 0 ? "+" : ""}${learning.charDelta}）`);
  lines.push(`- 段落变化：${learning.aiParagraphCount} -> ${learning.humanParagraphCount}`);
  lines.push(`- 小标题变化：${learning.aiHeadings.length} -> ${learning.humanHeadings.length}`);
  if ((learning.aiMeta.title || "") !== (learning.humanMeta.title || "")) {
    lines.push(`- 标题变化：${learning.aiMeta.title || ""} -> ${learning.humanMeta.title || ""}`);
  }
  lines.push("");
  lines.push("## 自动提炼规则");
  for (const rule of learning.rules) lines.push(`- ${rule}`);
  if (learning.addedJudgment.length) {
    lines.push("");
    lines.push("## 人工新增判断片段");
    for (const item of learning.addedJudgment) lines.push(`- ${item.slice(0, 140)}`);
  }
  if (notes) {
    lines.push("");
    lines.push("## 用户备注");
    lines.push(notes.trim());
  }
  lines.push("");
  return lines.join("\n");
}

function renderProfileAppend(args, learning) {
  const lines = [];
  lines.push("");
  lines.push(`## ${new Date().toISOString()} ${args.sampleId}`);
  for (const rule of learning.rules) lines.push(`- ${rule}`);
  lines.push("");
  return lines.join("\n");
}

async function readOptional(filePath) {
  return fs.readFile(filePath, "utf8").catch(() => "");
}

async function writeIfMissing(filePath, body) {
  const exists = await readOptional(filePath);
  if (!exists) await fs.writeFile(filePath, body, "utf8");
}

async function ensureProfile(args) {
  const profilePath = path.join(args.styleRoot, "profiles", args.profile, "profile.md");
  await fs.mkdir(path.dirname(profilePath), { recursive: true });
  await writeIfMissing(profilePath, `# ${args.profile}\n\n## 使用场景\n\n待补充。\n\n## 稳定偏好\n\n- 先给判断，再给材料。\n- 删除重复解释和模板连接。\n- 保留事实边界，不伪造经历、数据和引用。\n\n## 样本追加\n`);
  return profilePath;
}

async function confirm(args, humanText, notes) {
  const aiText = await fs.readFile(args.draft, "utf8");
  const draftDir = path.dirname(args.draft);
  const base = path.basename(args.draft, path.extname(args.draft));
  const backupPath = path.join(draftDir, `${base}.ai-backup.md`);
  const humanPath = path.join(draftDir, `${base}.human.md`);
  const sampleDir = path.join(args.styleRoot, "samples", args.profile, safeName(args.sampleId));
  const profilePath = await ensureProfile(args);
  const learning = extractLearning(aiText, humanText);
  const diffNotes = renderDiffNotes({ args, learning, notes });

  await fs.mkdir(sampleDir, { recursive: true });
  await fs.writeFile(backupPath, aiText, "utf8");
  await fs.writeFile(humanPath, humanText, "utf8");
  await fs.writeFile(args.draft, humanText, "utf8");
  await fs.writeFile(path.join(sampleDir, "ai-draft.md"), aiText, "utf8");
  await fs.writeFile(path.join(sampleDir, "human-final.md"), humanText, "utf8");
  await fs.writeFile(path.join(sampleDir, "diff-notes.md"), diffNotes, "utf8");
  await fs.appendFile(profilePath, renderProfileAppend(args, learning), "utf8");
  return { backupPath, humanPath, sampleDir, profilePath, learning, diffNotes };
}

function html(args, draftText, profileText) {
  const escapedDraft = JSON.stringify(draftText);
  const escapedProfile = JSON.stringify(profileText);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Writing Style Editor</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB",sans-serif;background:#f7f3ea;color:#211d1a}
.top{padding:18px 24px;background:#fff;border-bottom:1px solid #e5dccd;display:flex;gap:16px;align-items:center}
.badge{background:#8c3f72;color:white;border-radius:999px;padding:7px 13px;font-weight:700}
.path{color:#6d6258;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wrap{display:grid;grid-template-columns:1fr 360px;gap:18px;padding:18px;box-sizing:border-box;height:calc(100vh - 74px)}
textarea{width:100%;height:100%;box-sizing:border-box;border:1px solid #ddd0bf;border-radius:8px;padding:18px;font-size:17px;line-height:1.72;resize:none;background:#fff;color:#211d1a}
.side{display:flex;flex-direction:column;gap:14px;min-width:0}
.panel{background:#fff;border:1px solid #e5dccd;border-radius:8px;padding:14px;min-height:0}
.profile{white-space:pre-wrap;font-size:13px;line-height:1.55;color:#51483f;max-height:46vh;overflow:auto}
.notes{height:120px;font-size:14px;line-height:1.5}
button{border:0;border-radius:999px;padding:12px 18px;font-size:16px;font-weight:700;cursor:pointer}
.primary{background:#8c3f72;color:white}.secondary{background:#efe5db;color:#3f352e}
.hint{font-size:13px;line-height:1.55;color:#6d6258}
@media(max-width:900px){.wrap{grid-template-columns:1fr;height:auto}.side{min-height:420px}textarea{height:68vh}}
</style>
</head>
<body>
<div class="top"><span class="badge">${args.profile}</span><div class="path">${args.draft}</div></div>
<div class="wrap">
  <textarea id="editor" spellcheck="false"></textarea>
  <div class="side">
    <div class="panel">
      <strong>当前 profile</strong>
      <div id="profile" class="profile"></div>
    </div>
    <textarea id="notes" class="notes" placeholder="可选：这次你主要改了什么？"></textarea>
    <button class="primary" id="confirm">确认并学习</button>
    <button class="secondary" id="reload">重新载入</button>
    <div class="hint" id="status">确认后会保留 AI 备份、写入 human 版本，并追加到全局风格样本库。</div>
  </div>
</div>
<script>
const draft = ${escapedDraft};
const profile = ${escapedProfile};
document.getElementById("editor").value = draft;
document.getElementById("profile").textContent = profile || "(profile empty)";
document.getElementById("reload").onclick = () => location.reload();
document.getElementById("confirm").onclick = async () => {
  if (!confirm("确认后会覆盖当前 draft，并记录风格样本。继续？")) return;
  const res = await fetch("/api/confirm", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({
    humanText: document.getElementById("editor").value,
    notes: document.getElementById("notes").value
  })});
  const data = await res.json();
  document.getElementById("status").textContent = data.ok ? "已确认并学习：" + data.sampleDir : "失败：" + (data.message || data.error);
};
</script>
</body>
</html>`;
}

async function requestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profilePath = await ensureProfile(args);
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/") {
        const draftText = await fs.readFile(args.draft, "utf8");
        const profileText = await readOptional(profilePath);
        const body = html(args, draftText, profileText);
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(body);
        return;
      }
      if (req.method === "POST" && req.url === "/api/confirm") {
        const body = await requestBody(req);
        const result = await confirm(args, String(body.humanText || ""), String(body.notes || ""));
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, sampleDir: result.sampleDir, profilePath: result.profilePath }, null, 2));
        return;
      }
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "not_found" }));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "server_error", message: error.message }, null, 2));
    }
  });
  server.listen(args.port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${args.port}/`;
    console.log(`Writing style editor listening on ${url}`);
    if (args.open !== false && args.open !== "false") spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
