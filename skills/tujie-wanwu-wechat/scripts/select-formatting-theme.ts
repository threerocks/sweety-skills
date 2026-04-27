import fs from "node:fs";
import path from "node:path";
import { inferWechatFormatting, type WorkType, type ThemeSelectionManifestLike } from "./theme-selector.ts";

interface ManifestWithFormatting extends ThemeSelectionManifestLike {
  formatting?: {
    selected_theme?: string | null;
    theme_candidates?: string[];
    theme_selection_mode?: string | null;
    theme_signals?: string[];
    theme_rationale?: string[];
    color?: string | null;
  };
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printUsage(): never {
  console.error(`Usage:
  npx -y bun select-formatting-theme.ts --manifest publish/manifest.json [--file article.md] [--work-type article|poster] [--theme <id>] [--color <hex>]

Behavior:
  - 基于 manifest、可选正文文件和作品类型推断排版主题
  - 显式传入 --theme 时覆盖自动推断
  - 回写 manifest.formatting，并输出决策 JSON`);
  process.exit(1);
}

function main(): void {
  const manifestArg = getArg("--manifest");
  if (!manifestArg) printUsage();

  const manifestPath = path.resolve(manifestArg);
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ManifestWithFormatting
    : {};

  const fileArg = getArg("--file");
  const filePath = fileArg
    ? path.resolve(fileArg)
    : path.join(path.dirname(path.dirname(manifestPath)), manifest.work_type === "poster" ? "poster.md" : "article.md");
  const workType = ((getArg("--work-type") as WorkType | undefined) || manifest.work_type || "article") as WorkType;
  const explicitTheme = getArg("--theme");
  const explicitColor = getArg("--color");

  const formatting = inferWechatFormatting({
    filePath,
    workType,
    manifestPath,
    explicitTheme,
    explicitColor,
  });

  manifest.formatting = {
    selected_theme: formatting.theme,
    theme_candidates: [formatting.theme, ...formatting.alternatives],
    theme_selection_mode: formatting.selectionMode,
    theme_signals: formatting.signals,
    theme_rationale: formatting.rationale,
    color: formatting.color,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: true,
    manifest: manifestPath,
    work_type: workType,
    formatting: manifest.formatting,
  }, null, 2));
}

main();
