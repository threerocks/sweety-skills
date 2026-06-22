import fs from 'node:fs';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';

import { loadDraftInput } from './juejin-draft.js';
import {
  CdpConnection,
  findExistingChromeDebugPort,
  getDefaultProfileDir,
  jsString,
  launchChrome,
  openPageSession,
  resolveMaybeRelative,
  sleep,
  waitForChromeDebugPort,
} from './juejin-utils.js';

const JUEJIN_EDITOR_URL = 'https://juejin.cn/editor/drafts/new';

interface BrowserOptions {
  markdownPath: string;
  title?: string;
  brief?: string;
  category?: string;
  tags?: string[];
  cover?: string;
  shouldPublish?: boolean;
  profileDir?: string;
  chromePath?: string;
  timeoutMs?: number;
}

async function evaluate<T>(cdp: CdpConnection, sessionId: string, expression: string): Promise<T> {
  const result = await cdp.send<{ result: { value: T } }>('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, { sessionId });
  return result.result.value;
}

async function waitForEditor(cdp: CdpConnection, sessionId: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const isReady = await evaluate<boolean>(cdp, sessionId, `
      Boolean(document.querySelector('.CodeMirror')?.CodeMirror || document.querySelector('textarea, [contenteditable="true"]'))
    `);
    if (isReady) return true;
    await sleep(1000);
  }
  return false;
}

async function fillEditor(cdp: CdpConnection, sessionId: string, title: string, markdown: string): Promise<void> {
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const title = ${jsString(title)};
        const markdown = ${jsString(markdown)};
        const titleInput = [...document.querySelectorAll('input, textarea')]
          .find((el) => /标题|title/i.test(el.getAttribute('placeholder') || '') || el.className.includes('title'));
        if (titleInput) {
          titleInput.focus();
          titleInput.value = title;
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const codeMirror = document.querySelector('.CodeMirror')?.CodeMirror;
        if (codeMirror) {
          codeMirror.focus();
          codeMirror.setValue(markdown);
          return { titleFilled: Boolean(titleInput), markdownFilled: true, mode: 'codemirror' };
        }
        const textarea = document.querySelector('textarea');
        if (textarea) {
          textarea.focus();
          textarea.value = markdown;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          return { titleFilled: Boolean(titleInput), markdownFilled: true, mode: 'textarea' };
        }
        const editable = document.querySelector('[contenteditable="true"]');
        if (editable) {
          editable.focus();
          document.execCommand('insertText', false, markdown);
          return { titleFilled: Boolean(titleInput), markdownFilled: true, mode: 'contenteditable' };
        }
        return { titleFilled: Boolean(titleInput), markdownFilled: false, mode: 'missing' };
      })()
    `,
  }, { sessionId });
}

export function buildFillPublishSettingsExpression(options: { brief: string; category: string; tags: string[] }): string {
  return `
    (async () => {
      const brief = ${jsString(options.brief)};
      const category = ${jsString(options.category)};
      const tags = ${jsString(options.tags.join(','))}.split(',').filter(Boolean);
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const textOf = (el) => (el.textContent || '').replace(/\\s+/g, '').trim();
      const formItem = (label) => [...document.querySelectorAll('.form-item')]
        .find((el) => textOf(el).includes(label));
      const setValue = (el, value) => {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const summaryItem = formItem('编辑摘要') || formItem('摘要');
      const summaryInput = summaryItem?.querySelector('textarea');
      if (!summaryInput) return { ok: false, reason: 'summary-input-missing' };
      setValue(summaryInput, brief);

      const categoryList = document.querySelector('.category-list');
      const categoryOption = categoryList
        ? [...categoryList.querySelectorAll('button, span, div')]
          .find((el) => textOf(el) === category && visible(el))
        : null;
      if (!categoryOption) return { ok: false, reason: 'category-option-missing', category };
      categoryOption.click();

      const tagItem = formItem('添加标签');
      const tagInput = tagItem?.querySelector('input.byte-select__input, input');
      if (!tagInput) return { ok: false, reason: 'tag-input-missing' };

      for (const tag of tags) {
        setValue(tagInput, tag);
        await sleep(700);
        const existing = [...tagItem.querySelectorAll('.byte-select__tag')]
          .some((el) => textOf(el) === tag);
        if (existing) continue;
        const option = [...document.querySelectorAll('button, li, div, span')]
          .find((el) => textOf(el) === tag && visible(el) && !tagItem.querySelector('.byte-select__tag')?.contains(el));
        if (!option) return { ok: false, reason: 'tag-option-missing', tag };
        option.click();
        await sleep(500);
      }

      const selectedCategory = [...document.querySelectorAll('.category-list .active')]
        .map((el) => textOf(el));
      const selectedTags = [...tagItem.querySelectorAll('.byte-select__tag')]
        .map((el) => textOf(el))
        .filter(Boolean);
      return { ok: true, summary: summaryInput.value, selectedCategory, selectedTags };
    })()
  `;
}

async function clickPublishSetup(cdp: CdpConnection, sessionId: string): Promise<boolean> {
  return await evaluate<boolean>(cdp, sessionId, `
    (() => {
      const candidates = [...document.querySelectorAll('button, div, span')]
        .filter((el) => ['发布', '继续发布'].includes((el.textContent || '').trim()));
      const target = candidates.find((el) => !el.closest('[aria-hidden="true"]'));
      if (!target) return false;
      target.click();
      return true;
    })()
  `);
}

async function fillPublishSettings(cdp: CdpConnection, sessionId: string, options: { brief: string; category: string; tags: string[] }): Promise<void> {
  const result = await evaluate<{ ok: boolean; reason?: string; summary?: string; selectedCategory?: string[]; selectedTags?: string[] }>(
    cdp,
    sessionId,
    buildFillPublishSettingsExpression(options),
  );
  if (!result.ok) throw new Error(`Failed to fill Juejin publish settings: ${result.reason ?? 'unknown'}`);
  if (result.summary !== options.brief) throw new Error('Failed to verify Juejin brief after filling publish settings');
  if (!result.selectedCategory?.includes(options.category)) throw new Error(`Failed to verify Juejin category: ${options.category}`);
  const missingTags = options.tags.filter((tag) => !result.selectedTags?.includes(tag));
  if (missingTags.length > 0) throw new Error(`Failed to verify Juejin tags: ${missingTags.join(', ')}`);
}

export function shouldRequireCoverUpload(coverPath: string | undefined): boolean {
  return Boolean(coverPath?.trim());
}

export function buildCoverUploadFailureMessage(coverPath: string): string {
  return [
    `Cover image was provided but Juejin cover upload could not be verified: ${coverPath}`,
    'Final publish was not clicked.',
    'If this run uses the Codex Chrome Extension with ordinary Chrome, open chrome://extensions, choose the Codex extension, enable "Allow access to file URLs", then retry.',
    'If this run uses the CDP script path, make sure the selected Chrome profile is logged in and the Juejin page still exposes the article cover file input.',
  ].join(' ');
}

export function buildChromeExtensionConnectionFailureMessage(): string {
  return [
    'Cannot communicate with the Codex Chrome Extension for ordinary Chrome.',
    'When the user explicitly relies on ordinary Chrome login state, do not switch to the isolated profile because it usually does not have the Juejin login session.',
    'Restore the Codex Chrome Extension connection, then retry the draft or cover upload.',
  ].join(' ');
}

export function buildCoverFileInputExpression(): string {
  return `
    (() => {
      const marker = 'data-sweety-juejin-cover-input';
      const inputs = [...document.querySelectorAll('input[type="file"]')];
      for (const input of inputs) input.removeAttribute(marker);
      const coverItem = [...document.querySelectorAll('.form-item')]
        .find((el) => (el.textContent || '').includes('文章封面'));
      const bodyImageInputs = inputs.filter((input) => input.multiple || String(input.className).includes('file-input'));
      const inCoverItem = coverItem ? [...coverItem.querySelectorAll('input[type="file"]')] : [];
      let target = inCoverItem.find((input) => !input.multiple);
      if (!target) target = inputs.find((input) => !input.multiple && !String(input.className).includes('body-image') && !String(input.className).includes('file-input'));
      if (!target) return { ok: false, reason: 'cover-input-missing', bodyImageInputs: bodyImageInputs.length };
      target.setAttribute(marker, 'true');
      const button = coverItem?.querySelector('button');
      if (button) button.click();
      return { ok: true, marker: '[' + marker + '="true"]', bodyImageInputs: bodyImageInputs.length };
    })()
  `;
}

async function uploadCover(cdp: CdpConnection, sessionId: string, coverPath: string): Promise<boolean> {
  const marked = await evaluate<{ ok: boolean; marker?: string; reason?: string }>(cdp, sessionId, buildCoverFileInputExpression());
  if (!marked.ok || !marked.marker) return false;
  await sleep(1000);
  const inputs = await evaluate<number>(cdp, sessionId, `document.querySelectorAll(${jsString(marked.marker)}).length`);
  if (inputs !== 1) return false;
  await cdp.send('DOM.enable', {}, { sessionId });
  const documentNode = await cdp.send<{ root: { nodeId: number } }>('DOM.getDocument', { depth: -1 }, { sessionId });
  const node = await cdp.send<{ nodeId: number }>('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: marked.marker,
  }, { sessionId });
  if (!node.nodeId) return false;
  await cdp.send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [coverPath] }, { sessionId });
  await sleep(1500);
  return await evaluate<boolean>(cdp, sessionId, `
    (() => {
      const coverItem = [...document.querySelectorAll('.form-item')]
        .find((el) => (el.textContent || '').includes('文章封面'));
      if (!coverItem) return false;
      const uploadText = (coverItem.textContent || '').includes('上传封面');
      const image = coverItem.querySelector('img:not([alt="add_cover"])');
      const styledImage = [...coverItem.querySelectorAll('*')]
        .some((el) => /url\\(["']?https?:|blob:|data:image/.test(el.getAttribute('style') || ''));
      return Boolean(image || styledImage || !uploadText);
    })()
  `);
}

async function clickFinalPublish(cdp: CdpConnection, sessionId: string): Promise<void> {
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const candidates = [...document.querySelectorAll('button')]
          .filter((el) => /确定并发布|发布/.test((el.textContent || '').trim()));
        candidates.at(-1)?.click();
      })()
    `,
  }, { sessionId });
}

export async function openJuejinDraft(options: BrowserOptions): Promise<void> {
  const draft = loadDraftInput(options.markdownPath, {
    title: options.title,
    brief: options.brief,
    category: options.category,
    tags: options.tags,
    cover: options.cover,
    shouldPublish: options.shouldPublish,
  });
  const profileDir = options.profileDir ?? getDefaultProfileDir();
  const timeoutMs = options.timeoutMs ?? 120_000;

  await mkdir(profileDir, { recursive: true });

  const existingPort = await findExistingChromeDebugPort(profileDir);
  const reusing = existingPort !== null;
  let chrome: Awaited<ReturnType<typeof launchChrome>>['chrome'] | null = null;
  let port = existingPort ?? 0;
  if (!reusing) {
    const launched = await launchChrome(JUEJIN_EDITOR_URL, profileDir, options.chromePath);
    chrome = launched.chrome;
    port = launched.port;
  }

  let cdp: CdpConnection | null = null;
  try {
    const wsUrl = await waitForChromeDebugPort(port, 30_000, { includeLastError: true });
    cdp = await CdpConnection.connect(wsUrl, 30_000, { defaultTimeoutMs: 15_000 });
    const page = await openPageSession({
      cdp,
      reusing,
      url: JUEJIN_EDITOR_URL,
      matchTarget: (target) => target.type === 'page' && target.url.includes('juejin.cn'),
      enablePage: true,
      enableRuntime: true,
    });

    const { sessionId } = page;
    const editorReady = await waitForEditor(cdp, sessionId, timeoutMs);
    if (!editorReady) throw new Error('Timed out waiting for Juejin editor. Please log in to Juejin first.');

    await fillEditor(cdp, sessionId, draft.title, draft.body);

    const setupOpened = await clickPublishSetup(cdp, sessionId);
    if (!setupOpened) {
      console.warn('[juejin-browser] Publish settings panel not opened. Title and Markdown were filled; please set cover/category/tags/brief manually.');
      return;
    }

    await sleep(1200);
    await fillPublishSettings(cdp, sessionId, { brief: draft.brief, category: draft.category, tags: draft.tags });

    if (shouldRequireCoverUpload(draft.cover)) {
      const coverPath = resolveMaybeRelative(draft.cover, draft.markdownDir);
      if (!fs.existsSync(coverPath)) throw new Error(`Cover image not found: ${coverPath}`);
      const coverUploaded = await uploadCover(cdp, sessionId, coverPath);
      if (!coverUploaded) throw new Error(buildCoverUploadFailureMessage(coverPath));
    }

    if (draft.shouldPublish) {
      await clickFinalPublish(cdp, sessionId);
      console.log('[juejin-browser] Publish requested. Please verify the final Juejin result in the browser.');
    } else {
      console.log('[juejin-browser] Draft prepared. Review the Juejin publish settings; final publish was not clicked.');
    }
  } finally {
    cdp?.close();
    chrome?.unref();
  }
}

function printUsage(): never {
  console.log(`Post Markdown to Juejin using a logged-in Chrome browser.

Usage:
  bun juejin-browser.ts article.md --title "标题" --brief "简介" --category "开发工具" --tag "AI编程" --cover ./cover.jpg

Options:
  --title <text>      Override frontmatter title
  --brief <text>      Override frontmatter brief/description/summary, max 100 chars
  --category <name>   Override frontmatter category
  --tag <name>        Add tag, repeatable, max 5
  --cover <path>      Override frontmatter cover/cover_image
  --publish           Click final publish after filling settings
  --profile <dir>     Chrome profile directory
  --chrome <path>     Chrome executable path
  --help              Show this help
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  const tags: string[] = [];
  let markdownPath = '';
  let title: string | undefined;
  let brief: string | undefined;
  let category: string | undefined;
  let cover: string | undefined;
  let profileDir: string | undefined;
  let chromePath: string | undefined;
  let shouldPublish = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--title' && args[index + 1]) title = args[++index];
    else if (arg === '--brief' && args[index + 1]) brief = args[++index];
    else if (arg === '--category' && args[index + 1]) category = args[++index];
    else if (arg === '--tag' && args[index + 1]) tags.push(args[++index]!);
    else if (arg === '--cover' && args[index + 1]) cover = args[++index];
    else if (arg === '--profile' && args[index + 1]) profileDir = args[++index];
    else if (arg === '--chrome' && args[index + 1]) chromePath = args[++index];
    else if (arg === '--publish') shouldPublish = true;
    else if (!arg.startsWith('-') && !markdownPath) markdownPath = arg;
  }

  if (!markdownPath) printUsage();

  await openJuejinDraft({
    markdownPath,
    title,
    brief,
    category,
    tags,
    cover,
    shouldPublish,
    profileDir,
    chromePath,
  });
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`[juejin-browser] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
