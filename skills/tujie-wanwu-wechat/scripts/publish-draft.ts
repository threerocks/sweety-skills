import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inferWechatFormatting } from "./theme-selector.ts";
import { loadTujieConfig } from "./tujie-config.ts";
import { Jimp, JimpMime } from "../../sweety-post-to-wechat/scripts/node_modules/jimp/dist/esm/index.js";

type WorkType = "article" | "poster";

interface PublishManifest {
  status?: string;
  formatting?: {
    selected_theme?: string | null;
    theme_candidates?: string[];
    theme_selection_mode?: string | null;
    theme_signals?: string[];
    theme_rationale?: string[];
    color?: string | null;
  };
  publish?: {
    mode?: string;
    wechat_account_alias?: string | null;
    method?: string;
    max_attempts?: number;
    attempts?: number;
    last_error?: string | null;
    draft_media_id?: string | null;
    history_recorded?: boolean;
    fallback_image_used?: boolean;
    fallback_reason?: string | null;
    fallback_image_path?: string | null;
    fallback_publish_file?: string | null;
    original_image_path?: string | null;
    manual_image_action_required?: boolean;
  };
}

interface PosterFallbackAssets {
  publishFilePath: string;
  fallbackImagePath: string;
  originalImagePath: string;
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun publish-draft.ts <file> --work-type article|poster --account <alias> [--manifest path] [--dry-run]

Behavior:
  - 固定只走 sweety-post-to-wechat 的 wechat-api.ts
  - 未显式传入 --theme 时，按话题、资料、正文内容和作品类型自动推断主题
  - 最多重试 2 次
  - 成功后写入 manifest.publish.draft_media_id
  - 两次都失败后退出并返回错误摘要`);
  process.exit(1);
}

function updateManifest(manifestPath: string, updater: (current: PublishManifest) => PublishManifest): void {
  if (!manifestPath) return;
  const absolutePath = path.resolve(manifestPath);
  const current = fs.existsSync(absolutePath)
    ? JSON.parse(fs.readFileSync(absolutePath, "utf8")) as PublishManifest
    : {};
  const next = updater(current);
  fs.writeFileSync(absolutePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function extractJsonObject(stdout: string): Record<string, unknown> | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    return null;
  }
}

function resolveWechatApiScript(defaultPath: string): string {
  const overridden = process.env.SWEETY_WECHAT_API_SCRIPT?.trim();
  return overridden ? path.resolve(overridden) : defaultPath;
}

function shouldAttemptPosterFallback(
  workType: WorkType,
  reason: string,
  enabled: boolean,
  alreadyUsed: boolean,
): boolean {
  if (workType !== "poster" || !enabled || alreadyUsed) return false;
  return /(45166|invalid content hint|body image|upload failed|image)/i.test(reason);
}

function findFirstLocalMarkdownImage(markdown: string, markdownPath: string): { originalRef: string; absolutePath: string } | null {
  const imageRegex = /!\[[^\]]*]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(imageRegex)) {
    const rawRef = match[1]?.trim();
    if (!rawRef || rawRef.startsWith("http://") || rawRef.startsWith("https://")) continue;
    const cleanRef = rawRef.replace(/^<|>$/g, "").trim();
    if (!cleanRef) continue;
    return {
      originalRef: cleanRef,
      absolutePath: path.resolve(path.dirname(markdownPath), cleanRef),
    };
  }
  return null;
}

async function createSafePreviewFallbackImage(sourcePath: string, outputPath: string): Promise<void> {
  const image = await Jimp.read(sourcePath);
  const targetWidth = Math.min(Math.max(image.bitmap.width, 640), 896);
  image.resize({ w: 48 });
  image.resize({ w: targetWidth });
  const buffer = await image.getBuffer(JimpMime.jpeg, { quality: 68 });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

async function preparePosterFallbackAssets(
  markdownPath: string,
  fallbackMode: string,
  configuredFallbackImage?: string,
): Promise<PosterFallbackAssets> {
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const posterImage = findFirstLocalMarkdownImage(markdown, markdownPath);
  if (!posterImage) {
    throw new Error("poster fallback requires at least one local markdown image");
  }
  if (!fs.existsSync(posterImage.absolutePath)) {
    throw new Error(`poster fallback source image not found: ${posterImage.absolutePath}`);
  }

  const publishDir = path.join(path.dirname(markdownPath), "publish");
  fs.mkdirSync(publishDir, { recursive: true });

  const fallbackImagePath = path.join(publishDir, "poster-api-fallback.jpg");
  const publishFilePath = path.join(
    publishDir,
    `${path.basename(markdownPath, path.extname(markdownPath))}.api-fallback.md`,
  );

  const configuredImagePath = configuredFallbackImage?.trim()
    ? path.resolve(configuredFallbackImage)
    : "";

  if (configuredImagePath) {
    if (!fs.existsSync(configuredImagePath)) {
      throw new Error(`configured poster fallback image not found: ${configuredImagePath}`);
    }
    fs.copyFileSync(configuredImagePath, fallbackImagePath);
  } else {
    const mode = fallbackMode || "safe-preview";
    if (mode !== "safe-preview") {
      throw new Error(`unsupported poster fallback mode: ${mode}`);
    }
    await createSafePreviewFallbackImage(posterImage.absolutePath, fallbackImagePath);
  }

  const fallbackRef = path.relative(path.dirname(markdownPath), fallbackImagePath).split(path.sep).join("/");
  const escapedOriginalRef = posterImage.originalRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const updatedMarkdown = markdown.replace(
    new RegExp(`!\\[([^\\]]*)\\]\\(${escapedOriginalRef}\\)`),
    (_match, altText: string) => `![${altText}](${fallbackRef})`,
  );
  fs.writeFileSync(publishFilePath, updatedMarkdown, "utf8");

  return {
    publishFilePath,
    fallbackImagePath,
    originalImagePath: posterImage.absolutePath,
  };
}

async function main(): Promise<void> {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const fileArg = positional[0];
  const workType = (getArg("--work-type") || "") as WorkType;
  const account = getArg("--account") || "";
  const manifestPath = getArg("--manifest") || "";
  const dryRun = hasFlag("--dry-run");
  const theme = getArg("--theme");
  const color = getArg("--color");
  const cover = getArg("--cover");
  const citeDisabled = hasFlag("--no-cite");

  if (!fileArg || (workType !== "article" && workType !== "poster") || !account) {
    printUsage();
  }

  const filePath = path.resolve(fileArg);
  const articleType = workType === "poster" ? "newspic" : "news";
  const maxAttempts = 2;
  const tujieConfig = loadTujieConfig();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const wechatApiScript = resolveWechatApiScript(
    path.resolve(__dirname, "../../sweety-post-to-wechat/scripts/wechat-api.ts"),
  );
  const formatting = inferWechatFormatting({
    filePath,
    workType,
    manifestPath: manifestPath || undefined,
    explicitTheme: theme,
    explicitColor: color,
  });

  const errors: string[] = [];
  const posterFallbackEnabled = tujieConfig.poster_publish_fallback_enabled ?? true;
  const posterFallbackMode = tujieConfig.poster_publish_fallback_mode || "safe-preview";
  const configuredFallbackImage = tujieConfig.poster_publish_fallback_image;
  let currentFilePath = filePath;
  let fallbackAssets: PosterFallbackAssets | null = null;
  let fallbackTriggered = false;

  updateManifest(manifestPath, (current) => ({
    ...current,
    formatting: {
      selected_theme: formatting.theme,
      theme_candidates: [formatting.theme, ...formatting.alternatives],
      theme_selection_mode: formatting.selectionMode,
      theme_signals: formatting.signals,
      theme_rationale: formatting.rationale,
      color: formatting.color,
    },
    publish: {
      ...(current.publish || {}),
      wechat_account_alias: account,
      fallback_image_used: false,
      fallback_reason: null,
      fallback_image_path: null,
      fallback_publish_file: null,
      original_image_path: null,
      manual_image_action_required: false,
    },
  }));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const args = ["-y", "bun", wechatApiScript, currentFilePath, "--type", articleType, "--account", account];
    args.push("--theme", formatting.theme);
    if (formatting.color) args.push("--color", formatting.color);
    if (cover) args.push("--cover", cover);
    if (citeDisabled) args.push("--no-cite");
    if (dryRun) args.push("--dry-run");

    const result = spawnSync("npx", args, {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    const parsed = extractJsonObject(stdout);

    if (result.status === 0 && parsed) {
      const mediaId = typeof parsed.media_id === "string" ? parsed.media_id : null;
      if (!dryRun) {
        updateManifest(manifestPath, (current) => ({
          ...current,
          status: "completed",
          publish: {
            mode: "draft",
            wechat_account_alias: account,
            method: "api",
            max_attempts: maxAttempts,
            attempts: attempt,
            last_error: null,
            draft_media_id: mediaId,
            history_recorded: current.publish?.history_recorded ?? false,
            fallback_image_used: fallbackTriggered,
            fallback_reason: fallbackTriggered ? (current.publish?.fallback_reason || "poster image fallback published") : null,
            fallback_image_path: fallbackAssets?.fallbackImagePath || null,
            fallback_publish_file: fallbackAssets?.publishFilePath || null,
            original_image_path: fallbackAssets?.originalImagePath || null,
            manual_image_action_required: fallbackTriggered,
          },
        }));
      }

      console.log(JSON.stringify({
        ok: true,
        method: "api",
        article_type: articleType,
        attempts: attempt,
        manual_follow_up: fallbackTriggered ? {
          required: true,
          original_image_path: fallbackAssets?.originalImagePath || null,
          fallback_image_path: fallbackAssets?.fallbackImagePath || null,
          fallback_publish_file: fallbackAssets?.publishFilePath || null,
        } : undefined,
        formatting: {
          selected_theme: formatting.theme,
          theme_candidates: [formatting.theme, ...formatting.alternatives],
          theme_selection_mode: formatting.selectionMode,
          theme_signals: formatting.signals,
          theme_rationale: formatting.rationale,
          color: formatting.color,
        },
        result: parsed,
      }, null, 2));
      return;
    }

    const reason = stderr || stdout || `publish failed with exit code ${result.status ?? 1}`;
    errors.push(`第${attempt}次发布失败：${reason}`);

    if (!dryRun) {
      updateManifest(manifestPath, (current) => ({
        ...current,
        status: "publish_failed",
        publish: {
          mode: "draft",
          wechat_account_alias: account,
          method: "api",
          max_attempts: maxAttempts,
          attempts: attempt,
          last_error: reason,
          draft_media_id: current.publish?.draft_media_id ?? null,
          history_recorded: current.publish?.history_recorded ?? false,
          fallback_image_used: current.publish?.fallback_image_used ?? false,
          fallback_reason: current.publish?.fallback_reason ?? null,
          fallback_image_path: current.publish?.fallback_image_path ?? null,
          fallback_publish_file: current.publish?.fallback_publish_file ?? null,
          original_image_path: current.publish?.original_image_path ?? null,
          manual_image_action_required: current.publish?.manual_image_action_required ?? false,
        },
      }));
    }

    if (attempt < maxAttempts && shouldAttemptPosterFallback(workType, reason, posterFallbackEnabled, fallbackTriggered)) {
      try {
        fallbackAssets = await preparePosterFallbackAssets(filePath, posterFallbackMode, configuredFallbackImage);
        currentFilePath = fallbackAssets.publishFilePath;
        fallbackTriggered = true;
        if (!dryRun) {
          updateManifest(manifestPath, (current) => ({
            ...current,
            publish: {
              ...(current.publish || {}),
              fallback_image_used: true,
              fallback_reason: reason,
              fallback_image_path: fallbackAssets?.fallbackImagePath || null,
              fallback_publish_file: fallbackAssets?.publishFilePath || null,
              original_image_path: fallbackAssets?.originalImagePath || null,
              manual_image_action_required: true,
            },
          }));
        }
      } catch (fallbackError) {
        const fallbackReason = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        errors.push(`海报兜底图准备失败：${fallbackReason}`);
      }
    }
  }

  console.log(JSON.stringify({
    ok: false,
    method: "api",
    article_type: workType === "poster" ? "newspic" : "news",
    attempts: maxAttempts,
    manual_follow_up: fallbackTriggered ? {
      required: true,
      original_image_path: fallbackAssets?.originalImagePath || null,
      fallback_image_path: fallbackAssets?.fallbackImagePath || null,
      fallback_publish_file: fallbackAssets?.publishFilePath || null,
    } : undefined,
    formatting: {
      selected_theme: formatting.theme,
      theme_candidates: [formatting.theme, ...formatting.alternatives],
      theme_selection_mode: formatting.selectionMode,
      theme_signals: formatting.signals,
      theme_rationale: formatting.rationale,
      color: formatting.color,
    },
    errors,
  }, null, 2));
  process.exit(2);
}

void main();
