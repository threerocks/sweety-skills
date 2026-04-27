import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("wechat-api dry-run supports newspic image directory payload planning", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-newspic-"));
  const imageDir = path.join(tmpDir, "images");
  fs.mkdirSync(imageDir);
  fs.writeFileSync(path.join(imageDir, "02-second.jpg"), "fake-jpg");
  fs.writeFileSync(path.join(imageDir, "01-first.png"), "fake-png");
  fs.writeFileSync(path.join(imageDir, "notes.txt"), "ignore me");

  const script = path.join(import.meta.dirname, "wechat-api.ts");
  const result = spawnSync(
    process.execPath,
    [
      script,
      imageDir,
      "--type",
      "newspic",
      "--title",
      "图册测试",
      "--content",
      "这是一条贴图测试正文",
      "--dry-run",
    ],
    {
      cwd: tmpDir,
      encoding: "utf-8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.articleType, "newspic");
  assert.equal(output.title, "图册测试");
  assert.equal(output.content, "这是一条贴图测试正文");
  assert.equal(output.imageCount, 2);
  assert.deepEqual(
    output.images.map((p: string) => path.basename(p)),
    ["01-first.png", "02-second.jpg"],
  );
});
