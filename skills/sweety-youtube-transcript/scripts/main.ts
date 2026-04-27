#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";

type Format = "text" | "srt";

interface Options {
  videoIds: string[];
  languages: string[];
  format: Format;
  translate: string;
  list: boolean;
  excludeGenerated: boolean;
  excludeManual: boolean;
  output: string;
  outputDir: string;
  timestamps: boolean;
  chapters: boolean;
  speakers: boolean;
  refresh: boolean;
}

interface Snippet {
  text: string;
  start: number;
  duration: number;
}

interface Sentence {
  text: string;
  start: string;
  end: string;
}

interface TranscriptInfo {
  language: string;
  languageCode: string;
  isGenerated: boolean;
  isTranslatable: boolean;
  baseUrl: string;
  translationLanguages: { language: string; languageCode: string }[];
}

interface Chapter {
  title: string;
  start: number;
  end: number;
}

interface VideoMeta {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  description: string;
  duration: number;
  publishDate: string;
  url: string;
  coverImage: string;
  thumbnailUrl: string;
  language: { code: string; name: string; isGenerated: boolean };
  chapters: Chapter[];
}

interface VideoResult {
  videoId: string;
  title?: string;
  filePath?: string;
  content?: string;
  error?: string;
}

const WATCH_URL = "https://www.youtube.com/watch?v=";
const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player";
const INNERTUBE_CTX = { client: { clientName: "ANDROID", clientVersion: "20.10.38" } };

function extractVideoId(input: string): string {
  input = input.replace(/\\/g, "").trim();
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return input;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

function htmlUnescape(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function parseTranscriptXml(xml: string): Snippet[] {
  const snippets: Snippet[] = [];
  const re = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[3];
    if (!raw) continue;
    snippets.push({
      text: htmlUnescape(stripTags(raw)),
      start: parseFloat(m[1]),
      duration: parseFloat(m[2] || "0"),
    });
  }
  return snippets;
}

// --- YouTube API ---

async function fetchHtml(videoId: string): Promise<string> {
  const r = await fetch(WATCH_URL + videoId, {
    headers: { "Accept-Language": "en-US", "User-Agent": "Mozilla/5.0" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} fetching video page`);
  let html = await r.text();
  if (html.includes('action="https://consent.youtube.com/s"')) {
    const cv = html.match(/name="v" value="(.*?)"/);
    if (!cv) throw new Error("Failed to create consent cookie");
    const r2 = await fetch(WATCH_URL + videoId, {
      headers: {
        "Accept-Language": "en-US",
        "User-Agent": "Mozilla/5.0",
        Cookie: `CONSENT=YES+${cv[1]}`,
      },
    });
    if (!r2.ok) throw new Error(`HTTP ${r2.status} fetching video page (consent)`);
    html = await r2.text();
  }
  return html;
}

function extractApiKey(html: string, videoId: string): string {
  const m = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
  if (!m) {
    if (html.includes('class="g-recaptcha"')) throw new Error(`IP blocked for ${videoId} (reCAPTCHA)`);
    throw new Error(`Cannot extract API key for ${videoId}`);
  }
  return m[1];
}

async function fetchInnertubeData(videoId: string, apiKey: string): Promise<any> {
  const r = await fetch(`${INNERTUBE_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context: INNERTUBE_CTX, videoId }),
  });
  if (r.status === 429) throw new Error(`IP blocked for ${videoId} (429)`);
  if (!r.ok) throw new Error(`HTTP ${r.status} from InnerTube API`);
  return r.json();
}

function assertPlayability(data: any, videoId: string) {
  const ps = data?.playabilityStatus;
  if (!ps) return;
  const status = ps.status;
  if (status === "OK" || !status) return;
  const reason = ps.reason || "";
  if (status === "LOGIN_REQUIRED") {
    if (reason.includes("bot")) throw new Error(`Request blocked for ${videoId}: bot detected`);
    if (reason.includes("inappropriate")) throw new Error(`Age restricted: ${videoId}`);
  }
  if (status === "ERROR" && reason.includes("unavailable")) {
    if (videoId.startsWith("http")) throw new Error(`Invalid video ID: pass the ID, not the URL`);
    throw new Error(`Video unavailable: ${videoId}`);
  }
  const subreasons = ps.errorScreen?.playerErrorMessageRenderer?.subreason?.runs?.map((r: any) => r.text).join("") || "";
  throw new Error(`Video unplayable (${videoId}): ${reason} ${subreasons}`.trim());
}

function extractCaptionsJson(data: any, videoId: string): any {
  assertPlayability(data, videoId);
  const cj = data?.captions?.playerCaptionsTracklistRenderer;
  if (!cj || !cj.captionTracks) throw new Error(`Transcripts disabled for ${videoId}`);
  return cj;
}

function buildTranscriptList(captionsJson: any): TranscriptInfo[] {
  const tlLangs = (captionsJson.translationLanguages || []).map((tl: any) => ({
    language: tl.languageName?.runs?.[0]?.text || tl.languageName?.simpleText || "",
    languageCode: tl.languageCode,
  }));
  return (captionsJson.captionTracks || []).map((t: any) => ({
    language: t.name?.runs?.[0]?.text || t.name?.simpleText || "",
    languageCode: t.languageCode,
    isGenerated: t.kind === "asr",
    isTranslatable: !!t.isTranslatable,
    baseUrl: (t.baseUrl || "").replace(/&fmt=srv3/g, ""),
    translationLanguages: t.isTranslatable ? tlLangs : [],
  }));
}

function findTranscript(
  transcripts: TranscriptInfo[],
  languages: string[],
  excludeGenerated: boolean,
  excludeManual: boolean
): TranscriptInfo {
  let filtered = transcripts;
  if (excludeGenerated) filtered = filtered.filter((t) => !t.isGenerated);
  if (excludeManual) filtered = filtered.filter((t) => t.isGenerated);
  for (const lang of languages) {
    const found = filtered.find((t) => t.languageCode === lang);
    if (found) return found;
  }
  const available = filtered.map((t) => `${t.languageCode} ("${t.language}")`).join(", ");
  throw new Error(`No transcript found for languages [${languages.join(", ")}]. Available: ${available || "none"}`);
}

async function fetchTranscriptSnippets(info: TranscriptInfo, translateTo?: string): Promise<{ snippets: Snippet[]; language: string; languageCode: string }> {
  let url = info.baseUrl;
  let lang = info.language;
  let langCode = info.languageCode;
  if (translateTo) {
    if (!info.isTranslatable) throw new Error(`Transcript ${info.languageCode} is not translatable`);
    const tl = info.translationLanguages.find((t) => t.languageCode === translateTo);
    if (!tl) throw new Error(`Translation language ${translateTo} not available`);
    url += `&tlang=${translateTo}`;
    lang = tl.language;
    langCode = translateTo;
  }
  const r = await fetch(url, { headers: { "Accept-Language": "en-US" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} fetching transcript`);
  return { snippets: parseTranscriptXml(await r.text()), language: lang, languageCode: langCode };
}

// --- Metadata & chapters ---

function parseChapters(description: string, duration: number = 0): Chapter[] {
  const raw: { title: string; start: number }[] = [];
  for (const line of description.split("\n")) {
    const m = line.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/);
    if (m) {
      const h = m[1] ? parseInt(m[1]) : 0;
      raw.push({ title: m[4].trim(), start: h * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) });
    }
  }
  if (raw.length < 2) return [];
  return raw.map((ch, i) => ({
    title: ch.title,
    start: ch.start,
    end: i < raw.length - 1 ? raw[i + 1].start : Math.max(duration, ch.start),
  }));
}

function getThumbnailUrls(videoId: string, data: any): string[] {
  const urls = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];
  const thumbnails = data?.videoDetails?.thumbnail?.thumbnails ||
    data?.microformat?.playerMicroformatRenderer?.thumbnail?.thumbnails || [];
  if (thumbnails.length) {
    const sorted = [...thumbnails].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    for (const t of sorted) if (t.url && !urls.includes(t.url)) urls.push(t.url);
  }
  return urls;
}

function buildVideoMeta(data: any, videoId: string, langInfo: { code: string; name: string; isGenerated: boolean }, chapters: Chapter[]): VideoMeta {
  const vd = data?.videoDetails || {};
  const mf = data?.microformat?.playerMicroformatRenderer || {};
  return {
    videoId,
    title: vd.title || mf.title?.simpleText || "",
    channel: vd.author || mf.ownerChannelName || "",
    channelId: vd.channelId || mf.externalChannelId || "",
    description: vd.shortDescription || mf.description?.simpleText || "",
    duration: parseInt(vd.lengthSeconds || "0"),
    publishDate: mf.publishDate || mf.uploadDate || "",
    url: `https://www.youtube.com/watch?v=${videoId}`,
    coverImage: "",
    thumbnailUrl: getThumbnailUrls(videoId, data)[0],
    language: langInfo,
    chapters,
  };
}

async function downloadCoverImage(urls: string[], outputPath: string): Promise<boolean> {
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) {
        writeFileSync(outputPath, Buffer.from(await r.arrayBuffer()));
        return true;
      }
    } catch {}
  }
  return false;
}

function parseSrt(srt: string): Snippet[] {
  const blocks = srt.trim().split(/\n\n+/);
  const snippets: Snippet[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;
    const m = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!m) continue;
    const start = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000;
    const end = parseInt(m[5]) * 3600 + parseInt(m[6]) * 60 + parseInt(m[7]) + parseInt(m[8]) / 1000;
    snippets.push({ text: lines.slice(2).join(" "), start, duration: end - start });
  }
  return snippets;
}

// --- Timestamp formatting ---

function ts(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function tsMs(t: number, sep: string): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(ms).padStart(3, "0")}`;
}

// --- Paragraph grouping ---

interface Paragraph {
  text: string;
  start: number;
  end: number;
}

function groupIntoParagraphs(snippets: Snippet[]): Paragraph[] {
  if (!snippets.length) return [];
  const paras: Paragraph[] = [];
  let buf: Snippet[] = [];
  for (let i = 0; i < snippets.length; i++) {
    buf.push(snippets[i]);
    const last = i === snippets.length - 1;
    const gap = !last && snippets[i + 1].start - (snippets[i].start + snippets[i].duration) > 1.5;
    if (last || gap || buf.length >= 8) {
      const lastS = buf[buf.length - 1];
      paras.push({ text: buf.map(s => s.text).join(" "), start: buf[0].start, end: lastS.start + lastS.duration });
      buf = [];
    }
  }
  return paras;
}

// --- Sentence segmentation ---

const SENTENCE_END_RE = /[.?!…。？！⁈⁇‼‽．]/;

function isCJK(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 0x4E00 && code <= 0x9FFF) ||
    (code >= 0x3040 && code <= 0x309F) ||
    (code >= 0x30A0 && code <= 0x30FF) ||
    (code >= 0xAC00 && code <= 0xD7AF) ||
    (code >= 0x3400 && code <= 0x4DBF) ||
    (code >= 0xF900 && code <= 0xFAFF);
}

function splitSnippetAtPunctuation(s: Snippet): { text: string; start: number; end: number }[] {
  const { text, start, duration } = s;
  const end = start + duration;
  if (!text.length) return [];

  const splitPoints: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (SENTENCE_END_RE.test(text[i])) {
      while (i + 1 < text.length && SENTENCE_END_RE.test(text[i + 1])) i++;
      if (i < text.length - 1) splitPoints.push(i);
    }
  }

  if (!splitPoints.length) return [{ text, start, end }];

  const parts: { text: string; start: number; end: number }[] = [];
  let prev = 0;
  for (const pos of splitPoints) {
    const partText = text.slice(prev, pos + 1).trim();
    if (partText) {
      parts.push({
        text: partText,
        start: start + (prev / text.length) * duration,
        end: start + ((pos + 1) / text.length) * duration,
      });
    }
    prev = pos + 1;
  }

  const remaining = text.slice(prev).trim();
  if (remaining) {
    parts.push({ text: remaining, start: start + (prev / text.length) * duration, end });
  }

  return parts;
}

function mergeTexts(texts: string[]): string {
  if (!texts.length) return "";
  let result = texts[0];
  for (let i = 1; i < texts.length; i++) {
    const next = texts[i];
    if (!next) continue;
    const lastChar = result[result.length - 1];
    const firstChar = next[0];
    if (isCJK(lastChar) || isCJK(firstChar)) {
      result += next;
    } else {
      result = result.trimEnd() + " " + next.trimStart();
    }
  }
  return result.replace(/ {2,}/g, " ");
}

function segmentIntoSentences(snippets: Snippet[]): Sentence[] {
  const parts: { text: string; start: number; end: number }[] = [];
  for (const s of snippets) parts.push(...splitSnippetAtPunctuation(s));

  const sentences: Sentence[] = [];
  let buf: { text: string; start: number; end: number }[] = [];

  for (const part of parts) {
    buf.push(part);
    if (SENTENCE_END_RE.test(part.text[part.text.length - 1])) {
      sentences.push({
        text: mergeTexts(buf.map(b => b.text)),
        start: ts(buf[0].start),
        end: ts(buf[buf.length - 1].end),
      });
      buf = [];
    }
  }

  if (buf.length) {
    sentences.push({
      text: mergeTexts(buf.map(b => b.text)),
      start: ts(buf[0].start),
      end: ts(buf[buf.length - 1].end),
    });
  }

  return sentences;
}

function parseTs(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function groupSentenceParas(sentences: Sentence[]): Paragraph[] {
  if (!sentences.length) return [];
  const paras: Paragraph[] = [];
  let buf: Sentence[] = [];
  for (let i = 0; i < sentences.length; i++) {
    buf.push(sentences[i]);
    const last = i === sentences.length - 1;
    const gap = !last && parseTs(sentences[i + 1].start) - parseTs(sentences[i].end) > 2;
    if (last || gap || buf.length >= 5) {
      paras.push({
        text: mergeTexts(buf.map(s => s.text)),
        start: parseTs(buf[0].start),
        end: parseTs(buf[buf.length - 1].end),
      });
      buf = [];
    }
  }
  return paras;
}

// --- Format functions ---

function formatSrt(snippets: Snippet[]): string {
  return snippets
    .map((s, i) => {
      const end = i < snippets.length - 1 && snippets[i + 1].start < s.start + s.duration
        ? snippets[i + 1].start
        : s.start + s.duration;
      return `${i + 1}\n${tsMs(s.start, ",")} --> ${tsMs(end, ",")}\n${s.text}`;
    })
    .join("\n\n") + "\n";
}

function yamlEscape(s: string): string {
  if (/[:"'{}\[\]#&*!|>%@`\n]/.test(s) || s.trim() !== s) return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return s;
}

function extractSummary(description: string): string {
  if (!description) return "";
  const firstPara = description.split(/\n\s*\n/)[0].trim();
  const lines = firstPara.split("\n").filter(l => !/^\s*(https?:\/\/|#|@|\d+:\d+)/.test(l) && l.trim());
  return lines.join(" ").slice(0, 300).trim();
}

function formatMarkdown(sentences: Sentence[], meta: VideoMeta, opts: { timestamps: boolean; chapters: boolean; speakers: boolean }, snippets?: Snippet[]): string {
  const summary = extractSummary(meta.description);
  let md = "---\n";
  md += `title: ${yamlEscape(meta.title)}\n`;
  md += `channel: ${yamlEscape(meta.channel)}\n`;
  if (meta.publishDate) md += `date: ${meta.publishDate}\n`;
  md += `url: ${yamlEscape(meta.url)}\n`;
  if (meta.coverImage) md += `cover: ${meta.coverImage}\n`;
  if (summary) md += `description: ${yamlEscape(summary)}\n`;
  if (meta.language) md += `language: ${meta.language.code}\n`;
  md += "---\n\n";

  if (opts.speakers) {
    md += `# ${meta.title}\n\n`;
    if (summary) md += `${summary}\n\n`;
    if (meta.description) md += "# Description\n\n" + meta.description.trim() + "\n\n";
    if (meta.chapters.length) {
      md += "# Chapters\n\n";
      for (const ch of meta.chapters) md += `* [${ts(ch.start)}] ${ch.title}\n`;
      md += "\n";
    }
    md += "# Transcript\n\n";
    md += snippets ? formatSrt(snippets) : "";
    return md;
  }

  md += `# ${meta.title}\n\n`;
  if (summary) md += `${summary}\n\n`;

  const chapters = opts.chapters ? meta.chapters : [];

  if (chapters.length) {
    md += "## Table of Contents\n\n";
    for (const ch of chapters) md += opts.timestamps ? `* [${ts(ch.start)}] ${ch.title}\n` : `* ${ch.title}\n`;
    md += "\n";
    if (meta.coverImage) md += `\n![cover](${meta.coverImage})\n`;
    md += "\n";
    for (let i = 0; i < chapters.length; i++) {
      const nextStart = i < chapters.length - 1 ? chapters[i + 1].start : Infinity;
      const chSentences = sentences.filter(s => parseTs(s.start) >= chapters[i].start && parseTs(s.start) < nextStart);
      const paras = groupSentenceParas(chSentences);
      md += opts.timestamps
        ? `## [${ts(chapters[i].start)}] ${chapters[i].title}\n\n`
        : `## ${chapters[i].title}\n\n`;
      for (const p of paras) md += opts.timestamps ? `${p.text} [${ts(p.start)} → ${ts(p.end)}]\n\n` : `${p.text}\n\n`;
      md += "\n";
    }
  } else {
    const paras = groupSentenceParas(sentences);
    for (const p of paras) md += opts.timestamps ? `${p.text} [${ts(p.start)} → ${ts(p.end)}]\n\n` : `${p.text}\n\n`;
  }

  return md.trimEnd() + "\n";
}

function formatListOutput(videoId: string, title: string, transcripts: TranscriptInfo[]): string {
  const manual = transcripts.filter((t) => !t.isGenerated);
  const generated = transcripts.filter((t) => t.isGenerated);
  const tlLangs = transcripts.find((t) => t.translationLanguages.length > 0)?.translationLanguages || [];
  const fmtList = (list: TranscriptInfo[]) =>
    list.length ? list.map((t) => ` - ${t.languageCode} ("${t.language}")${t.isTranslatable ? " [TRANSLATABLE]" : ""}`).join("\n") : "None";
  const fmtTl = tlLangs.length
    ? tlLangs.map((t) => ` - ${t.languageCode} ("${t.language}")`).join("\n")
    : "None";
  return `Transcripts for ${videoId}${title ? ` (${title})` : ""}:\n\n(MANUALLY CREATED)\n${fmtList(manual)}\n\n(GENERATED)\n${fmtList(generated)}\n\n(TRANSLATION LANGUAGES)\n${fmtTl}`;
}

// --- File helpers ---

function ensureDir(p: string) {
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function resolveBaseDir(outputDir: string): string {
  return resolve(outputDir || "youtube-transcript");
}

function loadIndex(baseDir: string): Record<string, string> {
  try { return JSON.parse(readFileSync(join(baseDir, ".index.json"), "utf-8")); } catch { return {}; }
}

function saveIndex(baseDir: string, index: Record<string, string>) {
  const p = join(baseDir, ".index.json");
  ensureDir(p);
  writeFileSync(p, JSON.stringify(index, null, 2));
}

function lookupVideoDir(videoId: string, baseDir: string): string | null {
  const rel = loadIndex(baseDir)[videoId];
  if (rel) {
    const dir = resolve(baseDir, rel);
    if (existsSync(dir)) return dir;
  }
  return null;
}

function registerVideoDir(videoId: string, channelSlug: string, titleSlug: string, baseDir: string): string {
  const rel = join(channelSlug, titleSlug);
  const index = loadIndex(baseDir);
  index[videoId] = rel;
  saveIndex(baseDir, index);
  return resolve(baseDir, rel);
}

function hasCachedData(videoDir: string): boolean {
  return existsSync(join(videoDir, "meta.json")) && existsSync(join(videoDir, "transcript-raw.json"));
}

function loadMeta(videoDir: string): VideoMeta {
  return JSON.parse(readFileSync(join(videoDir, "meta.json"), "utf-8"));
}

function loadSnippets(videoDir: string): Snippet[] {
  return JSON.parse(readFileSync(join(videoDir, "transcript-raw.json"), "utf-8"));
}

function loadSentences(videoDir: string): Sentence[] {
  return JSON.parse(readFileSync(join(videoDir, "transcript-sentences.json"), "utf-8"));
}

// --- Main processing ---

async function fetchAndCache(videoId: string, baseDir: string, opts: Options): Promise<{ meta: VideoMeta; snippets: Snippet[]; sentences: Sentence[]; videoDir: string }> {
  const html = await fetchHtml(videoId);
  const apiKey = extractApiKey(html, videoId);
  const data = await fetchInnertubeData(videoId, apiKey);
  const captionsJson = extractCaptionsJson(data, videoId);
  const transcripts = buildTranscriptList(captionsJson);
  const info = findTranscript(transcripts, opts.languages, opts.excludeGenerated, opts.excludeManual);
  const result = await fetchTranscriptSnippets(info, opts.translate || undefined);
  const description = data?.videoDetails?.shortDescription || "";
  const duration = parseInt(data?.videoDetails?.lengthSeconds || "0");
  const chapters = parseChapters(description, duration);
  const langInfo = { code: result.languageCode, name: result.language, isGenerated: info.isGenerated };
  const meta = buildVideoMeta(data, videoId, langInfo, chapters);

  const videoDir = registerVideoDir(videoId, slugify(meta.channel), slugify(meta.title), baseDir);
  ensureDir(join(videoDir, "meta.json"));

  writeFileSync(join(videoDir, "transcript-raw.json"), JSON.stringify(result.snippets, null, 2));

  const sentences = segmentIntoSentences(result.snippets);
  writeFileSync(join(videoDir, "transcript-sentences.json"), JSON.stringify(sentences, null, 2));

  const imgPath = join(videoDir, "imgs", "cover.jpg");
  ensureDir(imgPath);
  const downloaded = await downloadCoverImage(getThumbnailUrls(videoId, data), imgPath);
  meta.coverImage = downloaded ? "imgs/cover.jpg" : "";

  writeFileSync(join(videoDir, "meta.json"), JSON.stringify(meta, null, 2));

  return { meta, snippets: result.snippets, sentences, videoDir };
}

async function processVideo(videoId: string, opts: Options): Promise<VideoResult> {
  const baseDir = resolveBaseDir(opts.outputDir);

  // --list: always fetch fresh
  if (opts.list) {
    const html = await fetchHtml(videoId);
    const apiKey = extractApiKey(html, videoId);
    const data = await fetchInnertubeData(videoId, apiKey);
    const title = data?.videoDetails?.title || "";
    const captionsJson = extractCaptionsJson(data, videoId);
    const transcripts = buildTranscriptList(captionsJson);
    return { videoId, title, content: formatListOutput(videoId, title, transcripts) };
  }

  let videoDir = lookupVideoDir(videoId, baseDir);
  let meta: VideoMeta;
  let snippets: Snippet[];
  let sentences: Sentence[];
  let needsFetch = opts.refresh || !videoDir || !hasCachedData(videoDir);

  if (!needsFetch && videoDir) {
    meta = loadMeta(videoDir);
    snippets = loadSnippets(videoDir);
    sentences = loadSentences(videoDir);
    const wantLangs = opts.translate ? [opts.translate] : opts.languages;
    if (!wantLangs.includes(meta.language.code)) needsFetch = true;
    // Backfill chapter end times for caches created before this field existed
    if (!needsFetch && meta.chapters.length > 0 && meta.chapters.some((ch: any) => ch.end === undefined)) {
      for (let i = 0; i < meta.chapters.length; i++) {
        meta.chapters[i].end = i < meta.chapters.length - 1
          ? meta.chapters[i + 1].start
          : Math.max(meta.duration, meta.chapters[i].start);
      }
      try { writeFileSync(join(videoDir, "meta.json"), JSON.stringify(meta, null, 2)); } catch {}
    }
  }

  if (needsFetch) {
    const result = await fetchAndCache(videoId, baseDir, opts);
    meta = result.meta;
    snippets = result.snippets;
    sentences = result.sentences;
    videoDir = result.videoDir;
  } else {
    meta = meta!;
    snippets = snippets!;
    sentences = sentences!;
  }

  let content: string;
  let ext: string;

  if (opts.format === "srt") {
    content = formatSrt(snippets);
    ext = "srt";
  } else {
    content = formatMarkdown(sentences, meta, {
      timestamps: opts.timestamps,
      chapters: opts.chapters,
      speakers: opts.speakers,
    }, snippets);
    ext = "md";
  }

  const filePath = opts.output ? resolve(opts.output) : join(videoDir!, `transcript.${ext}`);
  ensureDir(filePath);
  writeFileSync(filePath, content);

  return { videoId, title: meta.title, filePath };
}

// --- CLI ---

function printHelp() {
  console.log(`Usage: bun main.ts <video-url-or-id> [options]

Options:
  --languages <codes>          Language codes, comma-separated (default: en)
  --format <fmt>               Output format: text, srt (default: text)
  --translate <code>           Translate to language code
  --list                       List available transcripts
  --timestamps                 Include timestamps (default: on)
  --no-timestamps              Disable timestamps
  --chapters                   Chapter segmentation from description
  --speakers                   Raw transcript with metadata for speaker identification
  --exclude-generated          Skip auto-generated transcripts
  --exclude-manually-created   Skip manually created transcripts
  --refresh                    Force re-fetch (ignore cache)
  -o, --output <path>          Save to specific file path
  --output-dir <dir>           Base output directory (default: youtube-transcript)
  -h, --help                   Show help`);
}

function parseArgs(argv: string[]): Options | null {
  const opts: Options = {
    videoIds: [],
    languages: ["en"],
    format: "text",
    translate: "",
    list: false,
    excludeGenerated: false,
    excludeManual: false,
    output: "",
    outputDir: "",
    timestamps: true,
    chapters: false,
    speakers: false,
    refresh: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg === "--languages") {
      const v = argv[++i];
      if (v) opts.languages = v.split(",").map((s) => s.trim());
    } else if (arg === "--format") {
      const v = argv[++i]?.toLowerCase();
      if (v === "text" || v === "srt") opts.format = v;
      else {
        console.error(`Invalid format: ${v}. Use: text, srt`);
        return null;
      }
    } else if (arg === "--translate") {
      opts.translate = argv[++i] || "";
    } else if (arg === "--list" || arg === "--list-transcripts") {
      opts.list = true;
    } else if (arg === "--timestamps" || arg === "-t") {
      opts.timestamps = true;
    } else if (arg === "--no-timestamps") {
      opts.timestamps = false;
    } else if (arg === "--chapters") {
      opts.chapters = true;
    } else if (arg === "--speakers") {
      opts.speakers = true;
    } else if (arg === "--exclude-generated") {
      opts.excludeGenerated = true;
    } else if (arg === "--exclude-manually-created") {
      opts.excludeManual = true;
    } else if (arg === "--refresh") {
      opts.refresh = true;
    } else if (arg === "-o" || arg === "--output") {
      opts.output = argv[++i] || "";
    } else if (arg === "--output-dir") {
      opts.outputDir = argv[++i] || "";
    } else if (!arg.startsWith("-")) {
      opts.videoIds.push(extractVideoId(arg));
    }
  }

  if (opts.videoIds.length === 0) {
    console.error("Error: At least one video URL or ID required");
    printHelp();
    return null;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) process.exit(1);

  if (opts.excludeGenerated && opts.excludeManual) {
    console.error("Error: Cannot exclude both generated and manually created transcripts");
    process.exit(1);
  }

  for (const videoId of opts.videoIds) {
    try {
      const r = await processVideo(videoId, opts);
      if (r.error) console.error(`Error (${r.videoId}): ${r.error}`);
      else if (r.filePath) console.log(r.filePath);
      else if (r.content) console.log(r.content);
    } catch (e) {
      console.error(`Error (${videoId}): ${(e as Error).message}`);
    }
  }
}

main();
