import path from "node:path";
import process from "node:process";

import { GALLERY_THEMES, listThemeIds, renderMarkdownToWechatHtml } from "./engine.ts";

function printUsage(): never {
  console.log(`微信公众号 Markdown 排版工具

用法:
  npx -y bun scripts/main.ts <markdown_path> [options]

选项:
  --theme <id>           主题 ID，支持 30 套主题和 legacy alias(default/grace/simple/modern)
  --gallery              生成主题画廊
  --recommend <id...>    画廊高亮推荐主题
  --format <mode>        wechat(默认) | html | plain
  --output <dir>         输出目录，默认取 config.json/output_dir
  --article-html <file>  指定文章 HTML 输出路径
  --preview-html <file>  指定单主题预览页输出路径
  --gallery-html <file>  指定画廊页输出路径
  --assets-dir <dir>     指定图片素材输出目录
  --vault-root <dir>     Obsidian Vault 根目录
  --color <hex>          覆盖主题强调色
  --no-open              不自动打开浏览器
  --help                 显示帮助

主题:
  ${listThemeIds().join(", ")}

画廊:
  ${GALLERY_THEMES.join(", ")}
`);
  process.exit(0);
}

function parseArgs(argv: string[]): {
  inputPath: string;
  theme?: string;
  color?: string;
  gallery?: boolean;
  recommend?: string[];
  format?: "wechat" | "html" | "plain";
  outputDir?: string;
  articleHtmlPath?: string;
  previewHtmlPath?: string;
  galleryHtmlPath?: string;
  assetsDir?: string;
  vaultRoot?: string;
  noOpen?: boolean;
} {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
  }

  let inputPath = "";
  let theme: string | undefined;
  let color: string | undefined;
  let gallery = false;
  let recommend: string[] = [];
  let format: "wechat" | "html" | "plain" = "wechat";
  let outputDir: string | undefined;
  let articleHtmlPath: string | undefined;
  let previewHtmlPath: string | undefined;
  let galleryHtmlPath: string | undefined;
  let assetsDir: string | undefined;
  let vaultRoot: string | undefined;
  let noOpen = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--theme" && argv[i + 1]) theme = argv[++i];
    else if (arg === "--color" && argv[i + 1]) color = argv[++i];
    else if (arg === "--gallery") gallery = true;
    else if (arg === "--recommend") {
      recommend = [];
      while (argv[i + 1] && !argv[i + 1]!.startsWith("--")) {
        recommend.push(argv[++i]!);
      }
    } else if (arg === "--format" && argv[i + 1]) format = argv[++i] as "wechat" | "html" | "plain";
    else if (arg === "--output" && argv[i + 1]) outputDir = argv[++i];
    else if (arg === "--article-html" && argv[i + 1]) articleHtmlPath = argv[++i];
    else if (arg === "--preview-html" && argv[i + 1]) previewHtmlPath = argv[++i];
    else if (arg === "--gallery-html" && argv[i + 1]) galleryHtmlPath = argv[++i];
    else if (arg === "--assets-dir" && argv[i + 1]) assetsDir = argv[++i];
    else if (arg === "--vault-root" && argv[i + 1]) vaultRoot = argv[++i];
    else if (arg === "--no-open") noOpen = true;
    else if (!arg.startsWith("-") && !inputPath) inputPath = arg;
  }

  if (!inputPath) {
    console.error("错误: 需要提供 Markdown 文件路径");
    process.exit(1);
  }

  return {
    inputPath: path.resolve(process.cwd(), inputPath),
    theme,
    color,
    gallery,
    recommend,
    format,
    outputDir,
    articleHtmlPath,
    previewHtmlPath,
    galleryHtmlPath,
    assetsDir,
    vaultRoot,
    noOpen,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = renderMarkdownToWechatHtml(args);
  console.log(JSON.stringify(result, null, 2));
}

await main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
