import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  COLOR_PRESETS,
  FONT_FAMILY_MAP,
  FONT_SIZE_OPTIONS,
  THEME_NAMES,
  extractSummaryFromBody,
  extractTitleFromMarkdown,
  formatTimestamp,
  parseArgs,
  parseFrontmatter,
  renderMarkdownDocument,
  replaceMarkdownImagesWithPlaceholders,
  resolveContentImages,
  serializeFrontmatter,
  stripWrappingQuotes,
} from "./vendor/sweety-md/src/index.ts";
import type { CliOptions, ThemeName } from "./vendor/sweety-md/src/types.ts";

interface ThemeMatch {
  theme: ThemeName;
  score: number;
  reason: string;
}

export function autoDetectTheme(content: string, platform?: string): ThemeMatch {
  const codeBlockCount = (content.match(/```[\s\S]*?```/g) || []).length;
  const inlineCodeCount = (content.match(/`[^`\n]+`/g) || []).length;
  const cjkChars = (content.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const totalChars = content.replace(/\s/g, "").length || 1;
  const cjkRatio = cjkChars / totalChars;
  const headingCount = (content.match(/^#{1,6}\s/gm) || []).length;
  const tableCount = (content.match(/^\|.+\|$/gm) || []).length;
  const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
  const listItemCount = (content.match(/^[\s]*[-*+]\s|^\s*\d+\.\s/gm) || []).length;
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim() && !p.trim().startsWith("#") && !p.trim().startsWith("|") && !p.trim().startsWith("```"));
  const avgParagraphLen = paragraphs.length ? paragraphs.reduce((s, p) => s + p.length, 0) / paragraphs.length : 0;
  const wordCount = content.split(/\s+/).length + cjkChars;
  const hasApiKeywords = /\b(api|sdk|npm|pip|docker|kubernetes|k8s|ci\/cd|devops|graphql|rest)\b/i.test(content);
  const hasLiteraryKeywords = /[\u6563\u6587\u968f\u7b14\u611f\u609f\u601d\u8003\u56de\u5fc6\u5c81\u6708\u5149\u9634\u4eba\u751f\u68a6\u60f3\u5fc3\u7075]/.test(content);
  const hasFestivalKeywords = /[\u6625\u8282\u4e2d\u79cb\u7aef\u5348\u56fd\u5e86\u5143\u65e6\u4f20\u7edf\u6587\u5316\u53e4\u5178\u8bd7\u8bcd\u6b4c\u8d4b]/.test(content);

  if (platform) {
    const p = platform.toLowerCase();
    if (p.includes("juejin") || p.includes("\u6398\u91d1")) return { theme: "juejin", score: 100, reason: "\u76ee\u6807\u5e73\u53f0\u4e3a\u6398\u91d1" };
    if (p.includes("wechat") || p.includes("\u5fae\u4fe1") || p.includes("\u516c\u4f17\u53f7")) return { theme: "wechat-elegant", score: 100, reason: "\u76ee\u6807\u5e73\u53f0\u4e3a\u5fae\u4fe1\u516c\u4f17\u53f7" };
    if (p.includes("twitter") || p.includes("x.com")) return { theme: "condensed", score: 100, reason: "\u76ee\u6807\u5e73\u53f0\u4e3a Twitter/X" };
    if (p.includes("github")) return { theme: "github", score: 100, reason: "\u76ee\u6807\u5e73\u53f0\u4e3a GitHub" };
  }

  const scores: ThemeMatch[] = [];

  let s = 0;
  if (codeBlockCount >= 5) s += 40;
  else if (codeBlockCount >= 2) s += 25;
  if (hasApiKeywords) s += 20;
  if (inlineCodeCount >= 10) s += 15;
  scores.push({ theme: "juejin", score: s, reason: "\u4ee3\u7801\u5757\u591a\u3001\u6280\u672f\u5173\u952e\u8bcd\u591a\uff0c\u9002\u5408\u6280\u672f\u535a\u5ba2\u98ce\u683c" });

  s = 0;
  if (codeBlockCount >= 3) s += 30;
  if (inlineCodeCount >= 8) s += 20;
  if (cjkRatio < 0.1) s += 20;
  scores.push({ theme: "github", score: s, reason: "\u4ee3\u7801\u5757\u591a\u4e14\u82f1\u6587\u4e3a\u4e3b\uff0c\u9002\u5408 GitHub \u98ce\u683c" });

  s = 0;
  if (cjkRatio > 0.3 && codeBlockCount === 0) s += 30;
  if (hasLiteraryKeywords) s += 25;
  if (avgParagraphLen > 150) s += 20;
  scores.push({ theme: "ink", score: s, reason: "\u4e2d\u6587\u6587\u5b66\u6027\u5185\u5bb9\uff0c\u6c34\u58a8\u98ce\u683c\u66f4\u663e\u5178\u96c5" });

  s = 0;
  if (hasFestivalKeywords) s += 40;
  if (cjkRatio > 0.5 && hasLiteraryKeywords) s += 20;
  scores.push({ theme: "chinese-red", score: s, reason: "\u542b\u8282\u65e5/\u4f20\u7edf\u6587\u5316\u5173\u952e\u8bcd\uff0c\u7ea2\u91d1\u914d\u8272\u66f4\u5e94\u666f" });

  s = 0;
  if (cjkRatio > 0.3) s += 15;
  if (imageCount >= 3) s += 10;
  if (codeBlockCount <= 1) s += 10;
  scores.push({ theme: "wechat-elegant", score: s, reason: "\u4e2d\u6587\u5185\u5bb9\u4e3a\u4e3b\uff0c\u5fae\u4fe1\u9605\u8bfb\u4f53\u9a8c\u4f18\u5316" });

  s = 0;
  if (tableCount >= 4) s += 25;
  if (headingCount >= 8) s += 20;
  if (wordCount > 3000) s += 15;
  scores.push({ theme: "tech-blue", score: s, reason: "\u7ed3\u6784\u5316\u5f3a\u3001\u8868\u683c\u591a\uff0c\u9002\u5408\u4e13\u4e1a\u62a5\u544a\u98ce\u683c" });

  s = 0;
  if (imageCount >= 5) s += 20;
  if (codeBlockCount <= 1 && cjkRatio < 0.3) s += 15;
  if (listItemCount >= 8) s += 10;
  scores.push({ theme: "minimalist", score: s, reason: "\u56fe\u7247\u8f83\u591a\u3001\u4ee3\u7801\u8f83\u5c11\uff0c\u6781\u7b80\u98ce\u683c\u7a81\u51fa\u5185\u5bb9" });

  s = 0;
  if (avgParagraphLen > 100 && codeBlockCount <= 2) s += 20;
  if (cjkRatio > 0.2 && cjkRatio < 0.5) s += 10;
  if (imageCount >= 2) s += 10;
  scores.push({ theme: "warm", score: s, reason: "\u6df7\u5408\u5185\u5bb9\uff0c\u6696\u8272\u8c03\u63d0\u5347\u9605\u8bfb\u8212\u9002\u5ea6" });

  s = 0;
  if (avgParagraphLen > 120 && codeBlockCount === 0) s += 25;
  if (hasLiteraryKeywords) s += 15;
  scores.push({ theme: "typewriter", score: s, reason: "\u957f\u6bb5\u843d\u7eaf\u6587\u5b57\u5185\u5bb9\uff0c\u6253\u5b57\u673a\u98ce\u683c\u589e\u5f3a\u6587\u5b57\u8d28\u611f" });

  s = 0;
  if (wordCount < 1500) s += 15;
  if (headingCount <= 3) s += 10;
  scores.push({ theme: "condensed", score: s, reason: "\u77ed\u5c0f\u5185\u5bb9\uff0c\u7d27\u51d1\u98ce\u683c\u6700\u5927\u5316\u4fe1\u606f\u5bc6\u5ea6" });

  s = 0;
  if (cjkRatio > 0.2 && codeBlockCount >= 1 && imageCount >= 1) s += 15;
  scores.push({ theme: "grace", score: s, reason: "\u56fe\u6587\u5e76\u8302\u3001\u4ee3\u7801\u70b9\u7f00\uff0c\u4f18\u96c5\u98ce\u683c\u5e73\u8861\u611f\u5f3a" });

  s = 10;
  if (cjkRatio > 0.3 && codeBlockCount <= 2) s += 10;
  scores.push({ theme: "default", score: s, reason: "\u901a\u7528\u7ecf\u5178\u98ce\u683c\uff0c\u9002\u5408\u5927\u591a\u6570\u573a\u666f" });

  scores.sort((a, b) => b.score - a.score);
  return scores[0]!;
}

interface ImageInfo {
  placeholder: string;
  localPath: string;
  originalPath: string;
}

interface ParsedResult {
  title: string;
  author: string;
  summary: string;
  htmlPath: string;
  backupPath?: string;
  contentImages: ImageInfo[];
}

type ConvertMarkdownOptions = Partial<Omit<CliOptions, "inputPath">> & {
  title?: string;
};

export async function convertMarkdown(
  markdownPath: string,
  options?: ConvertMarkdownOptions,
): Promise<ParsedResult> {
  const baseDir = path.dirname(markdownPath);
  const content = fs.readFileSync(markdownPath, "utf-8");
  const theme = options?.theme;
  const keepTitle = options?.keepTitle ?? false;
  const citeStatus = options?.citeStatus ?? false;

  const { frontmatter, body } = parseFrontmatter(content);

  let title = stripWrappingQuotes(options?.title ?? "")
    || stripWrappingQuotes(frontmatter.title ?? "")
    || extractTitleFromMarkdown(body);
  if (!title) {
    title = path.basename(markdownPath, path.extname(markdownPath));
  }

  const author = stripWrappingQuotes(frontmatter.author ?? "");
  let summary = stripWrappingQuotes(frontmatter.description ?? "")
    || stripWrappingQuotes(frontmatter.summary ?? "");
  if (!summary) {
    summary = extractSummaryFromBody(body, 120);
  }

  const effectiveFrontmatter = options?.title
    ? { ...frontmatter, title }
    : frontmatter;

  const { images, markdown: rewrittenBody } = replaceMarkdownImagesWithPlaceholders(
    body,
    "MDTOHTMLIMGPH_",
  );
  const rewrittenMarkdown = `${serializeFrontmatter(effectiveFrontmatter)}${rewrittenBody}`;

  console.error(
    `[markdown-to-html] Rendering with theme: ${theme ?? "default"}, keepTitle: ${keepTitle}, citeStatus: ${citeStatus}`,
  );

  const { html } = await renderMarkdownDocument(rewrittenMarkdown, {
    codeTheme: options?.codeTheme,
    countStatus: options?.countStatus,
    citeStatus,
    defaultTitle: title,
    fontFamily: options?.fontFamily,
    fontSize: options?.fontSize,
    isMacCodeBlock: options?.isMacCodeBlock,
    isShowLineNumber: options?.isShowLineNumber,
    keepTitle,
    legend: options?.legend,
    primaryColor: options?.primaryColor,
    theme,
  });

  const finalHtmlPath = markdownPath.replace(/\.md$/i, ".html");
  let backupPath: string | undefined;

  if (fs.existsSync(finalHtmlPath)) {
    backupPath = `${finalHtmlPath}.bak-${formatTimestamp()}`;
    console.error(`[markdown-to-html] Backing up existing file to: ${backupPath}`);
    fs.renameSync(finalHtmlPath, backupPath);
  }

  fs.writeFileSync(finalHtmlPath, html, "utf-8");

  const hasRemoteImages = images.some((image) =>
    image.originalPath.startsWith("http://") || image.originalPath.startsWith("https://"),
  );
  const tempDir = hasRemoteImages
    ? fs.mkdtempSync(path.join(os.tmpdir(), "markdown-to-html-"))
    : baseDir;
  const contentImages = await resolveContentImages(images, baseDir, tempDir, "markdown-to-html");

  let finalContent = fs.readFileSync(finalHtmlPath, "utf-8");
  for (const image of contentImages) {
    const imgTag = `<img src="${image.originalPath}" data-local-path="${image.localPath}" style="display: block; width: 100%; margin: 1.5em auto;">`;
    finalContent = finalContent.replace(image.placeholder, imgTag);
  }
  fs.writeFileSync(finalHtmlPath, finalContent, "utf-8");

  console.error(`[markdown-to-html] HTML saved to: ${finalHtmlPath}`);

  return {
    title,
    author,
    summary,
    htmlPath: finalHtmlPath,
    backupPath,
    contentImages,
  };
}

function printUsage(exitCode = 0): never {
  const colorNames = Object.keys(COLOR_PRESETS).join(", ");
  const fontFamilyNames = Object.keys(FONT_FAMILY_MAP).join(", ");

  console.log(`Markdown 转换为带样式的 HTML

用法:
  npx -y bun main.ts <markdown_file> [options]

选项:
  --title <title>         覆盖标题
  --theme <name>          主题名 (${THEME_NAMES.join(", ")}). 默认: default
  --auto                  根据内容自动匹配最佳主题
  --platform <name>       目标平台提示 (juejin, wechat, twitter, github)，配合 --auto 使用
  --color <name|hex>      主色调: ${colorNames}
  --font-family <name>    字体: ${fontFamilyNames}, 或 CSS 值
  --font-size <N>         字号: ${FONT_SIZE_OPTIONS.join(", ")} (默认: 16px)
  --code-theme <name>     代码高亮主题 (默认: github)
  --mac-code-block        显示 Mac 风格代码块头
  --no-mac-code-block     隐藏 Mac 风格代码块头
  --line-number           显示代码块行号
  --cite                  将普通外链转为底部引用. 默认: 关
  --count                 显示阅读时间/字数统计
  --legend <value>        图片说明: title-alt, alt-title, title, alt, none
  --keep-title            保留正文首标题. 默认: false (移除)
  --help                  显示帮助

输出:
  HTML 文件保存到与输入 Markdown 相同的目录.
  示例: article.md -> article.html

  如果 HTML 文件已存在，会先备份:
  article.html -> article.html.bak-YYYYMMDDHHMMSS

输出 JSON 格式:
{
  "title": "文章标题",
  "htmlPath": "/path/to/article.html",
  "backupPath": "/path/to/article.html.bak-20260128180000",
  "autoTheme": "juejin",
  "autoThemeReason": "代码块多、技术关键词多，适合技术博客风格",
  "contentImages": [...]
}

示例:
  npx -y bun main.ts article.md
  npx -y bun main.ts article.md --theme grace
  npx -y bun main.ts article.md --auto
  npx -y bun main.ts article.md --auto --platform wechat
  npx -y bun main.ts article.md --theme modern --color red
  npx -y bun main.ts article.md --cite
`);
  process.exit(exitCode);
}

function parseArgValue(argv: string[], i: number, flag: string): string | null {
  const arg = argv[i]!;
  if (arg.includes("=")) {
    return arg.slice(flag.length + 1);
  }
  const next = argv[i + 1];
  return next ?? null;
}

function extractTitleArg(argv: string[]): { renderArgs: string[]; title?: string; auto?: boolean; platform?: string } {
  let title: string | undefined;
  let auto = false;
  let platform: string | undefined;
  const renderArgs: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--title" || arg.startsWith("--title=")) {
      const value = parseArgValue(argv, i, "--title");
      if (!value) {
        console.error("Missing value for --title");
        printUsage(1);
      }
      title = value;
      if (!arg.includes("=")) {
        i += 1;
      }
      continue;
    }
    if (arg === "--auto") {
      auto = true;
      continue;
    }
    if (arg === "--platform" || arg.startsWith("--platform=")) {
      const value = parseArgValue(argv, i, "--platform");
      if (!value) {
        console.error("Missing value for --platform");
        printUsage(1);
      }
      platform = value;
      if (!arg.includes("=")) {
        i += 1;
      }
      continue;
    }
    renderArgs.push(arg);
  }

  return { renderArgs, title, auto, platform };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage(0);
  }

  const { renderArgs, title, auto, platform } = extractTitleArg(args);
  const options = parseArgs(renderArgs);
  if (!options) {
    printUsage(1);
  }

  const markdownPath = path.resolve(process.cwd(), options.inputPath);
  if (!markdownPath.toLowerCase().endsWith(".md")) {
    console.error("输入文件必须以 .md 结尾");
    process.exit(1);
  }

  if (!fs.existsSync(markdownPath)) {
    console.error(`错误: 文件不存在: ${markdownPath}`);
    process.exit(1);
  }

  let autoTheme: string | undefined;
  let autoThemeReason: string | undefined;

  if (auto) {
    const content = fs.readFileSync(markdownPath, "utf-8");
    const match = autoDetectTheme(content, platform);
    autoTheme = match.theme;
    autoThemeReason = match.reason;
    options.theme = match.theme;
    console.error(`[markdown-to-html] 自动匹配主题: ${match.theme} (${match.reason})`);
  }

  const result = await convertMarkdown(markdownPath, { ...options, title });
  console.log(JSON.stringify({ ...result, autoTheme, autoThemeReason }, null, 2));
}

await main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
