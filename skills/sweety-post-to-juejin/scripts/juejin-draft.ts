import fs from 'node:fs';
import path from 'node:path';

export interface JuejinMetadata {
  title?: string;
  brief?: string;
  category?: string;
  tags?: string[];
  cover?: string;
}

export interface MarkdownDraft {
  body: string;
  metadata: JuejinMetadata;
}

export interface DraftInputOptions {
  markdownPath: string;
  body: string;
  metadata: JuejinMetadata;
  title?: string;
  brief?: string;
  category?: string;
  tags?: string[];
  cover?: string;
  shouldPublish?: boolean;
}

export interface JuejinDraftInput {
  markdownPath: string;
  markdownDir: string;
  body: string;
  title: string;
  brief: string;
  category: string;
  tags: string[];
  cover?: string;
  shouldPublish: boolean;
}

type FrontmatterFields = Record<string, unknown>;

function parseSimpleFrontmatter(content: string): { attributes: FrontmatterFields; body: string } {
  if (!content.startsWith('---\n')) return { attributes: {}, body: content };
  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) return { attributes: {}, body: content };

  const attributes: FrontmatterFields = {};
  const lines = content.slice(4, endIndex).split('\n');
  let activeListKey = '';

  for (const line of lines) {
    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && activeListKey) {
      const current = Array.isArray(attributes[activeListKey]) ? attributes[activeListKey] as string[] : [];
      current.push(stripQuotes(listMatch[1]!));
      attributes[activeListKey] = current;
      continue;
    }

    const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!fieldMatch) continue;
    const key = fieldMatch[1]!;
    const value = fieldMatch[2]!.trim();
    if (value === '') {
      attributes[key] = [];
      activeListKey = key;
    } else {
      attributes[key] = stripQuotes(value);
      activeListKey = '';
    }
  }

  return { attributes, body: content.slice(endIndex + 5).replace(/^\n/, '') };
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function toText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

export function parseMetadataList(values: unknown): string[] {
  const source = Array.isArray(values) ? values : values === undefined ? [] : [values];
  return source
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function readMetadata(attributes: FrontmatterFields): JuejinMetadata {
  return {
    title: toText(attributes.title),
    brief: toText(attributes.brief ?? attributes.description ?? attributes.summary),
    category: toText(attributes.category),
    tags: parseMetadataList(attributes.tags ?? attributes.tag),
    cover: toText(attributes.cover ?? attributes.cover_image ?? attributes.coverImage),
  };
}

export function readMarkdownDraft(content: string): MarkdownDraft {
  const parsed = parseSimpleFrontmatter(content);
  return { body: parsed.body, metadata: readMetadata(parsed.attributes) };
}

function hasMarkdownStructure(body: string): boolean {
  return /(^|\n)(#{1,6}\s|>\s|```|[-*+]\s|\d+\.\s|\|.+\|)/.test(body);
}

function isSectionLikeParagraph(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return false;
  if (/[？?]$/.test(trimmed)) return true;
  return /(评论|声音|怎么办)。$/.test(trimmed) && !/[，,；;：:]/.test(trimmed);
}

function isFormulaLikeParagraph(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (/[，；：]/.test(trimmed)) return false;
  const candidate = trimmed.replace(/[。.]$/, '');
  if (candidate.includes('。')) return false;
  if (/[<>]{2}/.test(candidate)) return !/[。.]$/.test(trimmed);
  const operatorCount = (candidate.match(/[+\-*/=≈]/g) ?? []).length;
  return /\d/.test(candidate) && operatorCount >= 2;
}

export function formatJuejinMarkdown(body: string): string {
  if (hasMarkdownStructure(body)) return body;
  const hasTrailingNewline = body.endsWith('\n');
  const paragraphs = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const formatted = paragraphs
    .map((paragraph) => {
      if (isFormulaLikeParagraph(paragraph)) return `\`\`\`text\n${paragraph}\n\`\`\``;
      if (isSectionLikeParagraph(paragraph)) return `## ${paragraph}`;
      return paragraph;
    })
    .join('\n\n');

  return hasTrailingNewline ? `${formatted}\n` : formatted;
}

function pickField(name: string, cliValue: string | undefined, metadataValue: string | undefined): string {
  const value = cliValue?.trim() || metadataValue?.trim();
  if (!value) throw new Error(`Missing required Juejin field: ${name}`);
  return value;
}

export function buildDraftInput(options: DraftInputOptions): JuejinDraftInput {
  const title = pickField('title', options.title, options.metadata.title);
  const brief = pickField('brief', options.brief, options.metadata.brief);
  const category = pickField('category', options.category, options.metadata.category);
  const tags = parseMetadataList([...(options.metadata.tags ?? []), ...(options.tags ?? [])]);

  if (tags.length === 0) throw new Error('At least one Juejin tag is required');
  if (tags.length > 5) throw new Error('Juejin supports at most 5 tags');
  if (brief.length > 100) throw new Error('Juejin brief must be 100 characters or fewer');
  if (title.length > 80) throw new Error('Juejin title must be 80 characters or fewer');

  return {
    markdownPath: options.markdownPath,
    markdownDir: path.dirname(path.resolve(options.markdownPath)),
    body: formatJuejinMarkdown(options.body),
    title,
    brief,
    category,
    tags,
    cover: options.cover?.trim() || options.metadata.cover,
    shouldPublish: options.shouldPublish === true,
  };
}

export function loadDraftInput(markdownPath: string, overrides: Omit<DraftInputOptions, 'markdownPath' | 'body' | 'metadata'> = {}): JuejinDraftInput {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const draft = readMarkdownDraft(content);
  return buildDraftInput({ markdownPath, body: draft.body, metadata: draft.metadata, ...overrides });
}
