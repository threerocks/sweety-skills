import fs from 'node:fs';
import { getDefaultProfileDir } from './juejin-utils.js';

function hasChrome(): boolean {
  return [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].some((candidate) => fs.existsSync(candidate));
}

console.log(JSON.stringify({
  chrome: hasChrome(),
  profileDir: getDefaultProfileDir(),
  notes: [
    'Log in to https://juejin.cn in the opened Chrome profile before first use.',
    'Default behavior prepares a draft and does not click final publish.',
    'If a cover is provided, cover upload is required and failure stops the run.',
    'When using the Codex Chrome extension path, enable "Allow access to file URLs" for local cover uploads.',
  ],
}, null, 2));
