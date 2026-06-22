import { describe, expect, test } from 'bun:test';
import { buildDraftInput, formatJuejinMarkdown, parseMetadataList, readMarkdownDraft } from './juejin-draft.js';

describe('Juejin draft input', () => {
  test('reads markdown body and frontmatter metadata without changing body text', () => {
    const draft = readMarkdownDraft(`---
title: 安全发布到掘金
brief: 保留 Markdown 原文，只创建可审核草稿。
category: 开发工具
tags: AI编程, OpenAI
cover: ./cover.jpg
---

# 原始标题

正文 **保持 Markdown**。
`);

    expect(draft.body).toBe('# 原始标题\n\n正文 **保持 Markdown**。\n');
    expect(draft.metadata.title).toBe('安全发布到掘金');
    expect(draft.metadata.tags).toEqual(['AI编程', 'OpenAI']);
  });

  test('normalizes repeated CLI tags and comma separated frontmatter tags', () => {
    expect(parseMetadataList(['AI编程', 'OpenAI,AIGC', '  自动化  '])).toEqual(['AI编程', 'OpenAI', 'AIGC', '自动化']);
  });

  test('requires title brief category and one to five tags', () => {
    expect(() => buildDraftInput({ markdownPath: 'article.md', body: '正文', metadata: { title: '标题', brief: '简介', category: '开发工具', tags: [] } })).toThrow('At least one Juejin tag is required');
    expect(() => buildDraftInput({ markdownPath: 'article.md', body: '正文', metadata: { title: '标题', brief: '简介', category: '开发工具', tags: ['1', '2', '3', '4', '5', '6'] } })).toThrow('Juejin supports at most 5 tags');
  });

  test('defaults to draft-only mode unless publish is explicit', () => {
    const draft = buildDraftInput({
      markdownPath: 'article.md',
      body: '正文',
      metadata: { title: '标题', brief: '简介', category: '开发工具', tags: ['AI编程'] },
    });

    expect(draft.shouldPublish).toBe(false);
  });

  test('formats plain X-style text into readable Juejin Markdown without changing visible text', () => {
    const body = [
      '我看到一个 r/webdev 的高赞评论。',
      '',
      '一个成熟的程序员 + Opus/Gpt  >>  一个成熟的程序员 + 一个成熟的程序员',
      '',
      '我们假设给每个留下来的程序员配1万人民币的Token额度，相当于7个20x。那公司的净节省',
      '',
      '4.5W * 8 - 2 * 1W = 34W/月。',
      '',
      '你要问我怎么办？',
      '',
      '前端早就这样了，当老虎要来吃人的时候，有时候不需要跑得比老虎快，只需要跑得比你身边的人快就行。',
    ].join('\n');

    const formatted = formatJuejinMarkdown(body);

    expect(formatted).toContain('## 我看到一个 r/webdev 的高赞评论。');
    expect(formatted).toContain('```text\n一个成熟的程序员 + Opus/Gpt  >>  一个成熟的程序员 + 一个成熟的程序员\n```');
    expect(formatted).toContain('```text\n4.5W * 8 - 2 * 1W = 34W/月。\n```');
    expect(formatted).toContain('## 你要问我怎么办？');
    expect(formatted.replace(/^## /gm, '').replace(/```text\n|```/g, '').replace(/\n{3,}/g, '\n\n').trim()).toBe(body.trim());
  });

  test('keeps existing Markdown structure unchanged', () => {
    const body = '# 标题\n\n> 引用\n\n```ts\nconsole.log(1)\n```\n';

    expect(formatJuejinMarkdown(body)).toBe(body);
  });

  test('does not turn prose paragraphs with comparison symbols into code blocks', () => {
    const body = '而最贵的 20x Codeplan 也只需要 1400元/月  <<  成熟的程序员的月工资。';

    expect(formatJuejinMarkdown(body)).toBe(body);
  });

  test('does not promote ordinary short prose sentences to headings', () => {
    const body = '相信大家其实在小红书、脉脉上也有所耳闻。';

    expect(formatJuejinMarkdown(body)).toBe(body);
  });
});
