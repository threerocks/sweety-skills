import path from 'node:path';
import process from 'node:process';

import {
  CdpConnection,
  findChromeExecutable as findChromeExecutableBase,
  findExistingChromeDebugPort as findExistingChromeDebugPortBase,
  getFreePort as getFreePortBase,
  launchChrome as launchChromeBase,
  openPageSession,
  resolveSharedChromeProfileDir,
  sleep,
  waitForChromeDebugPort,
  type PlatformCandidates,
} from './vendor/sweety-chrome-cdp/src/index.js';

export { CdpConnection, openPageSession, sleep, waitForChromeDebugPort };

export const CHROME_CANDIDATES: PlatformCandidates = {
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

function getWslWindowsHome(): string | null {
  return null;
}

export function getDefaultProfileDir(): string {
  return resolveSharedChromeProfileDir({
    envNames: ['SWEETY_CHROME_PROFILE_DIR', 'JUEJIN_BROWSER_PROFILE_DIR'],
    wslWindowsHome: getWslWindowsHome(),
  });
}

export async function findExistingChromeDebugPort(profileDir: string): Promise<number | null> {
  return await findExistingChromeDebugPortBase({ profileDir });
}

export async function launchChrome(url: string, profileDir: string, chromePathOverride?: string): Promise<{ chrome: Awaited<ReturnType<typeof launchChromeBase>>; port: number }> {
  const chromePath = chromePathOverride?.trim() || findChromeExecutableBase({
    candidates: CHROME_CANDIDATES,
    envNames: ['JUEJIN_BROWSER_CHROME_PATH', 'X_BROWSER_CHROME_PATH'],
  });
  if (!chromePath) throw new Error('Chrome not found. Set JUEJIN_BROWSER_CHROME_PATH or X_BROWSER_CHROME_PATH.');

  const port = await getFreePortBase('JUEJIN_BROWSER_DEBUG_PORT');
  const chrome = await launchChromeBase({
    chromePath,
    profileDir,
    port,
    url,
    extraArgs: ['--start-maximized'],
  });

  return { chrome, port };
}

export function resolveMaybeRelative(inputPath: string, baseDir: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(baseDir, inputPath);
}

export function jsString(value: string): string {
  return JSON.stringify(value);
}

export function getPlatformAppName(): string {
  if (process.platform === 'darwin') return 'Google Chrome';
  return 'Chrome';
}
