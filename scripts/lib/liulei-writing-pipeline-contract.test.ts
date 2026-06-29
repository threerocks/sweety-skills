import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function read(relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

test("liulei writer orchestrates external review skills and blocks unsafe final output", async () => {
  const skill = await read("skills/sweety-liulei-writer/SKILL.md");

  const shuorenhuaIndex = skill.indexOf("shuorenhua");
  const humanizerIndex = skill.indexOf("humanizer-zh");
  const reviewIndex = skill.indexOf("sweety-four-layer-review");

  assert.ok(shuorenhuaIndex >= 0, "writer must call shuorenhua");
  assert.ok(humanizerIndex > shuorenhuaIndex, "humanizer-zh must run after shuorenhua");
  assert.ok(reviewIndex > humanizerIndex, "four-layer review must run after humanizer-zh");

  assert.match(skill, /taste_skill_domain_mismatch: skipped/);
  assert.match(skill, /real_token_ratio_estimate/);
  assert.match(skill, /zhuque_risk/);
  assert.match(skill, /human_final_edit_required: true/);
  assert.match(skill, /正式档只有在 `real_token_ratio_estimate: high`/);
  assert.match(skill, /第 3 轮仍不过就标 `\[需人工\]`/);
});

test("sweety humanizer skill is removed from the repo contract", async () => {
  const removedSkillName = ["sweety", "humanizer", "zh"].join("-");

  await assert.rejects(
    () => fs.stat(path.join(root, "skills", removedSkillName)),
    /ENOENT/,
  );

  const files = [
    "README.md",
    "README.zh.md",
    "skills/sweety-liulei-writer/SKILL.md",
    "skills/sweety-four-layer-review/SKILL.md",
    "skills/sweety-viral-opening/SKILL.md",
    "skills/sweety-trustworthy-title/SKILL.md",
  ];

  for (const file of files) {
    const contents = await read(file);
    assert.equal(
      contents.includes(removedSkillName),
      false,
      `${file} must not reference removed ${removedSkillName}`,
    );
  }
});
