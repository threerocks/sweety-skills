import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Jimp, JimpMime, HorizontalAlign, VerticalAlign, loadFont } from "../../sweety-post-to-wechat/scripts/node_modules/jimp";
import { loadCourseSourcePack } from "./course-pack.ts";
import type { CourseSourcePack, LessonContentPack } from "./types.ts";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fontFile(name: string): string {
  return pathToFileURL(path.resolve(
    process.cwd(),
    "skills/sweety-post-to-wechat/scripts/node_modules/@jimp/plugin-print/fonts/open-sans",
    name,
    `${name}.fnt`,
  )).href;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function themeColor(): number {
  return 0x1f5effff;
}

async function createTextImage(title: string, subtitle: string, outputPath: string, width: number, height: number): Promise<void> {
  const background = new Jimp({ width, height, color: themeColor() });
  const font = await loadFont(fontFile("open-sans-32-white"));
  const smallFont = await loadFont(fontFile("open-sans-16-white"));
  background.print({
    font,
    x: 60,
    y: 120,
    text: { text: title, alignmentX: HorizontalAlign.LEFT, alignmentY: VerticalAlign.TOP },
    maxWidth: width - 120,
    maxHeight: height - 220,
  });
  background.print({
    font: smallFont,
    x: 60,
    y: height - 120,
    text: { text: subtitle, alignmentX: HorizontalAlign.LEFT, alignmentY: VerticalAlign.BOTTOM },
    maxWidth: width - 120,
    maxHeight: 80,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const buffer = await background.getBuffer(JimpMime.png);
  fs.writeFileSync(outputPath, buffer);
}

async function createStructuredPosterImage(title: string, lesson: LessonContentPack, outputPath: string): Promise<void> {
  const width = 1080;
  const height = 1440;
  const background = new Jimp({ width, height, color: 0xf4f8ffff });
  const header = new Jimp({ width, height: 270, color: themeColor() });
  const titleFont = await loadFont(fontFile("open-sans-32-white"));
  const bodyFont = await loadFont(fontFile("open-sans-16-black"));
  const smallFont = await loadFont(fontFile("open-sans-14-black"));
  background.composite(header, 0, 0);
  background.print({
    font: titleFont,
    x: 70,
    y: 70,
    text: { text: title, alignmentX: HorizontalAlign.LEFT, alignmentY: VerticalAlign.TOP },
    maxWidth: width - 140,
    maxHeight: 150,
  });
  background.print({
    font: bodyFont,
    x: 70,
    y: 330,
    text: { text: lesson.big_idea || lesson.summary, alignmentX: HorizontalAlign.LEFT, alignmentY: VerticalAlign.TOP },
    maxWidth: width - 140,
    maxHeight: 180,
  });
  uniqueStrings([...(lesson.poster_points || []), ...(lesson.takeaways || [])]).slice(0, 3).forEach((point, index) => {
    const y = 620 + index * 180;
    const panel = new Jimp({ width: width - 140, height: 120, color: 0xffffffff });
    background.composite(panel, 70, y);
    background.print({
      font: smallFont,
      x: 110,
      y: y + 32,
      text: { text: `0${index + 1}  ${point}`, alignmentX: HorizontalAlign.LEFT, alignmentY: VerticalAlign.TOP },
      maxWidth: width - 240,
      maxHeight: 70,
    });
  });
  const buffer = await background.getBuffer(JimpMime.png);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

async function createStructuredInlineImage(title: string, lesson: LessonContentPack, outputPath: string): Promise<void> {
  const width = 1080;
  const height = 1440;
  const background = new Jimp({ width, height, color: 0xfffcf7ff });
  const titleFont = await loadFont(fontFile("open-sans-32-black"));
  const bodyFont = await loadFont(fontFile("open-sans-16-black"));
  background.print({
    font: titleFont,
    x: 70,
    y: 90,
    text: { text: title, alignmentX: HorizontalAlign.LEFT, alignmentY: VerticalAlign.TOP },
    maxWidth: width - 140,
    maxHeight: 140,
  });
  background.print({
    font: bodyFont,
    x: 70,
    y: 300,
    text: { text: lesson.opening_scene || lesson.summary, alignmentX: HorizontalAlign.LEFT, alignmentY: VerticalAlign.TOP },
    maxWidth: width - 140,
    maxHeight: 280,
  });
  uniqueStrings(lesson.takeaways || []).slice(0, 3).forEach((item, index) => {
    background.print({
      font: bodyFont,
      x: 70,
      y: 700 + index * 120,
      text: { text: `${index + 1}. ${item}`, alignmentX: HorizontalAlign.LEFT, alignmentY: VerticalAlign.TOP },
      maxWidth: width - 140,
      maxHeight: 90,
    });
  });
  const buffer = await background.getBuffer(JimpMime.png);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

async function buildCourseCache(pack: CourseSourcePack, sourcePath: string): Promise<void> {
  const cacheRoot = sourcePath.replace(/\.source\.json$/i, "");
  if (!pack.lessons || pack.lessons.length === 0) {
    throw new Error("course pack has no lessons");
  }
  for (const lesson of pack.lessons) {
    const lessonDir = path.join(cacheRoot, String(lesson.item_no).padStart(2, "0"));
    const title = `${pack.course_title} ${String(lesson.item_no).padStart(2, "0")} - ${lesson.title}`;
    await createStructuredPosterImage(title, lesson, path.join(lessonDir, "poster.png"));
    await createTextImage(title, "课程连载封面", path.join(lessonDir, "cover.png"), 900, 383);
    await createStructuredInlineImage(title, lesson, path.join(lessonDir, "inline-01.png"));
  }
}

async function main(): Promise<void> {
  const source = getArg("--source");
  if (!source) {
    console.error("Usage: prebuild-course-cache.ts --source <path/to/*.source.json>");
    process.exit(1);
  }
  const sourcePath = path.resolve(source);
  const pack = await loadCourseSourcePack(sourcePath);
  if (!pack) {
    console.error(`Failed to load course pack: ${sourcePath}`);
    process.exit(2);
  }
  await buildCourseCache(pack, sourcePath);
  console.log(JSON.stringify({
    ok: true,
    course_id: pack.course_id,
    lessons: pack.lessons?.length || 0,
    cache_root: sourcePath.replace(/\.source\.json$/i, ""),
  }, null, 2));
}

void main();
