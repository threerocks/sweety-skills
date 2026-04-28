import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  articlePath?: string;
  contentImages: ImageInfo[];
}

function resolveMarkdownToHtmlCli(): string {
  const candidates = [
    path.resolve(__dirname, "../../sweety-markdown-to-html/scripts/main.ts"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("找不到 sweety-markdown-to-html/scripts/main.ts。请先安装 sweety-markdown-to-html skill。");
}

function runMarkdownToHtml(markdownPath: string, options?: { theme?: string; color?: string }): ParsedResult {
  const cliPath = resolveMarkdownToHtmlCli();
  const args = [
    cliPath,
    markdownPath,
    "--format",
    "wechat",
    "--no-open",
  ];
  if (options?.theme) args.push("--theme", options.theme);
  if (options?.color) args.push("--color", options.color);

  const result = spawnSync(process.execPath, args, {
    cwd: path.dirname(markdownPath),
    stdio: ["inherit", "pipe", "pipe"],
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(`sweety-markdown-to-html 转换失败: ${result.stderr || result.stdout}`);
  }

  try {
    return JSON.parse(result.stdout.trim()) as ParsedResult;
  } catch (error) {
    throw new Error(`sweety-markdown-to-html 输出不是合法 JSON: ${error instanceof Error ? error.message : String(error)}\n${result.stdout}`);
  }
}

export async function convertMarkdown(
  markdownPath: string,
  options?: { title?: string; theme?: string; color?: string; citeStatus?: boolean },
): Promise<ParsedResult> {
  const result = runMarkdownToHtml(markdownPath, options);

  return {
    title: options?.title || result.title,
    author: result.author,
    summary: result.summary,
    htmlPath: result.articlePath || result.htmlPath,
    contentImages: result.contentImages,
  };
}

function printUsage(): never {
  console.log(`将 Markdown 转换为微信适配的 HTML

用法:
  npx -y bun md-to-wechat.ts <markdown_file> [options]

选项:
  --title <title>     覆盖标题
  --theme <name>      主题名（由 sweety-markdown-to-html 处理）
  --color <name|hex>  强调色覆盖（建议十六进制值）
  --no-cite           保留兼容参数，当前仅保留接口，不单独改变行为
  --help              显示此帮助

输出 JSON 格式:
{
  "title": "文章标题",
  "htmlPath": "/path/to/article.html",
  "contentImages": [
    {
      "placeholder": "images/demo.png",
      "localPath": "/abs/path/demo.png",
      "originalPath": "demo.png"
    }
  ]
}
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
  }

  let markdownPath: string | undefined;
  let title: string | undefined;
  let theme: string | undefined;
  let color: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--title" && args[i + 1]) title = args[++i];
    else if (arg === "--theme" && args[i + 1]) theme = args[++i];
    else if (arg === "--color" && args[i + 1]) color = args[++i];
    else if ((arg === "--cite" || arg === "--no-cite")) {
      continue;
    } else if (!arg.startsWith("-")) {
      markdownPath = arg;
    }
  }

  if (!markdownPath) {
    console.error("错误: 需要提供 Markdown 文件路径");
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), markdownPath);
  if (!fs.existsSync(resolved)) {
    console.error(`错误: 文件未找到: ${resolved}`);
    process.exit(1);
  }

  const result = await convertMarkdown(resolved, { title, theme, color });
  console.log(JSON.stringify(result, null, 2));
}

await main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
