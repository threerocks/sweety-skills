import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  extractSummaryFromBody,
  extractTitleFromMarkdown,
  initRenderer,
  parseFrontmatter,
  postProcessHtml,
  renderMarkdown,
  stripWrappingQuotes,
} from "../../sweety-post-to-wechat/scripts/vendor/sweety-md/src/index.ts";

export interface ImageInfo {
  placeholder: string;
  localPath: string;
  originalPath: string;
}

export interface ThemeConfig {
  name: string;
  description?: string;
  colors?: Record<string, string>;
  styles: Record<string, Record<string, string>>;
  dark_mode?: Record<string, Record<string, string>>;
}

export interface EngineConfig {
  output_dir: string;
  vault_root: string;
  image_search_paths: string[];
  settings: {
    default_theme: string;
    auto_open_browser: boolean;
  };
}

export interface RenderOptions {
  inputPath: string;
  theme?: string;
  color?: string;
  recommend?: string[];
  gallery?: boolean;
  format?: "wechat" | "html" | "plain";
  outputDir?: string;
  articleHtmlPath?: string;
  previewHtmlPath?: string;
  galleryHtmlPath?: string;
  assetsDir?: string;
  vaultRoot?: string;
  noOpen?: boolean;
}

export interface RenderResult {
  title: string;
  author: string;
  summary: string;
  htmlPath: string;
  previewPath?: string;
  galleryPath?: string;
  articlePath?: string;
  contentImages: ImageInfo[];
  theme: string;
  wordCount: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_DIR = path.resolve(__dirname, "..");
const THEMES_DIR = path.join(SKILL_DIR, "themes");
const TEMPLATE_DIR = path.join(SKILL_DIR, "templates");
const FOOTNOTE_PREFIX = `__FN_${Math.random().toString(16).slice(2, 10)}_`;
const FOOTNOTE_PLACEHOLDERS = {
  footnote_sup: `${FOOTNOTE_PREFIX}SUP__`,
  footnote_section: `${FOOTNOTE_PREFIX}SECTION__`,
  footnote_title: `${FOOTNOTE_PREFIX}TITLE__`,
  footnote_item: `${FOOTNOTE_PREFIX}ITEM__`,
} as const;

const CALLOUT_TYPE_COLORS: Record<string, { border: string; bg: string; icon: string } | null> = {
  tip: { border: "#10b981", bg: "rgba(16,185,129,0.06)", icon: "💡" },
  note: { border: "#3b82f6", bg: "rgba(59,130,246,0.06)", icon: "📝" },
  important: { border: "#8b5cf6", bg: "rgba(139,92,246,0.06)", icon: "⚡" },
  warning: { border: "#f59e0b", bg: "rgba(245,158,11,0.06)", icon: "⚠️" },
  caution: { border: "#ef4444", bg: "rgba(239,68,68,0.06)", icon: "🔴" },
  callout: null,
};

const LEGACY_THEME_ALIASES: Record<string, string> = {
  default: "wechat-native",
  grace: "elegant-blue",
  simple: "minimal-gray",
  modern: "bytedance",
};

export const GALLERY_GROUPS: Array<{ name: string; ids: string[] }> = [
  { name: "深度长文", ids: ["newspaper", "magazine", "ink", "coffee-house"] },
  { name: "科技产品", ids: ["bytedance", "github", "sspai", "midnight"] },
  { name: "文艺随笔", ids: ["terracotta", "mint-fresh", "sunset-amber", "lavender-dream"] },
  { name: "活力动态", ids: ["sports", "bauhaus", "chinese", "wechat-native"] },
  {
    name: "模板布局",
    ids: [
      "bold-blue",
      "bold-green",
      "bold-navy",
      "elegant-blue",
      "elegant-green",
      "elegant-navy",
      "focus-blue",
      "focus-gold",
      "focus-red",
      "minimal-blue",
      "minimal-gold",
      "minimal-gray",
      "minimal-navy",
      "minimal-red",
    ],
  },
];

export const GALLERY_THEMES = GALLERY_GROUPS.flatMap((group) => group.ids);

export function loadConfig(): EngineConfig {
  const configPath = path.join(SKILL_DIR, "config.json");
  const examplePath = path.join(SKILL_DIR, "config.example.json");
  const fallback: EngineConfig = {
    output_dir: "/tmp/wechat-format",
    vault_root: process.cwd(),
    image_search_paths: [],
    settings: {
      default_theme: "newspaper",
      auto_open_browser: false,
    },
  };

  if (fs.existsSync(configPath)) {
    return {
      ...fallback,
      ...JSON.parse(fs.readFileSync(configPath, "utf-8")),
    };
  }

  if (fs.existsSync(examplePath)) {
    return {
      ...fallback,
      ...JSON.parse(fs.readFileSync(examplePath, "utf-8")),
    };
  }

  return fallback;
}

export function listThemeIds(): string[] {
  return fs.readdirSync(THEMES_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .sort();
}

function resolveThemeId(themeName?: string): string {
  const normalized = (themeName || loadConfig().settings.default_theme || "newspaper").trim();
  return LEGACY_THEME_ALIASES[normalized] || normalized;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hexColor: string): [number, number, number] {
  const hex = hexColor.replace("#", "");
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((value) => clamp(value, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function lighten(hexColor: string, amount = 0.22): string {
  const [r, g, b] = hexToRgb(hexColor);
  const next: [number, number, number] = [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ];
  return rgbToHex(next);
}

function applyColorOverride(theme: ThemeConfig, color?: string): ThemeConfig {
  if (!color) return theme;
  const oldAccent = theme.colors?.accent;
  if (!oldAccent || !/^#[0-9a-fA-F]{6}$/.test(color)) return theme;

  const next = JSON.parse(JSON.stringify(theme)) as ThemeConfig;
  const oldAccentLight = next.colors?.accent_light;

  let serialized = JSON.stringify(next);
  serialized = serialized.replaceAll(oldAccent, color);
  if (oldAccentLight) {
    serialized = serialized.replaceAll(oldAccentLight, lighten(color));
  }
  const parsed = JSON.parse(serialized) as ThemeConfig;
  parsed.colors = {
    ...(parsed.colors || {}),
    accent: color,
    accent_light: lighten(color),
  };
  return parsed;
}

export function loadTheme(themeName?: string, colorOverride?: string): { id: string; theme: ThemeConfig } {
  const themeId = resolveThemeId(themeName);
  const filePath = path.join(THEMES_DIR, `${themeId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown theme "${themeName ?? themeId}". Available: ${listThemeIds().join(", ")}`);
  }
  const theme = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ThemeConfig;
  return { id: themeId, theme: applyColorOverride(theme, colorOverride) };
}

export function buildStyleString(props: Record<string, string>): string {
  return Object.entries(props)
    .map(([key, value]) => `${key.replaceAll("_", "-")}:${value}`)
    .join(";");
}

export function countWords(text: string): number {
  const cleaned = text
    .replace(/[#*`\[\]()!>|{}_~\-]/g, "")
    .replace(/\n+/g, "\n");
  const chinese = (cleaned.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (cleaned.match(/[a-zA-Z]+/g) || []).length;
  return chinese + english;
}

export function extractTitle(content: string, filePath: string): string {
  const parsed = parseFrontmatter(content);
  const title = stripWrappingQuotes(String(parsed.frontmatter.title || ""))
    || extractTitleFromMarkdown(parsed.body)
    || path.basename(filePath, path.extname(filePath)).replace(/-(公众号|小红书|微博)$/u, "");
  return title || path.basename(filePath, path.extname(filePath));
}

function extractAuthor(content: string): string {
  const parsed = parseFrontmatter(content);
  return stripWrappingQuotes(String(parsed.frontmatter.author || ""));
}

function extractSummary(content: string): string {
  const parsed = parseFrontmatter(content);
  return stripWrappingQuotes(String(parsed.frontmatter.description || parsed.frontmatter.summary || ""))
    || extractSummaryFromBody(parsed.body, 120);
}

export function stripFrontmatter(content: string): string {
  return parseFrontmatter(content).body;
}

export function fixCjkSpacing(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  const cjk = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
  const latin = /[a-zA-Z0-9]/;

  for (const line of lines) {
    const stripped = line.trim();
    if (stripped.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    const protectedParts: string[] = [];
    const protect = (input: string, pattern: RegExp): string =>
      input.replace(pattern, (match) => {
        protectedParts.push(match);
        return `\u0000P${protectedParts.length - 1}\u0000`;
      });

    let protectedLine = line;
    protectedLine = protect(protectedLine, /`[^`]+`/g);
    protectedLine = protect(protectedLine, /https?:\/\/\S+/g);
    protectedLine = protect(protectedLine, /!\[[^\]]*]\([^)]*\)/g);
    protectedLine = protect(protectedLine, /\[[^\]]*]\([^)]*\)/g);

    let rebuilt = "";
    for (let i = 0; i < protectedLine.length; i += 1) {
      const current = protectedLine[i]!;
      const next = protectedLine[i + 1];
      rebuilt += current;
      if (!next) continue;
      if (cjk.test(current) && latin.test(next) && next !== " ") {
        rebuilt += " ";
      } else if (latin.test(current) && cjk.test(next) && current !== " ") {
        rebuilt += " ";
      }
    }

    protectedParts.forEach((part, index) => {
      rebuilt = rebuilt.replaceAll(`\u0000P${index}\u0000`, part);
    });
    result.push(rebuilt);
  }

  return result.join("\n");
}

export function fixCjkBoldPunctuation(text: string): string {
  const cjkPunct = "[，。！？、；：\"'（）【】《》…—]";
  let result = text.replace(new RegExp(`\\*\\*([^*]+?)(${cjkPunct}+)\\*\\*`, "g"), "**$1**$2");
  result = result.replace(new RegExp(`(?<!\\*)\\*(?!\\*)([^*]+?)(${cjkPunct}+)\\*(?!\\*)`, "g"), "*$1*$2");
  return result;
}

function wrapDialogueBlocks(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  const dialogueLine = /^([^:\n]{1,20})\s*[：:]\s*(.+)$/u;
  let i = 0;

  while (i < lines.length) {
    if (dialogueLine.test(lines[i] || "")) {
      const block: string[] = [];
      let j = i;
      while (j < lines.length && dialogueLine.test(lines[j] || "")) {
        block.push(lines[j]!);
        j += 1;
      }
      if (block.length >= 2) {
        out.push(":::dialogue[对话]");
        out.push(...block);
        out.push(":::");
        i = j;
        continue;
      }
    }
    out.push(lines[i]!);
    i += 1;
  }

  return out.join("\n");
}

function wrapImageGalleries(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  const imageLine = /^!\[[^\]]*]\([^)]+\)\s*$/;
  let i = 0;

  while (i < lines.length) {
    if (imageLine.test(lines[i] || "")) {
      const block: string[] = [];
      let j = i;
      while (j < lines.length && imageLine.test(lines[j] || "")) {
        block.push(lines[j]!);
        j += 1;
      }
      if (block.length >= 3) {
        out.push(":::gallery[图片组]");
        out.push(...block);
        out.push(":::");
        i = j;
        continue;
      }
    }
    out.push(lines[i]!);
    i += 1;
  }

  return out.join("\n");
}

function wrapKeyCallouts(text: string): string {
  return text.replace(/^(核心观点|金句|重点|注意|提示)[：:]\s*(.+)$/gmu, (_match, label, content) => {
    const type = label === "提示" ? "tip" : label === "注意" ? "warning" : "important";
    return `> [!${type}] ${label}\n> ${content}`;
  });
}

function enhanceLooseMarkdown(text: string): string {
  let result = text.replace(/\n{3,}/g, "\n\n");
  if (!/^\s*##\s+/mu.test(result) && !/^\s*#\s+/mu.test(result)) {
    const paragraphs = result.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    if (paragraphs.length >= 2) {
      result = ["## 正文", "", ...paragraphs].join("\n\n");
    }
  }
  result = wrapDialogueBlocks(result);
  result = wrapImageGalleries(result);
  result = wrapKeyCallouts(result);
  return result;
}

function walkFiles(root: string, files: string[] = []): string[] {
  if (!fs.existsSync(root)) return files;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeLocalPath(input: string): string {
  return input.replace(/\\/g, "/");
}

function injectImageLocalPaths(html: string, mappings: ImageInfo[]): string {
  let output = html;
  for (const image of mappings) {
    const escaped = image.placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(`<img([^>]*?)src="${escaped}"`, "g"), `<img$1src="${image.placeholder}" data-local-path="${image.localPath}"`);
  }
  return output;
}

export function convertWikilinks(text: string, vaultRoot: string, outputAssetsDir: string, imageSearchPaths: string[]): { text: string; mappings: ImageInfo[] } {
  const mappings: ImageInfo[] = [];
  const searchRoots = [vaultRoot, ...imageSearchPaths].filter(Boolean);
  ensureDir(outputAssetsDir);

  const replaced = text.replace(/!\[\[([^\]]+)\]\]/g, (_match, rawName) => {
    const filename = String(rawName).split("|")[0]!.trim();
    for (const root of searchRoots) {
      for (const filePath of walkFiles(root)) {
        if (path.basename(filePath) !== filename) continue;
        const dest = path.join(outputAssetsDir, filename);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(filePath, dest);
        }
        const src = `images/${filename}`;
        mappings.push({
          placeholder: src,
          localPath: filePath,
          originalPath: filename,
        });
        return `<section data-role="img-wrapper"><img src="${src}" alt="${filename}" data-local-path="${filePath}"></section>`;
      }
    }
    return `<span style="color:#999;">[图片: ${filename}]</span>`;
  });

  return { text: replaced, mappings };
}

export function copyMarkdownImages(text: string, inputDir: string, outputAssetsDir: string): { text: string; mappings: ImageInfo[] } {
  const mappings: ImageInfo[] = [];
  ensureDir(outputAssetsDir);

  const replaced = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, rawSrc) => {
    const src = String(rawSrc).trim();
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return full;
    }
    const localPath = path.resolve(inputDir, src);
    if (!fs.existsSync(localPath)) {
      return full;
    }
    const fileName = path.basename(localPath);
    const dest = path.join(outputAssetsDir, fileName);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(localPath, dest);
    }
    const rewritten = `images/${fileName}`;
    mappings.push({
      placeholder: rewritten,
      localPath,
      originalPath: src,
    });
    return `![${alt}](images/${fileName})`;
  });

  return { text: replaced, mappings };
}

export function extractLinksAsFootnotes(html: string): { html: string; footnoteHtml: string } {
  const footnotes: Array<[number, string, string]> = [];
  let counter = 0;

  const processed = html.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, (full, href, text) => {
    if (!String(href).startsWith("http")) return full;
    counter += 1;
    footnotes.push([counter, text, href]);
    return `${text}<sup style="${FOOTNOTE_PLACEHOLDERS.footnote_sup}">[${counter}]</sup>`;
  });

  if (!footnotes.length) {
    return { html: processed, footnoteHtml: "" };
  }

  const lines = [
    `<section style="${FOOTNOTE_PLACEHOLDERS.footnote_section}">`,
    `<p style="${FOOTNOTE_PLACEHOLDERS.footnote_title}">参考链接</p>`,
    ...footnotes.map(([index, text, href]) => `<p style="${FOOTNOTE_PLACEHOLDERS.footnote_item}">[${index}] ${text}: ${href}</p>`),
    "</section>",
  ];
  return { html: processed, footnoteHtml: lines.join("\n") };
}

export function processCallouts(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i]?.match(/^>\s*\[!([\w-]+)\]\s*(.*)$/);
    if (!match) {
      result.push(lines[i]!);
      i += 1;
      continue;
    }
    const calloutType = match[1]!;
    const title = match[2]!.trim();
    const contentLines: string[] = [];
    i += 1;
    while (i < lines.length && lines[i]!.startsWith(">")) {
      contentLines.push(lines[i]!.slice(1).trim());
      i += 1;
    }
    result.push(`<div class="callout" data-type="${calloutType}">`);
    if (title) result.push(`<p class="callout-title">${title}</p>`);
    result.push(`<p class="callout-content">${contentLines.join("\n")}</p>`);
    result.push("</div>");
  }

  return result.join("\n");
}

export function processManualFootnotes(text: string): string {
  const footnoteDefs = new Map<number, string>();
  let body = text.replace(/^\[\^(\d+)\]:\s*(.+)$/gmu, (_match, index, content) => {
    footnoteDefs.set(Number(index), content.trim());
    return "";
  });

  if (!footnoteDefs.size) return body;

  body = body.replace(/\n{3,}/g, "\n\n");
  body = body.replace(/\[\^(\d+)\]/g, (_match, index) => `<sup class="manual-footnote" style="${FOOTNOTE_PLACEHOLDERS.footnote_sup}">[${index}]</sup>`);

  const lines = [
    "",
    `<section style="${FOOTNOTE_PLACEHOLDERS.footnote_section}">`,
    `<p style="${FOOTNOTE_PLACEHOLDERS.footnote_title}">注释</p>`,
    ...[...footnoteDefs.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, content]) => `<p style="${FOOTNOTE_PLACEHOLDERS.footnote_item}">[${index}] ${content}</p>`),
    "</section>",
  ];
  return `${body.trimEnd()}\n${lines.join("\n")}\n`;
}

function buildStatHtml(lines: string[]): string {
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  const number = nonEmpty[0] || "";
  const label = nonEmpty[1] || "";
  return `<section data-container="stat"><p data-container="stat-number">${number}</p><p data-container="stat-label">${label}</p></section>`;
}

function buildTimelineHtml(title: string, lines: string[]): string {
  let html = '<section data-container="timeline">';
  if (title) html += `<p data-container="timeline-title">${title}</p>`;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(.+?)\s*[：:]\s*(.+)$/);
    if (!match) continue;
    html += `<section data-container="timeline-item"><span data-container="timeline-time">${match[1]!.trim()}</span><span data-container="timeline-dot">●</span><span data-container="timeline-content">${match[2]!.trim()}</span></section>`;
  }
  html += "</section>";
  return html;
}

function buildStepsHtml(title: string, lines: string[]): string {
  let html = '<section data-container="steps">';
  if (title) html += `<p data-container="steps-title">${title}</p>`;
  let stepNumber = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    stepNumber += 1;
    html += `<section data-container="steps-item"><span data-container="steps-number">${stepNumber}</span><span data-container="steps-content">${line}</span></section>`;
  }
  html += "</section>";
  return html;
}

function buildCompareHtml(title: string, lines: string[]): string {
  let leftName = "";
  let rightName = "";
  if (title.includes(" vs ")) {
    [leftName, rightName] = title.split(" vs ", 2).map((part) => part.trim());
  } else if (title.includes(" VS ")) {
    [leftName, rightName] = title.split(" VS ", 2).map((part) => part.trim());
  }

  let html = '<section data-container="compare">';
  if (leftName || rightName) {
    html += `<section data-container="compare-header"><span data-container="compare-header-left">${leftName}</span><span data-container="compare-header-right">${rightName}</span></section>`;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.includes("|") ? line.split("|", 2) : [line, ""];
    html += `<section data-container="compare-row"><span data-container="compare-left">${parts[0]!.trim()}</span><span data-container="compare-right">${parts[1]!.trim()}</span></section>`;
  }
  html += "</section>";
  return html;
}

function buildQuoteHtml(author: string, lines: string[]): string {
  const content = lines.map((line) => line.trim()).filter(Boolean).join("<br>");
  return `<section data-container="quote-card"><p data-container="quote-mark">❝</p><p data-container="quote-text">${content}</p><p data-container="quote-author">— ${author}</p></section>`;
}

function buildDialogueHtml(title: string, lines: string[]): string {
  const seen: string[] = [];
  const bubbles: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(.+?)\s*[：:]\s*(.+)$/);
    if (!match) continue;
    const speaker = match[1]!.trim();
    if (!seen.includes(speaker)) seen.push(speaker);
    const side = seen.indexOf(speaker) % 2 === 0 ? "left" : "right";
    bubbles.push(`<section data-container="dialogue-bubble" data-side="${side}"><p data-container="dialogue-speaker">${speaker}</p><p data-container="dialogue-text">${match[2]!.trim()}</p></section>`);
  }
  return `<section data-container="dialogue"><p data-container="dialogue-title">${title}</p>${bubbles.join("")}</section>`;
}

function renderBaseMarkdown(content: string): string {
  const renderer = initRenderer({
    citeStatus: false,
    countStatus: false,
    isMacCodeBlock: true,
    isShowLineNumber: false,
    legend: "alt",
  });
  const { html, readingTime } = renderMarkdown(content, renderer);
  return postProcessHtml(html, readingTime, renderer);
}

export function processFencedContainers(text: string): string {
  const containerRe = /^:::(dialogue|gallery|longimage|stat|timeline|steps|compare|quote)(?:\[([^\]]*)])?\s*$/;
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i]?.match(containerRe);
    if (!match) {
      result.push(lines[i]!);
      i += 1;
      continue;
    }

    const containerType = match[1]!;
    const containerTitle = (match[2] || "").trim();
    const contentLines: string[] = [];
    i += 1;
    let depth = 1;
    while (i < lines.length && depth > 0) {
      if (containerRe.test(lines[i]!)) {
        depth += 1;
        contentLines.push(lines[i]!);
      } else if (lines[i]!.trim() === ":::") {
        depth -= 1;
        if (depth > 0) contentLines.push(lines[i]!);
      } else {
        contentLines.push(lines[i]!);
      }
      i += 1;
    }

    const innerText = processFencedContainers(contentLines.join("\n"));
    const innerLines = innerText.split("\n");

    if (containerType === "dialogue") {
      result.push(buildDialogueHtml(containerTitle, innerLines));
    } else if (containerType === "gallery") {
      const innerHtml = renderBaseMarkdown(innerText);
      result.push(`<section data-container="gallery"><p data-container="gallery-title">${containerTitle}</p><section data-container="gallery-scroll">${innerHtml}</section></section>`);
    } else if (containerType === "longimage") {
      const innerHtml = renderBaseMarkdown(innerText);
      result.push(`<section data-container="longimage"><p data-container="longimage-title">${containerTitle}</p><section data-container="longimage-scroll">${innerHtml}</section></section>`);
    } else if (containerType === "stat") {
      result.push(buildStatHtml(innerLines));
    } else if (containerType === "timeline") {
      result.push(buildTimelineHtml(containerTitle, innerLines));
    } else if (containerType === "steps") {
      result.push(buildStepsHtml(containerTitle, innerLines));
    } else if (containerType === "compare") {
      result.push(buildCompareHtml(containerTitle, innerLines));
    } else if (containerType === "quote") {
      result.push(buildQuoteHtml(containerTitle, innerLines));
    }
  }

  return result.join("\n");
}

function buildDarkMode(theme: ThemeConfig): Record<string, Record<string, string>> {
  const darkMode = { ...(theme.dark_mode || {}) };
  const styles = theme.styles || {};
  const autoTags: Record<string, Record<string, string>> = {
    p: { color: "#c8c8c8" },
    strong: { color: "#e0a060" },
    em: { color: "#a0a0a0" },
    h3: { color: "#d0d0d0" },
    h4: { color: "#c8c8c8" },
    h5: { color: "#b0b0b0" },
    h6: { color: "#999999" },
    td: { color: "#c0c0c0", bgcolor: "#1e1e1e" },
    list_item_text: { color: "#c8c8c8" },
    footnote_item: { color: "#888888" },
    footnote_title: { color: "#888888" },
    callout_content: { color: "#c0c0c0" },
  };

  Object.entries(autoTags).forEach(([tag, defaults]) => {
    if (darkMode[tag] || !styles[tag]) return;
    const style = styles[tag] || {};
    if (style.color || style.background || style.background_color) {
      darkMode[tag] = defaults;
    }
  });

  return darkMode;
}

function injectDarkModeAttrs(html: string, darkMode: Record<string, Record<string, string>>, styleMap: Record<string, string>): string {
  let output = html;
  Object.entries(darkMode).forEach(([tagKey, config]) => {
    const style = styleMap[tagKey];
    if (!style) return;
    const attrs: string[] = [];
    if (config.bgcolor) attrs.push(`data-darkmode-bgcolor="${config.bgcolor}"`);
    if (config.color) attrs.push(`data-darkmode-color="${config.color}"`);
    if (!attrs.length) return;
    output = output.replaceAll(`style="${style}"`, `style="${style}" ${attrs.join(" ")}`);
  });
  return output;
}

function basicSyntaxHighlight(codeHtml: string): string {
  let output = codeHtml;
  const keywords = [
    "function", "const", "let", "var", "return", "if", "else", "for", "while",
    "import", "from", "export", "class", "def", "print", "async", "await",
    "try", "catch", "throw", "new", "this", "true", "false", "null", "None",
    "True", "False", "elif", "except", "finally", "with", "as", "in", "not",
    "and", "or", "is", "lambda", "yield", "pass", "break", "continue",
    "type", "interface", "extends", "implements", "abstract", "static",
  ];

  output = output.replace(/(@\w+)/g, '<span style="color:#c586c0">$1</span>');
  output = output.replace(/(?<!:)(\/\/.*?)(<br>|$)/g, '<span style="color:#6a9955">$1</span>$2');
  output = output.replace(/(#[^{].*?)(<br>|$)/g, '<span style="color:#6a9955">$1</span>$2');
  output = output.replace(/(`[^`<]*?`|&quot;.*?&quot;|&#x27;.*?&#x27;|"[^"<]*?"|'[^'<]*?')/g, '<span style="color:#ce9178">$1</span>');
  output = output.replace(/(?<![a-zA-Z0-9_])(\d+\.?\d*)/g, '<span style="color:#b5cea8">$1</span>');
  keywords.forEach((keyword) => {
    output = output.replace(new RegExp(`(?<![a-zA-Z0-9_])(${keyword})(?![a-zA-Z0-9_])`, "g"), '<span style="color:#569cd6">$1</span>');
  });
  return output;
}

function injectContainerStyles(html: string, theme: ThemeConfig): string {
  let output = html;
  const accentHex = theme.colors?.accent || "#07C160";
  const [r, g, b] = hexToRgb(accentHex);
  const rightBubbleBg = `rgba(${r},${g},${b},0.08)`;
  const accent04 = `rgba(${r},${g},${b},0.04)`;
  const accent03 = `rgba(${r},${g},${b},0.03)`;
  const accent15 = `rgba(${r},${g},${b},0.15)`;
  const accent20 = `rgba(${r},${g},${b},0.2)`;

  const replacements: Array<[RegExp | string, string]> = [
    ['<section data-container="dialogue">', '<section data-container="dialogue" style="margin:20px 0;padding:16px;background:#f8f9fa;border-radius:12px">'],
    ['<p data-container="dialogue-title">', '<p data-container="dialogue-title" style="text-align:center;font-size:14px;color:#999;margin-bottom:12px">'],
    [/<section data-container="dialogue-bubble" data-side="left">/g, '<section data-container="dialogue-bubble" data-side="left" style="max-width:80%;background:#fff;border-radius:0 12px 12px 12px;padding:10px 14px;margin:8px 20% 8px 0;box-shadow:0 1px 2px rgba(0,0,0,0.05)">'],
    [/<section data-container="dialogue-bubble" data-side="right">/g, `<section data-container="dialogue-bubble" data-side="right" style="max-width:80%;background:${rightBubbleBg};border-radius:12px 0 12px 12px;padding:10px 14px;margin:8px 0 8px 20%;box-shadow:0 1px 2px rgba(0,0,0,0.05)">`],
    ['<p data-container="dialogue-speaker">', '<p data-container="dialogue-speaker" style="font-size:12px;color:#999;margin-bottom:4px">'],
    ['<p data-container="dialogue-text">', '<p data-container="dialogue-text" style="font-size:15px;color:#333;line-height:1.6;margin:0">'],
    ['<section data-container="gallery">', '<section data-container="gallery" style="margin:20px 0">'],
    ['<p data-container="gallery-title">', '<p data-container="gallery-title" style="text-align:center;font-size:14px;color:#999;margin-bottom:12px">'],
    ['<section data-container="gallery-scroll">', '<section data-container="gallery-scroll" style="display:flex;overflow-x:auto;gap:8px;padding:4px 0;-webkit-overflow-scrolling:touch">'],
    ['<section data-container="longimage">', '<section data-container="longimage" style="margin:20px 0">'],
    ['<p data-container="longimage-title">', '<p data-container="longimage-title" style="text-align:center;font-size:14px;color:#999;margin-bottom:12px">'],
    ['<section data-container="longimage-scroll">', '<section data-container="longimage-scroll" style="max-height:400px;overflow-y:auto;border-radius:8px;border:1px solid #eee">'],
    ['<section data-container="stat">', `<section data-container="stat" style="text-align:center;padding:24px 16px;margin:20px 0;background:${accent04};border-radius:12px">`],
    ['<p data-container="stat-number">', `<p data-container="stat-number" style="font-size:48px;font-weight:800;color:${accentHex};line-height:1.2;margin:0 0 4px 0">`],
    ['<p data-container="stat-label">', '<p data-container="stat-label" style="font-size:14px;color:#666;margin:0">'],
    ['<section data-container="timeline">', '<section data-container="timeline" style="margin:20px 0;padding:16px">'],
    ['<p data-container="timeline-title">', '<p data-container="timeline-title" style="text-align:center;font-size:14px;color:#999;margin-bottom:16px">'],
    ['<section data-container="timeline-item">', '<section data-container="timeline-item" style="display:flex;margin-bottom:12px">'],
    ['<span data-container="timeline-time">', `<span data-container="timeline-time" style="min-width:80px;font-size:14px;font-weight:700;color:${accentHex};text-align:right;padding-right:16px">`],
    ['<span data-container="timeline-dot">', `<span data-container="timeline-dot" style="color:${accentHex};font-size:12px;flex-shrink:0;margin-top:2px;line-height:1">`],
    ['<span data-container="timeline-content">', `<span data-container="timeline-content" style="font-size:15px;color:#333;line-height:1.6;padding-bottom:16px;border-left:2px solid ${accent20};padding-left:12px;margin-left:5px">`],
    ['<section data-container="steps">', '<section data-container="steps" style="margin:20px 0;padding:16px">'],
    ['<p data-container="steps-title">', '<p data-container="steps-title" style="text-align:center;font-size:14px;color:#999;margin-bottom:16px">'],
    ['<section data-container="steps-item">', '<section data-container="steps-item" style="display:flex;align-items:flex-start;margin-bottom:12px">'],
    ['<span data-container="steps-number">', `<span data-container="steps-number" style="display:inline-flex;width:28px;height:28px;border-radius:50%;background:${accentHex};color:#fff;font-size:14px;font-weight:700;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;line-height:1">`],
    ['<span data-container="steps-content">', '<span data-container="steps-content" style="font-size:15px;color:#333;line-height:1.6;padding-top:3px">'],
    ['<section data-container="compare">', '<section data-container="compare" style="margin:20px 0;padding:16px">'],
    ['<section data-container="compare-header">', '<section data-container="compare-header" style="display:flex;margin-bottom:8px">'],
    ['<span data-container="compare-header-left">', `<span data-container="compare-header-left" style="flex:1;text-align:center;font-weight:700;color:${accentHex};padding:8px">`],
    ['<span data-container="compare-header-right">', `<span data-container="compare-header-right" style="flex:1;text-align:center;font-weight:700;color:${accentHex};padding:8px">`],
    ['<section data-container="compare-row">', '<section data-container="compare-row" style="display:flex;border-top:1px solid #eee;padding:8px 0">'],
    ['<span data-container="compare-left">', '<span data-container="compare-left" style="flex:1;text-align:center;font-size:14px;color:#666;padding:8px">'],
    ['<span data-container="compare-right">', '<span data-container="compare-right" style="flex:1;text-align:center;font-size:14px;color:#333;padding:8px;font-weight:600">'],
    ['<section data-container="quote-card">', `<section data-container="quote-card" style="margin:24px 0;padding:20px 24px;background:${accent03};border-radius:12px;border-left:3px solid ${accentHex}">`],
    ['<p data-container="quote-mark">', `<p data-container="quote-mark" style="font-size:36px;color:${accent15};margin:0;line-height:1">`],
    ['<p data-container="quote-text">', '<p data-container="quote-text" style="font-size:17px;color:#333;line-height:1.8;margin:8px 0 12px;font-style:italic">'],
    ['<p data-container="quote-author">', '<p data-container="quote-author" style="font-size:13px;color:#999;text-align:right;margin:0">'],
  ];

  replacements.forEach(([pattern, replacement]) => {
    output = typeof pattern === "string" ? output.replaceAll(pattern, replacement) : output.replace(pattern, replacement);
  });

  output = output.replace(/(<section data-container="gallery-scroll"[^>]*>)([\s\S]*?)(<\/section>)/g, (_match, open, inner, close) => {
    return `${open}${inner.replace(/<img /g, '<img style="height:200px;width:auto;border-radius:8px;flex-shrink:0" ')}${close}`;
  });
  output = output.replace(/(<section data-container="longimage-scroll"[^>]*>)([\s\S]*?)(<\/section>)/g, (_match, open, inner, close) => {
    return `${open}${inner.replace(/<img /g, '<img style="width:100%;display:block" ')}${close}`;
  });

  return output;
}

export function convertListsToSections(html: string, styleMap: Record<string, string>, depth = 0): string {
  const wrapperStyle = styleMap.list_wrapper || "";
  const rowStyle = styleMap.list_item_row || "";
  const bulletStyle = styleMap.list_item_bullet || "";
  const textStyle = styleMap.list_item_text || "";
  const olBulletStyle = styleMap.ol_item_bullet || bulletStyle;
  const indent = depth > 0 ? `padding-left:${16 * depth}px;` : "";

  const stripLegacyListPrefix = (value: string, ordered: boolean): string => {
    const pattern = ordered ? /^\s*\d+[.)]\s*/ : /^\s*[•*-]\s*/;
    return value.replace(pattern, "");
  };

  const processListItem = (itemHtml: string, bullet: string, bulletCss: string, ordered: boolean): string => {
    const nestedUl = itemHtml.match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/);
    const nestedOl = itemHtml.match(/<ol\b[^>]*>([\s\S]*?)<\/ol>/);
    let mainText = itemHtml;
    if (nestedUl?.index !== undefined) {
      mainText = itemHtml.slice(0, nestedUl.index);
    } else if (nestedOl?.index !== undefined) {
      mainText = itemHtml.slice(0, nestedOl.index);
    }
    mainText = mainText.replace(/<\/?p[^>]*>/g, "").trim();
    mainText = stripLegacyListPrefix(mainText, ordered);

    let result = `<section style="${rowStyle}${indent}"><span style="${bulletCss}">${bullet}</span><span style="${textStyle}">${mainText}</span></section>`;
    if (nestedUl) result += convertListsToSections(`<ul>${nestedUl[1]}</ul>`, styleMap, depth + 1);
    if (nestedOl) result += convertListsToSections(`<ol>${nestedOl[1]}</ol>`, styleMap, depth + 1);
    return result;
  };

  const replacedUl = html.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/g, (match) => {
    const items = [...match.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)];
    const rows = items.map((item) => processListItem(item[1]!, "•", bulletStyle, false)).join("");
    return `<section style="${wrapperStyle}${indent}">${rows}</section>`;
  });

  return replacedUl.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/g, (match) => {
    const items = [...match.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)];
    const rows = items.map((item, index) => processListItem(item[1]!, String(index + 1), olBulletStyle, true)).join("");
    return `<section style="${wrapperStyle}${indent}">${rows}</section>`;
  });
}

export function convertCallouts(html: string, styleMap: Record<string, string>): string {
  const calloutStyle = styleMap.callout || "";
  const titleStyle = styleMap.callout_title || "";
  const contentStyle = styleMap.callout_content || "";

  return html.replace(/<div class="callout"[^>]*>([\s\S]*?)<\/div>/g, (full, inner) => {
    const typeMatch = full.match(/data-type="(\w+)"/);
    const calloutType = typeMatch?.[1] || "callout";
    const typeColors = CALLOUT_TYPE_COLORS[calloutType];
    let finalCalloutStyle = calloutStyle;

    if (typeColors) {
      finalCalloutStyle = finalCalloutStyle.replace(/border-left:[^;]+/, `border-left:4px solid ${typeColors.border}`);
      if (/background[^;]*:[^;]+/.test(finalCalloutStyle)) {
        finalCalloutStyle = finalCalloutStyle.replace(/background[^;]*:[^;]+/, `background:${typeColors.bg}`);
      } else {
        finalCalloutStyle += `;background:${typeColors.bg}`;
      }
    }

    const titleMatch = inner.match(/<p class="callout-title">(.*?)<\/p>/);
    const contentMatch = inner.match(/<p class="callout-content">([\s\S]*?)<\/p>/);
    let output = `<section style="${finalCalloutStyle}">`;
    if (titleMatch?.[1]) {
      let titleText = titleMatch[1];
      let finalTitleStyle = titleStyle;
      if (typeColors) {
        titleText = `${typeColors.icon} ${titleText}`;
        finalTitleStyle = finalTitleStyle.replace(/color:[^;]+/, `color:${typeColors.border}`);
      }
      output += `<p style="${finalTitleStyle}">${titleText}</p>`;
    }
    if (contentMatch?.[1]) {
      output += `<p style="${contentStyle}">${contentMatch[1]}</p>`;
    }
    output += "</section>";
    return output;
  });
}

export function convertImageCaptions(html: string): string {
  const captionStyle = "text-align:center;font-size:13px;color:#999999;margin-top:-8px;margin-bottom:16px;font-style:normal";
  let output = html.replace(/(<\/section>\s*)<p[^>]*><em>(.*?)<\/em><\/p>/g, `$1<p style="${captionStyle}">$2</p>`);
  output = output.replace(/(<\/p>\s*)<p[^>]*><em>(.*?)<\/em><\/p>/g, `$1<p style="${captionStyle}">$2</p>`);
  return output;
}

export function injectInlineStyles(html: string, theme: ThemeConfig, skipWrapper = false): string {
  const styleMap: Record<string, string> = {};
  Object.entries(theme.styles).forEach(([tag, props]) => {
    styleMap[tag] = buildStyleString(props);
  });

  let output = convertListsToSections(html, styleMap);
  output = convertCallouts(output, styleMap);

  output = output.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, (_match, content) => {
    let blockquoteContent = content;
    if (styleMap.blockquote_p) {
      blockquoteContent = blockquoteContent.replace(/<p(?![^>]*style)/g, `<p style="${styleMap.blockquote_p}"`);
    }
    return `<blockquote style="${styleMap.blockquote || ""}">${blockquoteContent}</blockquote>`;
  });

  output = output.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, (_match, content) => {
    const protectSpaces = (value: string) => value.split(/(<[^>]+>)/g).map((part) => (part.startsWith("<") ? part : part.replace(/ /g, "&nbsp;"))).join("");
    let preContent = protectSpaces(content).replace(/\n/g, "<br>");
    if (/class="language-/.test(preContent)) {
      preContent = basicSyntaxHighlight(preContent);
    }
    preContent = preContent.replace(/<code[^>]*>/g, `<code style="${styleMap.pre_code || ""}">`);
    const dotBase = "display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px";
    const macHeader = `<section style="${styleMap.code_header || ""}"><span style="${dotBase};background:#FF5F56"></span><span style="${dotBase};background:#FFBD2E"></span><span style="${dotBase};background:#27C93F"></span></section>`;
    return `<section style="${styleMap.code_block || ""}">${macHeader}<pre style="${styleMap.pre || ""}">${preContent}</pre></section>`;
  });

  ["h1", "h2", "h3", "h4", "h5", "h6", "p", "strong", "em", "a", "img", "hr", "code", "table", "th", "td"].forEach((tag) => {
    const style = styleMap[tag];
    if (!style) return;
    if (tag === "hr") {
      output = output.replace(/<hr\s*\/?>/g, `<hr style="${style}">`);
      return;
    }
    if (tag === "img") {
      const imageStyle = style.includes("width") ? style : `${style};width:100%`;
      output = output.replace(/<img(?![^>]*style=) /g, `<img style="${imageStyle}" `);
      return;
    }
    if (tag === "code") {
      output = output.replace(/<code(?![^>]*style)/g, `<code style="${style}"`);
      return;
    }
    output = output.replace(new RegExp(`<${tag}(?![^>]*style)([^>]*)>`, "g"), `<${tag} style="${style}"$1>`);
  });

  output = output.replace(/<del>/g, '<del style="text-decoration:line-through;color:#999">');

  ["h1", "h2", "h3", "h4", "h5", "h6"].forEach((heading) => {
    output = output.replace(new RegExp(`<${heading}\\s[^>]*>[\\s\\S]*?<\\/${heading}>`, "g"), (block) => {
      let fixed = block.replace(/<strong style="([^"]*?)color:[^;]+([^"]*?)">/g, '<strong style="$1color:inherit$2">');
      fixed = fixed.replace(/<em style="([^"]*?)color:[^;]+([^"]*?)">/g, '<em style="$1color:inherit$2">');
      return fixed;
    });
  });

  output = output.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (tableHtml) => {
    const rows = [...tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    let result = tableHtml;
    rows.forEach((row, index) => {
      if (index === 0) return;
      const original = `<tr>${row[1]}</tr>`;
      const bg = index % 2 === 0 ? "background:#f9f9f9;" : "";
      result = result.replace(original, `<tr style="${bg}">${row[1]}</tr>`);
    });
    return result;
  });

  output = injectContainerStyles(output, theme);

  Object.entries(FOOTNOTE_PLACEHOLDERS).forEach(([key, placeholder]) => {
    if (styleMap[key]) {
      output = output.replaceAll(placeholder, styleMap[key]);
    }
  });

  if (styleMap.img_wrapper) {
    output = output.replace(/<section data-role="img-wrapper">/g, `<section data-role="img-wrapper" style="${styleMap.img_wrapper}">`);
  }

  if (styleMap.wrapper && !skipWrapper) {
    output = `<section style="${styleMap.wrapper}">${output}</section>`;
  }

  const darkMode = buildDarkMode(theme);
  if (Object.keys(darkMode).length > 0) {
    output = injectDarkModeAttrs(output, darkMode, styleMap);
  }

  return output;
}

function buildArticleDocument(meta: { title: string; author?: string; summary?: string }, bodyHtml: string): string {
  const metaTags = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    `<title>${meta.title}</title>`,
  ];
  if (meta.author) metaTags.push(`<meta name="author" content="${meta.author}">`);
  if (meta.summary) metaTags.push(`<meta name="description" content="${meta.summary}">`);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
${metaTags.join("\n")}
</head>
<body>
<div id="output">${bodyHtml}</div>
</body>
</html>
`;
}

export function generatePreview(articleHtml: string, footnoteHtml: string, theme: ThemeConfig, title: string, wordCount: number, outputPath: string): string {
  const template = fs.readFileSync(path.join(TEMPLATE_DIR, "preview.html"), "utf-8");
  const fullHtml = footnoteHtml ? `${articleHtml}\n${footnoteHtml}` : articleHtml;
  const previewHtml = template
    .replaceAll("{{TITLE}}", title)
    .replaceAll("{{THEME_NAME}}", theme.name || "")
    .replaceAll("{{WORD_COUNT}}", wordCount.toLocaleString("en-US"))
    .replaceAll("{{ARTICLE_HTML}}", fullHtml);
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, previewHtml, "utf-8");
  return outputPath;
}

export function generateGallery(renderedMap: Record<string, string>, themeMap: Record<string, ThemeConfig>, themeIds: string[], title: string, wordCount: number, outputPath: string, recommended: string[] = []): string {
  const template = fs.readFileSync(path.join(TEMPLATE_DIR, "gallery.html"), "utf-8");
  const defaultTheme = themeIds[0] || "";

  let buttonsHtml = "";
  let index = 0;
  for (const group of GALLERY_GROUPS) {
    const groupIds = group.ids.filter((id) => themeIds.includes(id));
    if (!groupIds.length) continue;
    buttonsHtml += `<div class="theme-group"><span class="group-label">${group.name}</span>`;
    for (const themeId of groupIds) {
      const theme = themeMap[themeId]!;
      const accent = theme.colors?.accent || "#333";
      const active = index === 0 ? " active" : "";
      const recommendedClass = recommended.includes(themeId) ? " recommended" : "";
      const recBadge = recommended.includes(themeId) ? '<span class="rec-badge">推荐</span>' : "";
      buttonsHtml += `<button class="theme-btn${active}${recommendedClass}" data-theme="${themeId}" onclick="switchTheme('${themeId}')"><span class="theme-dot" style="background:${accent}"></span>${theme.name}${recBadge}</button>`;
      index += 1;
    }
    buttonsHtml += "</div>\n";
  }

  const previewsHtml = themeIds
    .map((themeId, idx) => `<div class="theme-preview" data-theme="${themeId}" style="display:${idx === 0 ? "block" : "none"}">${renderedMap[themeId]}</div>`)
    .join("\n");

  const galleryHtml = template
    .replaceAll("{{TITLE}}", title)
    .replaceAll("{{WORD_COUNT}}", wordCount.toLocaleString("en-US"))
    .replaceAll("{{THEME_BUTTONS}}", buttonsHtml)
    .replaceAll("{{THEME_PREVIEWS}}", previewsHtml)
    .replaceAll("{{DEFAULT_THEME}}", defaultTheme);

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, galleryHtml, "utf-8");
  const selectedThemeFile = path.join(os.tmpdir(), "wechat-format", "selected-theme.txt");
  ensureDir(path.dirname(selectedThemeFile));
  fs.writeFileSync(selectedThemeFile, defaultTheme, "utf-8");
  return outputPath;
}

function openInBrowser(filePath: string): void {
  if (process.platform === "darwin") {
    spawnSync("open", [filePath], { stdio: "ignore" });
  } else if (process.platform === "linux") {
    spawnSync("xdg-open", [filePath], { stdio: "ignore" });
  }
}

function renderStructuredMarkdown(markdown: string): string {
  const html = renderBaseMarkdown(markdown);
  return html
    .replace(/<pre class="hljs code__pre">/g, "<pre>")
    .replace(/<code class="language-([^"]*)"/g, '<code class="language-$1"');
}

function normalizeOutputDir(inputPath: string, configuredOutput?: string): string {
  const base = configuredOutput || loadConfig().output_dir || "/tmp/wechat-format";
  const stem = path.basename(inputPath, path.extname(inputPath)).replace(/-(公众号|小红书|微博)$/u, "");
  return path.join(base, stem);
}

function buildContentImages(html: string): ImageInfo[] {
  const contentImages: ImageInfo[] = [];
  const regex = /<img\b[^>]*>/g;
  for (const match of html.matchAll(regex)) {
    const tag = match[0];
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
    const localPath = tag.match(/\bdata-local-path="([^"]+)"/)?.[1];
    if (!src || !localPath) continue;
    contentImages.push({
      placeholder: src,
      localPath,
      originalPath: src,
    });
  }
  return contentImages;
}

export function formatForOutput(content: string, inputPath: string, theme: ThemeConfig, assetsDir: string, vaultRoot: string, imageSearchPaths: string[], outputFormat: "wechat" | "html" | "plain"): {
  html: string;
  footnoteHtml: string;
  title: string;
  author: string;
  summary: string;
  wordCount: number;
  contentImages: ImageInfo[];
} {
  const title = extractTitle(content, inputPath);
  const author = extractAuthor(content);
  const summary = extractSummary(content);
  const wordCount = countWords(content);

  let body = stripFrontmatter(content);
  body = enhanceLooseMarkdown(body);
  body = fixCjkSpacing(body);
  body = fixCjkBoldPunctuation(body);
  body = processCallouts(body);
  body = processManualFootnotes(body);
  body = body.replace(/~~(.+?)~~/g, "<del>$1</del>");

  const wiki = convertWikilinks(body, vaultRoot, assetsDir, imageSearchPaths);
  const mdImages = copyMarkdownImages(wiki.text, path.dirname(inputPath), assetsDir);
  const imageMappings = [...wiki.mappings, ...mdImages.mappings];

  body = processFencedContainers(mdImages.text);

  let html = renderStructuredMarkdown(body);
  html = injectImageLocalPaths(html, imageMappings);

  if (outputFormat === "plain") {
    return { html, footnoteHtml: "", title, author, summary, wordCount, contentImages: buildContentImages(html) };
  }

  const footnotes = extractLinksAsFootnotes(html);
  html = footnotes.html;
  let footnoteHtml = footnotes.footnoteHtml;

  if (outputFormat === "html") {
    const contentImages = buildContentImages(`${html}\n${footnoteHtml}`);
    return { html, footnoteHtml, title, author, summary, wordCount, contentImages };
  }

  html = injectInlineStyles(html, theme);
  if (footnoteHtml) footnoteHtml = injectInlineStyles(footnoteHtml, theme, true);
  html = convertImageCaptions(html);
  if (footnoteHtml) footnoteHtml = convertImageCaptions(footnoteHtml);

  const contentImages = buildContentImages(`${html}\n${footnoteHtml}`);
  return { html, footnoteHtml, title, author, summary, wordCount, contentImages };
}

export function renderMarkdownToWechatHtml(options: RenderOptions): RenderResult {
  const config = loadConfig();
  const inputPath = path.resolve(options.inputPath);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const { id: themeId, theme } = loadTheme(options.theme, options.color);
  const outputDir = normalizeOutputDir(inputPath, options.outputDir);
  const assetsDir = options.assetsDir ? path.resolve(options.assetsDir) : path.join(outputDir, "images");
  const vaultRoot = path.resolve(options.vaultRoot || config.vault_root || process.cwd());
  const imageSearchPaths = (config.image_search_paths || []).map((item) => path.resolve(item));
  const format = options.format || "wechat";

  ensureDir(outputDir);
  ensureDir(assetsDir);

  const rendered = formatForOutput(raw, inputPath, theme, assetsDir, vaultRoot, imageSearchPaths, format);
  const fullBody = rendered.footnoteHtml ? `${rendered.html}\n${rendered.footnoteHtml}` : rendered.html;
  const articleHtml = buildArticleDocument(
    {
      title: rendered.title,
      author: rendered.author || undefined,
      summary: rendered.summary || undefined,
    },
    fullBody,
  );

  const articlePath = path.resolve(options.articleHtmlPath || path.join(outputDir, "article.html"));
  ensureDir(path.dirname(articlePath));
  fs.writeFileSync(articlePath, articleHtml, "utf-8");

  let previewPath: string | undefined;
  let galleryPath: string | undefined;
  let htmlPath = articlePath;

  if (options.gallery) {
    const themeMap: Record<string, ThemeConfig> = {};
    GALLERY_THEMES.forEach((id) => {
      const loaded = loadTheme(id);
      themeMap[id] = loaded.theme;
    });
    const renderedMap: Record<string, string> = {};
    GALLERY_THEMES.forEach((id) => {
      const themed = injectInlineStyles(rendered.html, themeMap[id]!);
      const themedFootnotes = rendered.footnoteHtml ? injectInlineStyles(rendered.footnoteHtml, themeMap[id]!, true) : "";
      renderedMap[id] = convertImageCaptions(themed + (themedFootnotes ? `\n${convertImageCaptions(themedFootnotes)}` : ""));
    });
    galleryPath = path.resolve(options.galleryHtmlPath || path.join(outputDir, "gallery.html"));
    generateGallery(renderedMap, themeMap, GALLERY_THEMES, rendered.title, rendered.wordCount, galleryPath, options.recommend || []);
    htmlPath = galleryPath;
    if (!options.noOpen && config.settings.auto_open_browser) {
      openInBrowser(galleryPath);
    }
  } else {
    previewPath = path.resolve(options.previewHtmlPath || path.join(outputDir, "preview.html"));
    generatePreview(rendered.html, rendered.footnoteHtml, theme, rendered.title, rendered.wordCount, previewPath);
    if (!options.noOpen && config.settings.auto_open_browser) {
      openInBrowser(previewPath);
    }
  }

  return {
    title: rendered.title,
    author: rendered.author,
    summary: rendered.summary,
    htmlPath,
    previewPath,
    galleryPath,
    articlePath,
    contentImages: rendered.contentImages,
    theme: themeId,
    wordCount: rendered.wordCount,
  };
}
