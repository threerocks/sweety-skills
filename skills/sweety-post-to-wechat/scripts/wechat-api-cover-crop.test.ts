import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

function makeArticle(tmpDir: string, frontmatter: string = ""): string {
  const articlePath = path.join(tmpDir, "article.md");
  fs.writeFileSync(articlePath, `${frontmatter}# Crop Test\n\nBody text.\n`);
  return articlePath;
}

function runWechatApiSync(args: string[], cwd: string) {
  const script = path.join(import.meta.dirname, "wechat-api.ts");
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf-8",
  });
}

function runWechatApi(args: string[], cwd: string, env: Record<string, string>): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const script = path.join(import.meta.dirname, "wechat-api.ts");
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf-8");
  child.stderr.setEncoding("utf-8");
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  return new Promise(resolve => {
    child.on("close", status => resolve({ status, stdout, stderr }));
  });
}

test("wechat-api dry-run resolves cover crop fields from frontmatter aliases", { timeout: 15000 }, () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-crop-frontmatter-"));
  const articlePath = makeArticle(tmpDir, [
    "---",
    'title: "Crop Test"',
    'coverImage: "imgs/cover.png"',
    'pic_crop_235_1: "0_0_1_0.4255"',
    'coverCrop1: "0.287_0_0.713_1"',
    "---",
    "",
  ].join("\n"));

  const result = runWechatApiSync([articlePath, "--dry-run"], tmpDir);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.picCrop2351, "0_0_1_0.4255");
  assert.equal(output.picCrop11, "0.287_0_0.713_1");
});

test("wechat-api dry-run resolves cover crop fields from CLI", { timeout: 15000 }, () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-crop-cli-"));
  const articlePath = makeArticle(tmpDir, "---\ntitle: Crop Test\n---\n\n");

  const result = runWechatApiSync([
    articlePath,
    "--cover-crop-235",
    "0_0_1_0.4255",
    "--cover-crop-1",
    "0.287_0_0.713_1",
    "--dry-run",
  ], tmpDir);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.picCrop2351, "0_0_1_0.4255");
  assert.equal(output.picCrop11, "0.287_0_0.713_1");
});

test("wechat-api rejects invalid cover crop coordinates", { timeout: 15000 }, () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-crop-invalid-"));
  const articlePath = makeArticle(tmpDir, "---\ntitle: Crop Test\n---\n\n");

  const result = runWechatApiSync([
    articlePath,
    "--cover-crop-235",
    "0_0_1_1",
    "--dry-run",
  ], tmpDir);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pic_crop_235_1/);
  assert.match(result.stderr, /宽高比/);
});

test("wechat-api sends cover crop fields in news draft payload", { timeout: 15000 }, async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-crop-payload-"));
  const articlePath = makeArticle(tmpDir, "---\ntitle: Crop Test\n---\n\n");
  const coverPath = path.join(tmpDir, "cover.png");
  fs.writeFileSync(coverPath, "fake-png");
  fs.mkdirSync(path.join(tmpDir, ".sweety-skills", "sweety-post-to-wechat"), { recursive: true });

  const draftPayloads: unknown[] = [];
  let materialCount = 0;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf-8");
      res.setHeader("Content-Type", "application/json");
      if (req.url?.startsWith("/cgi-bin/token")) {
        res.end(JSON.stringify({ access_token: "token" }));
      } else if (req.url?.startsWith("/cgi-bin/material/add_material")) {
        materialCount += 1;
        res.end(JSON.stringify({ media_id: `material-${materialCount}`, url: "https://example.com/material.png" }));
      } else if (req.url?.startsWith("/cgi-bin/draft/add")) {
        draftPayloads.push(JSON.parse(body));
        res.end(JSON.stringify({ media_id: "draft-media-id" }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ errcode: 404, errmsg: "not found" }));
      }
    });
  });

  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, "string");
  const port = typeof address === "object" && address ? address.port : 0;
  fs.writeFileSync(
    path.join(tmpDir, ".sweety-skills", "sweety-post-to-wechat", "EXTEND.md"),
    `base_url: "http://127.0.0.1:${port}"\n`,
  );

  try {
    const result = await runWechatApi([
      articlePath,
      "--cover",
      coverPath,
      "--cover-crop-235",
      "0_0_1_0.4255",
      "--cover-crop-1",
      "0.287_0_0.713_1",
    ], tmpDir, {
      WECHAT_APP_ID: "appid",
      WECHAT_APP_SECRET: "secret",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(draftPayloads.length, 1);
    const payload = draftPayloads[0] as { articles: Array<Record<string, unknown>> };
    assert.equal(payload.articles[0]?.pic_crop_235_1, "0_0_1_0.4255");
    assert.equal(payload.articles[0]?.pic_crop_1_1, "0.287_0_0.713_1");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
