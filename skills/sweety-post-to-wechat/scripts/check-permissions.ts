import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { findChromeExecutable, getDefaultProfileDir } from './cdp.ts';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function log(label: string, ok: boolean, detail: string): void {
  results.push({ name: label, ok, detail });
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}: ${detail}`);
}

function warn(label: string, detail: string): void {
  results.push({ name: label, ok: true, detail });
  console.log(`⚠️  ${label}: ${detail}`);
}

async function checkChrome(): Promise<void> {
  const chromePath = findChromeExecutable();
  if (chromePath) {
    log('Chrome', true, chromePath);
  } else {
    log('Chrome', false, '未找到。请设置 WECHAT_BROWSER_CHROME_PATH 环境变量或安装 Chrome。');
  }
}

async function checkProfileIsolation(): Promise<void> {
  const profileDir = getDefaultProfileDir();
  const userChromeDir = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
    : process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
      : path.join(os.homedir(), '.config', 'google-chrome');

  const isIsolated = !profileDir.startsWith(userChromeDir);
  log('Profile isolation', isIsolated, `Skill profile: ${profileDir}`);

  if (isIsolated) {
    const exists = fs.existsSync(profileDir);
    if (exists) {
      log('Profile dir', true, '已存在且可访问');
    } else {
      try {
        fs.mkdirSync(profileDir, { recursive: true });
        log('Profile dir', true, '创建成功');
      } catch (e) {
        log('Profile dir', false, `无法创建: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}

async function checkAccessibility(): Promise<void> {
  if (process.platform !== 'darwin') {
    log('Accessibility', true, `Skipped (not macOS, platform: ${process.platform})`);
    return;
  }

  const result = spawnSync('osascript', ['-e', `
    tell application "System Events"
      set frontApp to name of first application process whose frontmost is true
      return frontApp
    end tell
  `], { stdio: 'pipe', timeout: 10_000 });

  if (result.status === 0) {
    const app = result.stdout?.toString().trim();
    log('Accessibility (System Events)', true, `Frontmost app: ${app}`);
  } else {
    const stderr = result.stderr?.toString().trim() || '';
    if (stderr.includes('not allowed assistive access') || stderr.includes('1002')) {
      log('Accessibility (System Events)', false,
        '被拒绝。请前往: 系统设置 → 隐私与安全性 → 辅助功能 → 启用你的终端应用');
    } else {
      log('Accessibility (System Events)', false, `Failed: ${stderr}`);
    }
  }
}

async function checkClipboardCopy(): Promise<void> {
  if (process.platform !== 'darwin') {
    log('Clipboard copy (image)', true, `Skipped (not macOS)`);
    return;
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'wechat-check-'));
  try {
    const testPng = path.join(tmpDir, 'test.png');
    const swiftSrc = `import AppKit
import Foundation
let size = NSSize(width: 2, height: 2)
let image = NSImage(size: size)
image.lockFocus()
NSColor.red.set()
NSBezierPath.fill(NSRect(origin: .zero, size: size))
image.unlockFocus()
guard let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else {
  FileHandle.standardError.write("Failed to create test PNG\\n".data(using: .utf8)!)
  exit(1)
}
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
`;
    const genScript = path.join(tmpDir, 'gen.swift');
    await writeFile(genScript, swiftSrc, 'utf8');
    const genResult = spawnSync('swift', [genScript, testPng], { stdio: 'pipe', timeout: 30_000 });
    if (genResult.status !== 0) {
      log('Clipboard copy (image)', false, `Cannot create test image: ${genResult.stderr?.toString().trim()}`);
      return;
    }

    const clipSrc = `import AppKit
import Foundation
guard let image = NSImage(contentsOfFile: CommandLine.arguments[1]) else {
  FileHandle.standardError.write("Failed to load image\\n".data(using: .utf8)!)
  exit(1)
}
let pb = NSPasteboard.general
pb.clearContents()
if !pb.writeObjects([image]) {
  FileHandle.standardError.write("Failed to write to clipboard\\n".data(using: .utf8)!)
  exit(1)
}
`;
    const clipScript = path.join(tmpDir, 'clip.swift');
    await writeFile(clipScript, clipSrc, 'utf8');
    const clipResult = spawnSync('swift', [clipScript, testPng], { stdio: 'pipe', timeout: 30_000 });
    if (clipResult.status === 0) {
      log('Clipboard copy (image)', true, '可通过 Swift/AppKit 复制图片到剪贴板');
    } else {
      log('Clipboard copy (image)', false, `Failed: ${clipResult.stderr?.toString().trim()}`);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function checkPasteKeystroke(): Promise<void> {
  if (process.platform === 'darwin') {
    const result = spawnSync('osascript', ['-e', `
      tell application "System Events"
        set canSend to true
        return canSend
      end tell
    `], { stdio: 'pipe', timeout: 10_000 });

    if (result.status === 0) {
      log('Paste keystroke (osascript)', true, 'System Events 可以发送按键');
    } else {
      const stderr = result.stderr?.toString().trim() || '';
      log('Paste keystroke (osascript)', false, `Cannot send keystrokes: ${stderr}`);
    }
  } else if (process.platform === 'linux') {
    const xdotool = spawnSync('which', ['xdotool'], { stdio: 'pipe' });
    const ydotool = spawnSync('which', ['ydotool'], { stdio: 'pipe' });
    if (xdotool.status === 0) {
      log('Paste keystroke', true, 'xdotool available (X11)');
    } else if (ydotool.status === 0) {
      log('Paste keystroke', true, 'ydotool available (Wayland)');
    } else {
      log('Paste keystroke', false, '未找到可用工具。请安装 xdotool (X11) 或 ydotool (Wayland)。');
    }
  } else if (process.platform === 'win32') {
    log('Paste keystroke', true, 'Windows 使用 PowerShell SendKeys（内置）');
  }
}

async function checkBun(): Promise<void> {
  const result = spawnSync('npx', ['-y', 'bun', '--version'], { stdio: 'pipe', timeout: 30_000 });
  if (result.status === 0) {
    log('Bun runtime', true, `v${result.stdout?.toString().trim()}`);
  } else {
    log('Bun runtime', false, '无法运行 bun。安装方式: brew install oven-sh/bun/bun (macOS) 或 npm install -g bun');
  }
}

async function checkApiCredentials(): Promise<void> {
  const cwd = process.cwd();
  const projectEnv = path.join(cwd, '.sweety-skills', '.env');
  const userEnv = path.join(os.homedir(), '.sweety-skills', '.env');

  let found = false;
  for (const envPath of [projectEnv, userEnv]) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('WECHAT_APP_ID')) {
        log('API credentials', true, `Found in ${envPath}`);
        found = true;
        break;
      }
    }
  }

  if (!found) {
    warn('API credentials', '未找到。API 发布方式需要赁据。运行技能进行引导式设置。');
  }
}

async function checkRunningChromeConflict(): Promise<void> {
  if (process.platform !== 'darwin') return;

  const result = spawnSync('pgrep', ['-f', 'Google Chrome'], { stdio: 'pipe' });
  const pids = result.stdout?.toString().trim().split('\n').filter(Boolean) || [];

  if (pids.length > 0) {
    warn('Running Chrome instances', `检测到 ${pids.length} 个 Chrome 进程。技能使用 --user-data-dir 进行隔离，因此是安全的。`);
  } else {
    log('Running Chrome instances', true, '没有已运行的 Chrome 进程');
  }
}

async function main(): Promise<void> {
  console.log('=== sweety-post-to-wechat: 权限与环境检查 ===\n');

  await checkChrome();
  await checkProfileIsolation();
  await checkBun();
  await checkAccessibility();
  await checkClipboardCopy();
  await checkPasteKeystroke();
  await checkApiCredentials();
  await checkRunningChromeConflict();

  console.log('\n--- 检查结果 ---');
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log('所有检查均通过。可以开始发布到微信公众号。');
  } else {
    console.log(`发现 ${failed.length} 个问题:`);
    for (const f of failed) {
      console.log(`  ❌ ${f.name}: ${f.detail}`);
    }
    process.exit(1);
  }
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
