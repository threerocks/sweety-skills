import { describe, expect, test } from 'bun:test';
import {
  buildChromeExtensionConnectionFailureMessage,
  buildCoverFileInputExpression,
  buildCoverUploadFailureMessage,
  buildFillPublishSettingsExpression,
  shouldRequireCoverUpload,
} from './juejin-browser.js';

describe('Juejin browser automation contracts', () => {
  test('requires cover upload success when a cover path is supplied', () => {
    expect(shouldRequireCoverUpload('/tmp/cover.png')).toBe(true);
    expect(shouldRequireCoverUpload('')).toBe(false);
    expect(shouldRequireCoverUpload(undefined)).toBe(false);
  });

  test('cover upload expression scopes to article cover and rejects body image inputs', () => {
    const expression = buildCoverFileInputExpression();

    expect(expression).toContain('文章封面');
    expect(expression).toContain('!input.multiple');
    expect(expression).toContain('body-image');
  });

  test('publish settings expression targets summary category and tags by form sections', () => {
    const expression = buildFillPublishSettingsExpression({ brief: '简介', category: '人工智能', tags: ['AI编程', 'AIGC'] });

    expect(expression).toContain('编辑摘要');
    expect(expression).toContain('category-list');
    expect(expression).toContain('添加标签');
    expect(expression).toContain('AI编程');
    expect(expression).toContain('AIGC');
  });

  test('cover upload failure message gives a concrete recovery action', () => {
    const message = buildCoverUploadFailureMessage('/tmp/juejin-cover-192x128.png');

    expect(message).toContain('/tmp/juejin-cover-192x128.png');
    expect(message).toContain('Allow access to file URLs');
    expect(message).toContain('chrome://extensions');
    expect(message).toContain('not clicked');
  });

  test('Chrome extension connection failure message rejects silent profile fallback', () => {
    const message = buildChromeExtensionConnectionFailureMessage();

    expect(message).toContain('Codex Chrome Extension');
    expect(message).toContain('ordinary Chrome');
    expect(message).toContain('do not switch to the isolated profile');
  });
});
