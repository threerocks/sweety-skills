import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  CdpConnection,
  findChromeExecutable as findChromeExecutableBase,
  findExistingChromeDebugPort as findExistingChromeDebugPortBase,
  getFreePort as getFreePortBase,
  killChrome,
  launchChrome as launchChromeBase,
  openPageSession,
  resolveSharedChromeProfileDir,
  sleep,
  waitForChromeDebugPort,
  type PlatformCandidates,
} from 'sweety-chrome-cdp';

export { CdpConnection, killChrome, openPageSession, sleep, waitForChromeDebugPort };
export type { PlatformCandidates } from 'sweety-chrome-cdp';

export const CHROME_CANDIDATES_BASIC: PlatformCandidates = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  default: [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
};

export const CHROME_CANDIDATES_FULL: PlatformCandidates = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  default: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
  ],
};

export function findChromeExecutable(candidates: PlatformCandidates): string | undefined {
  return findChromeExecutableBase({
    candidates,
    envNames: ['X_BROWSER_CHROME_PATH'],
  });
}

let _wslHome: string | null | undefined;
function getWslWindowsHome(): string | null {
  if (_wslHome !== undefined) return _wslHome;
  if (!process.env.WSL_DISTRO_NAME) { _wslHome = null; return null; }
  try {
    const raw = execSync('cmd.exe /C "echo %USERPROFILE%"', { encoding: 'utf-8', timeout: 5000 }).trim().replace(/\r/g, '');
    _wslHome = execSync(`wslpath -u "${raw}"`, { encoding: 'utf-8', timeout: 5000 }).trim() || null;
  } catch { _wslHome = null; }
  return _wslHome;
}

export function getDefaultProfileDir(): string {
  return resolveSharedChromeProfileDir({
    envNames: ['SWEETY_CHROME_PROFILE_DIR', 'X_BROWSER_PROFILE_DIR'],
    wslWindowsHome: getWslWindowsHome(),
  });
}

export async function getFreePort(): Promise<number> {
  return await getFreePortBase('X_BROWSER_DEBUG_PORT');
}

export async function findExistingChromeDebugPort(profileDir: string): Promise<number | null> {
  return await findExistingChromeDebugPortBase({ profileDir });
}

export async function launchChrome(
  url: string,
  profileDir: string,
  candidates: PlatformCandidates,
  chromePathOverride?: string,
): Promise<{ chrome: Awaited<ReturnType<typeof launchChromeBase>>; port: number }> {
  const chromePath = chromePathOverride?.trim() || findChromeExecutable(candidates);
  if (!chromePath) throw new Error('Chrome not found. Set X_BROWSER_CHROME_PATH env var.');

  const port = await getFreePort();
  const chrome = await launchChromeBase({
    chromePath,
    profileDir,
    port,
    url,
    extraArgs: ['--start-maximized'],
  });

  return { chrome, port };
}

export function getScriptDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function runBunScript(scriptPath: string, args: string[]): boolean {
  const result = spawnSync('npx', ['-y', 'bun', scriptPath, ...args], { stdio: 'inherit' });
  return result.status === 0;
}

export function copyImageToClipboard(imagePath: string): boolean {
  const copyScript = path.join(getScriptDir(), 'copy-to-clipboard.ts');
  return runBunScript(copyScript, ['image', imagePath]);
}

export function copyHtmlToClipboard(htmlPath: string): boolean {
  const copyScript = path.join(getScriptDir(), 'copy-to-clipboard.ts');
  return runBunScript(copyScript, ['html', '--file', htmlPath]);
}

export function pasteFromClipboard(targetApp?: string, retries = 3, delayMs = 500): boolean {
  const pasteScript = path.join(getScriptDir(), 'paste-from-clipboard.ts');
  const args = ['--retries', String(retries), '--delay', String(delayMs)];
  if (targetApp) args.push('--app', targetApp);
  return runBunScript(pasteScript, args);
}
