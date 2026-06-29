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
type Intensity = "light" | "medium" | "strong";

interface Options {
  input: string;
  output?: string;
  intensity: Intensity;
  keepMetadata: boolean;
  json: boolean;
}

interface Preset {
  attenuate: number; // 噪声强度
  resize: number;    // 重采样比例 (非整数，破坏原始网格)
  unsharp: string;   // IM unsharp 参数
  quality: number;   // JPEG 质量
  modulate?: string; // 轻微亮度扰动 (strong)
}

const PRESETS: Record<Intensity, Preset> = {
  light:  { attenuate: 0.25, resize: 0.96, unsharp: "0x0.4+0.3+0", quality: 88 },
  medium: { attenuate: 0.45, resize: 0.92, unsharp: "0x0.5+0.4+0", quality: 80 },
  strong: { attenuate: 0.70, resize: 0.87, unsharp: "0x0.7+0.5+0", quality: 74, modulate: "100,98,100" },
};

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
  const o: Options = { input: "", intensity: "medium", keepMetadata: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--intensity" || a === "-i") o.intensity = argv[++i] as Intensity;
    else if (a === "--output" || a === "-o") o.output = argv[++i];
    else if (a === "--keep-metadata") o.keepMetadata = true;
    else if (a === "--json") o.json = true;
    else if (!a.startsWith("-")) o.input = a;
  }
  if (!PRESETS[o.intensity]) o.intensity = "medium";
  return o;
}

function defaultOutput(input: string): string {
  const dir = dirname(input);
  const ext = extname(input);
  const base = basename(input, ext);
  return join(dir, `${base}.reprocessed.jpg`);
}

async function runImageMagick(bin: string, o: Options, out: string): Promise<void> {
  const p = PRESETS[o.intensity];
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

async function runSips(o: Options, out: string): Promise<{ warning: string }> {
  // sips 无法加噪声，只能做重采样 + JPEG 重压——降级模式，明确告警。
  const p = PRESETS[o.intensity];
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
    console.error("用法: main.ts <input> [-o output] [--intensity light|medium|strong] [--keep-metadata] [--json]");
    process.exit(2);
  }
  o.input = resolve(o.input);
  if (!existsSync(o.input)) { console.error(`找不到输入文件: ${o.input}`); process.exit(2); }

  const out = resolve(o.output ?? defaultOutput(o.input));
  const det = await detectEngine();
  if (!det) { console.error("未找到图像工具。请 `brew install imagemagick`。"); process.exit(1); }

  const inSize = statSync(o.input).size;
  let warning = "";
  if (det.engine === "imagemagick") {
    await runImageMagick(det.bin, o, out);
  } else {
    ({ warning } = await runSips(o, out));
  }
  const outSize = statSync(out).size;

  const result = {
    engine: det.engine,
    intensity: o.intensity,
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
    console.log(`✅ 重处理完成 [${det.engine} / ${o.intensity}]`);
    console.log(`   输入: ${o.input} (${(inSize / 1024).toFixed(0)} KB)`);
    console.log(`   输出: ${out} (${(outSize / 1024).toFixed(0)} KB)`);
    console.log(`   元数据: ${o.keepMetadata ? "保留" : "已抹除"}`);
    if (warning) console.log(`⚠️  ${warning}`);
  }
}

main().catch((e) => { console.error(`错误: ${e.message}`); process.exit(1); });
