#!/usr/bin/env bun
/**
 * sweety-image-reprocess
 * 像素层重处理链：加真实高斯噪声 → 非均匀锐化 → 非整数重采样 → JPEG 重编码 → 抹元数据。
 * 目的：扰乱扩散模型在频域/噪声层留下的统计指纹，让"半真实"内容降低被 AI 检测器误判的概率。
 *
 * 不解决语义级破绽（六根手指、反光逻辑等）——那要在选图阶段筛掉。
 */
import { existsSync, statSync } from "fs";
import { basename, dirname, extname, join, resolve } from "path";
import { spawn } from "child_process";

type Engine = "imagemagick" | "sips";

interface Options {
  input: string;
  output?: string;
  level: number;        // 1-10 处理强度
  keepMetadata: boolean;
  json: boolean;
}

interface Preset {
  attenuate: number; // 高斯噪声强度
  resize: number;    // 重采样比例 (非整数，破坏原始网格)
  unsharp: string;   // IM unsharp 参数
  quality: number;   // JPEG 质量
  modulate?: string; // 轻微饱和度扰动 (高等级)
}

// 命名别名 → 等级，向后兼容旧的 light/medium/strong
const INTENSITY_ALIAS: Record<string, number> = { light: 2, medium: 5, strong: 8 };

const round2 = (n: number) => Math.round(n * 100) / 100;

// 在等级 1（最轻）与等级 10（最重）之间线性插值出处理参数。
function presetForLevel(level: number): Preset {
  const L = Math.min(10, Math.max(1, Math.round(level)));
  const t = (L - 1) / 9;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const sigma = round2(lerp(0.30, 0.80));
  const amount = round2(lerp(0.25, 0.60));
  const p: Preset = {
    attenuate: round2(lerp(0.12, 0.90)), // 噪声 0.12 → 0.90
    resize: round2(lerp(0.98, 0.82)),    // 重采样 98% → 82%
    quality: Math.round(lerp(92, 66)),   // JPEG 92 → 66
    unsharp: `0x${sigma}+${amount}+0`,
  };
  // 等级 ≥7 才引入轻微饱和度扰动 (100 → ~97.2)
  if (L >= 7) p.modulate = `100,${round2(100 - (L - 6) * 0.7)},100`;
  return p;
}

function sh(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => res({ code: code ?? 1, out, err }));
    p.on("error", () => res({ code: 1, out, err: "spawn error" }));
  });
}

async function which(cmd: string): Promise<boolean> {
  const r = await sh("which", [cmd]);
  return r.code === 0;
}

async function detectEngine(): Promise<{ engine: Engine; bin: string } | null> {
  if (await which("magick")) return { engine: "imagemagick", bin: "magick" };
  if (await which("convert")) return { engine: "imagemagick", bin: "convert" };
  if (await which("sips")) return { engine: "sips", bin: "sips" };
  return null;
}

function parseArgs(argv: string[]): Options {
  const o: Options = { input: "", level: 5, keepMetadata: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--level" || a === "-l") {
      o.level = parseInt(argv[++i], 10);
    } else if (a === "--intensity" || a === "-i") {
      const v = argv[++i];
      o.level = INTENSITY_ALIAS[v] ?? parseInt(v, 10);
    } else if (a === "--output" || a === "-o") o.output = argv[++i];
    else if (a === "--keep-metadata") o.keepMetadata = true;
    else if (a === "--json") o.json = true;
    else if (!a.startsWith("-")) o.input = a;
  }
  if (!Number.isFinite(o.level)) o.level = 5;
  o.level = Math.min(10, Math.max(1, Math.round(o.level)));
  return o;
}

function defaultOutput(input: string): string {
  const dir = dirname(input);
  const ext = extname(input);
  const base = basename(input, ext);
  return join(dir, `${base}.reprocessed.jpg`);
}

async function runImageMagick(bin: string, p: Preset, o: Options, out: string): Promise<void> {
  const args = [o.input];
  // 1. 加真实高斯噪声（覆盖扩散模型的合成噪声指纹）
  args.push("-attenuate", String(p.attenuate), "+noise", "Gaussian");
  // 2. 非均匀锐化（破坏全局纹理规整性）
  args.push("-unsharp", p.unsharp);
  // 3. 轻微亮度扰动（仅 strong）
  if (p.modulate) args.push("-modulate", p.modulate);
  // 4. 非整数重采样（打散原始上采样网格 → 频谱峰位移）
  args.push("-resize", `${Math.round(p.resize * 100)}%`);
  // 5. 抹元数据（去掉生成工具标识）
  if (!o.keepMetadata) args.push("-strip");
  // 6. JPEG 重编码（块状量化进一步淹没高频指纹）
  args.push("-quality", String(p.quality));
  args.push(out);
  const r = await sh(bin, args);
  if (r.code !== 0) throw new Error(`imagemagick failed: ${r.err}`);
}

async function runSips(p: Preset, o: Options, out: string): Promise<{ warning: string }> {
  // sips 无法加噪声，只能做重采样 + JPEG 重压——降级模式，明确告警。
  const wInfo = await sh("sips", ["-g", "pixelWidth", o.input]);
  const m = wInfo.out.match(/pixelWidth:\s*(\d+)/);
  if (!m) throw new Error("sips: cannot read width");
  const newW = Math.max(1, Math.round(parseInt(m[1], 10) * p.resize));
  // 复制到目标并重采样
  let r = await sh("sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(p.quality),
    "--resampleWidth", String(newW), o.input, "--out", out]);
  if (r.code !== 0) throw new Error(`sips failed: ${r.err}`);
  if (!o.keepMetadata) await sh("sips", ["-d", "all", out]); // best-effort 抹元数据
  return { warning: "降级模式：sips 无法注入高斯噪声，频域指纹去除效果弱。强烈建议 `brew install imagemagick` 后重跑。" };
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.input) {
    console.error("用法: main.ts <input> [-o output] [--level 1-10 | --intensity light|medium|strong] [--keep-metadata] [--json]");
    process.exit(2);
  }
  o.input = resolve(o.input);
  if (!existsSync(o.input)) { console.error(`找不到输入文件: ${o.input}`); process.exit(2); }

  const out = resolve(o.output ?? defaultOutput(o.input));
  const det = await detectEngine();
  if (!det) { console.error("未找到图像工具。请 `brew install imagemagick`。"); process.exit(1); }

  const inSize = statSync(o.input).size;
  const preset = presetForLevel(o.level);
  let warning = "";
  if (det.engine === "imagemagick") {
    await runImageMagick(det.bin, preset, o, out);
  } else {
    ({ warning } = await runSips(preset, o, out));
  }
  const outSize = statSync(out).size;

  const result = {
    engine: det.engine,
    level: o.level,
    params: preset,
    input: o.input,
    output: out,
    inputSize: inSize,
    outputSize: outSize,
    metadataStripped: !o.keepMetadata,
    warning: warning || undefined,
  };

  if (o.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`✅ 重处理完成 [${det.engine} / L${o.level}]`);
    console.log(`   输入: ${o.input} (${(inSize / 1024).toFixed(0)} KB)`);
    console.log(`   输出: ${out} (${(outSize / 1024).toFixed(0)} KB)`);
    console.log(`   元数据: ${o.keepMetadata ? "保留" : "已抹除"}`);
    if (warning) console.log(`⚠️  ${warning}`);
  }
}

main().catch((e) => { console.error(`错误: ${e.message}`); process.exit(1); });
