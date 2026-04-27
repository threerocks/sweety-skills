import fs from "node:fs";
import path from "node:path";
import { loadCourseSourcePack } from "./course-pack.ts";
import type { CourseSourcePack, LessonContentPack } from "./types.ts";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(text: string, lineLength: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of text) {
    current += char;
    if (current.length >= lineLength) {
      lines.push(current);
      current = "";
    }
  }
  if (current) lines.push(current);
  return lines;
}

function bulletLines(items: string[], lineLength: number): string[] {
  return items.slice(0, 3).flatMap((item, index) => wrapText(`${index + 1}. ${item}`, lineLength));
}

function svgHeader(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title { font: 700 58px 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; fill: #0f172a; }
    .subtitle { font: 400 28px 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; fill: #334155; }
    .body { font: 400 34px 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; fill: #1e293b; }
    .small { font: 400 24px 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; fill: #475569; }
    .cardTitle { font: 700 26px 'JetBrains Mono','Menlo',monospace; fill: #2563eb; }
  </style>`;
}

function posterSvg(title: string, lesson: LessonContentPack): string {
  const titleLines = wrapText(title, 18);
  const summaryLines = wrapText(lesson.big_idea || lesson.summary, 22).slice(0, 3);
  const pointLines = bulletLines((lesson.poster_points && lesson.poster_points.length > 0 ? lesson.poster_points : lesson.takeaways) || [], 18);
  return [
    svgHeader(1080, 1440),
    `<rect width="1080" height="1440" fill="#f7fbff"/>`,
    `<rect x="0" y="0" width="1080" height="280" rx="0" fill="#2563eb"/>`,
    `<circle cx="930" cy="145" r="86" fill="#93c5fd" opacity="0.35"/>`,
    `<circle cx="845" cy="95" r="28" fill="#dbeafe" opacity="0.7"/>`,
    ...titleLines.map((line, index) => `<text class="title" x="72" y="${95 + index * 70}" fill="#ffffff">${escapeXml(line)}</text>`),
    `<rect x="72" y="340" width="936" height="240" rx="32" fill="#ffffff"/>`,
    ...summaryLines.map((line, index) => `<text class="body" x="110" y="${418 + index * 54}">${escapeXml(line)}</text>`),
    `<text class="small" x="74" y="640">本讲重点</text>`,
    `<rect x="72" y="680" width="936" height="180" rx="32" fill="#e0f2fe"/>`,
    ...pointLines.map((line, index) => `<text class="body" x="110" y="${750 + index * 50}">${escapeXml(line)}</text>`),
    `<rect x="72" y="920" width="936" height="320" rx="32" fill="#ffffff"/>`,
    `<text class="subtitle" x="110" y="985">今天先记住这句话</text>`,
    ...wrapText(lesson.opening_scene, 24).slice(0, 4).map((line, index) => `<text class="small" x="110" y="${1045 + index * 44}">${escapeXml(line)}</text>`),
    `<rect x="72" y="1288" width="250" height="70" rx="20" fill="#2563eb"/>`,
    `<text class="cardTitle" x="114" y="1334" fill="#ffffff">AI CAT KIDS</text>`,
    `</svg>`,
  ].join("\n");
}

function coverSvg(title: string, lesson: LessonContentPack): string {
  const titleLines = wrapText(title, 16).slice(0, 2);
  const subtitle = wrapText(lesson.summary, 26).slice(0, 1);
  return [
    svgHeader(900, 383),
    `<rect width="900" height="383" fill="#eff6ff"/>`,
    `<rect x="0" y="0" width="310" height="383" fill="#2563eb"/>`,
    `<circle cx="780" cy="90" r="76" fill="#bfdbfe" opacity="0.8"/>`,
    `<circle cx="660" cy="280" r="120" fill="#dbeafe" opacity="0.9"/>`,
    `<text class="small" x="56" y="80" fill="#dbeafe">AI来了 2026-03</text>`,
    ...titleLines.map((line, index) => `<text class="subtitle" x="350" y="${118 + index * 48}" fill="#0f172a">${escapeXml(line)}</text>`),
    ...subtitle.map((line, index) => `<text class="small" x="350" y="${235 + index * 36}">${escapeXml(line)}</text>`),
    `<rect x="350" y="282" width="180" height="44" rx="14" fill="#2563eb"/>`,
    `<text class="small" x="390" y="311" fill="#ffffff">少年科普连载</text>`,
    `</svg>`,
  ].join("\n");
}

function inlineSvg(title: string, lesson: LessonContentPack): string {
  const titleLines = wrapText(title, 18).slice(0, 2);
  const sceneLines = wrapText(lesson.opening_scene, 22).slice(0, 4);
  const takeaways = bulletLines(lesson.takeaways || [], 18);
  return [
    svgHeader(1080, 1440),
    `<rect width="1080" height="1440" fill="#fffdf7"/>`,
    `<rect x="62" y="72" width="956" height="250" rx="36" fill="#dbeafe"/>`,
    ...titleLines.map((line, index) => `<text class="title" x="110" y="${160 + index * 68}" font-size="52">${escapeXml(line)}</text>`),
    `<rect x="62" y="380" width="956" height="360" rx="36" fill="#ffffff"/>`,
    ...sceneLines.map((line, index) => `<text class="body" x="110" y="${470 + index * 54}">${escapeXml(line)}</text>`),
    `<rect x="62" y="810" width="956" height="430" rx="36" fill="#eef2ff"/>`,
    `<text class="subtitle" x="110" y="885">读完带走的 3 个判断</text>`,
    ...takeaways.map((line, index) => `<text class="body" x="110" y="${965 + index * 56}">${escapeXml(line)}</text>`),
    `</svg>`,
  ].join("\n");
}

async function main(): Promise<void> {
  const source = getArg("--source");
  if (!source) {
    console.error("Usage: prebuild-course-svg-cache.ts --source <path/to/*.source.json>");
    process.exit(1);
  }
  const sourcePath = path.resolve(source);
  const pack = await loadCourseSourcePack(sourcePath);
  if (!pack?.lessons?.length) {
    console.error(`Failed to load lessons from ${sourcePath}`);
    process.exit(2);
  }
  const cacheRoot = sourcePath.replace(/\.source\.json$/i, "");
  for (const lesson of pack.lessons) {
    const lessonDir = path.join(cacheRoot, String(lesson.item_no).padStart(2, "0"));
    const title = `${pack.course_title} ${String(lesson.item_no).padStart(2, "0")} - ${lesson.title}`;
    fs.mkdirSync(lessonDir, { recursive: true });
    fs.writeFileSync(path.join(lessonDir, "poster.svg"), `${posterSvg(title, lesson)}\n`, "utf8");
    fs.writeFileSync(path.join(lessonDir, "cover.svg"), `${coverSvg(title, lesson)}\n`, "utf8");
    fs.writeFileSync(path.join(lessonDir, "inline-01.svg"), `${inlineSvg(title, lesson)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    ok: true,
    course_id: pack.course_id,
    lessons: pack.lessons.length,
    cache_root: cacheRoot,
  }, null, 2));
}

void main();
