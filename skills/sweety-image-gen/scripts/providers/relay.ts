import path from "node:path";
import { readFile } from "node:fs/promises";
import type { CliArgs } from "../types";

const DEFAULT_MODEL = "gemini-2.5-flash-image";

export function getDefaultModel(): string {
  return process.env.RELAY_IMAGE_MODEL || DEFAULT_MODEL;
}

function getApiKey(): string | null {
  return process.env.RELAY_API_KEY || null;
}

function getBaseUrl(): string {
  const base = process.env.RELAY_BASE_URL || "https://new.suxi.ai/v1";
  return base.replace(/\/+$/g, "");
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

async function readImageAsDataUrl(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return `data:${getMimeType(filePath)};base64,${bytes.toString("base64")}`;
}

type MessageContent = string | Array<Record<string, unknown>>;

function addAspectRatioToPrompt(prompt: string, ar: string | null): string {
  if (!ar) return prompt;
  return `Generate the image with aspect ratio ${ar}.\n\n${prompt}`;
}

function buildContent(
  prompt: string,
  referenceDataUrls: string[],
): MessageContent {
  if (referenceDataUrls.length === 0) return prompt;

  const parts: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const url of referenceDataUrls) {
    parts.push({ type: "image_url", image_url: { url } });
  }
  return parts;
}

function extractBase64FromContent(content: string): Uint8Array | null {
  const match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
  if (!match) return null;
  return Uint8Array.from(Buffer.from(match[1]!, "base64"));
}

type RelayResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: { message?: string };
};

export async function generateImage(
  prompt: string,
  model: string,
  args: CliArgs,
): Promise<Uint8Array> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "RELAY_API_KEY is required. Set it in ~/.sweety-skills/.env",
    );
  }

  const enhancedPrompt = addAspectRatioToPrompt(prompt, args.aspectRatio);

  const referenceDataUrls: string[] = [];
  for (const refPath of args.referenceImages) {
    referenceDataUrls.push(await readImageAsDataUrl(refPath));
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "user",
        content: buildContent(enhancedPrompt, referenceDataUrls),
      },
    ],
  };

  const baseUrl = getBaseUrl();
  console.error(`Generating image with relay (${model}) at ${baseUrl}...`);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Relay API error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as RelayResponse;

  if (result.error?.message) {
    throw new Error(`Relay API error: ${result.error.message}`);
  }

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in relay response");
  }

  const imageData = extractBase64FromContent(content);
  if (imageData) return imageData;

  throw new Error("No image found in relay response. Expected base64 data URL in content.");
}
