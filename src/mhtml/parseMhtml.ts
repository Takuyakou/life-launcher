import type { MhtmlLimits } from "./limits";

/**
 * P97-03: a small, bounded MHTML reader.
 *
 * It only understands the MIME shapes that Chrome and Edge write for
 * "Webpage, Single File": an outer multipart/related (or multipart/mixed) with
 * text/html, text/css and raster-image parts. Everything else is ignored or
 * reported as unreadable; this is not a general MIME parser.
 *
 * No DOM is used here, so this module also runs inside a Web Worker.
 */

export type MhtmlErrorCode =
  | "invalid"
  | "too-large"
  | "too-many-parts"
  | "too-deep"
  | "no-html";

export class MhtmlError extends Error {
  constructor(
    readonly code: MhtmlErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MhtmlError";
  }
}

export type MhtmlImageResource = {
  kind: "image";
  mime: string;
  contentId: string | null;
  location: string | null;
  base64: string;
};

export type MhtmlCssResource = {
  kind: "css";
  mime: "text/css";
  contentId: string | null;
  location: string | null;
  baseUrl: string | null;
  text: string;
};

export type MhtmlResource = MhtmlImageResource | MhtmlCssResource;

export type MhtmlParseResult = {
  html: string;
  /** Base URL used to resolve relative references inside the body HTML. */
  baseUrl: string | null;
  resources: MhtmlResource[];
};

type LeafPart = {
  contentType: string;
  contentId: string | null;
  contentLocation: string | null;
  base64: string | null;
  text: string | null;
};

type ParseState = {
  limits: MhtmlLimits;
  partCount: number;
  decodedBytes: number;
  leaves: LeafPart[];
};

const SUPPORTED_TRANSFER_ENCODINGS = new Set([
  "7bit",
  "8bit",
  "binary",
  "quoted-printable",
  "base64",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const CHARSET_ALIASES: Record<string, string> = {
  "shift-jis": "shift_jis",
  sjis: "shift_jis",
  "x-sjis": "shift_jis",
  "windows-31j": "shift_jis",
  cp932: "shift_jis",
  utf8: "utf-8",
  "iso-8859-1": "windows-1252",
  latin1: "windows-1252",
};

function invalid(message: string): MhtmlError {
  return new MhtmlError("invalid", message);
}

function decodeAscii(bytes: Uint8Array): string {
  let text = "";
  const chunkSize = 0x2000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return text;
}

function encodeAscii(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function findHeaderEnd(bytes: Uint8Array): { headerEnd: number; bodyStart: number } | null {
  for (let index = 0; index < bytes.length; index += 1) {
    if (
      index + 3 < bytes.length &&
      bytes[index] === 0x0d &&
      bytes[index + 1] === 0x0a &&
      bytes[index + 2] === 0x0d &&
      bytes[index + 3] === 0x0a
    ) {
      return { headerEnd: index, bodyStart: index + 4 };
    }
    if (bytes[index] === 0x0a && bytes[index + 1] === 0x0a) {
      return { headerEnd: index, bodyStart: index + 2 };
    }
  }
  return null;
}

function parseHeaders(bytes: Uint8Array): Map<string, string> {
  const text = decodeAscii(bytes).replace(/\r\n/g, "\n");
  const headers = new Map<string, string>();
  let currentName: string | null = null;
  for (const line of text.split("\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && currentName) {
      headers.set(currentName, `${headers.get(currentName) ?? ""} ${line.trim()}`.trim());
      continue;
    }
    const colon = line.indexOf(":");
    if (colon <= 0) {
      currentName = null;
      continue;
    }
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!name) {
      currentName = null;
      continue;
    }
    if (!headers.has(name)) {
      headers.set(name, line.slice(colon + 1).trim());
    }
    currentName = name;
  }
  return headers;
}

function parseContentType(value: string): {
  mediaType: string;
  parameters: Record<string, string>;
} {
  const segments: string[] = [];
  let current = "";
  let quoted = false;
  for (const character of value) {
    if (character === '"') {
      quoted = !quoted;
      current += character;
      continue;
    }
    if (character === ";" && !quoted) {
      segments.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  segments.push(current);

  const mediaType = (segments.shift() ?? "").trim().toLowerCase();
  const parameters: Record<string, string> = {};
  for (const segment of segments) {
    const equals = segment.indexOf("=");
    if (equals < 0) continue;
    const key = segment.slice(0, equals).trim().toLowerCase();
    let parameter = segment.slice(equals + 1).trim();
    if (parameter.startsWith('"') && parameter.endsWith('"') && parameter.length >= 2) {
      parameter = parameter.slice(1, -1).replace(/\\(.)/g, "$1");
    }
    if (key) parameters[key] = parameter;
  }
  return { mediaType, parameters };
}

/** Finds a `--boundary` line at the start of a line and reports whether it closes the part list. */
function findBoundaryLine(
  bytes: Uint8Array,
  marker: Uint8Array,
  from: number,
): { index: number; closing: boolean; after: number } | null {
  for (let index = from; index + marker.length <= bytes.length; index += 1) {
    if (index > 0 && bytes[index - 1] !== 0x0a) continue;
    let matches = true;
    for (let offset = 0; offset < marker.length; offset += 1) {
      if (bytes[index + offset] !== marker[offset]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    let cursor = index + marker.length;
    while (cursor < bytes.length && (bytes[cursor] === 0x20 || bytes[cursor] === 0x09)) {
      cursor += 1;
    }
    let closing = false;
    if (bytes[cursor] === 0x2d && bytes[cursor + 1] === 0x2d) {
      closing = true;
      cursor += 2;
      while (cursor < bytes.length && (bytes[cursor] === 0x20 || bytes[cursor] === 0x09)) {
        cursor += 1;
      }
    }
    if (cursor >= bytes.length) {
      return { index, closing, after: cursor };
    }
    if (bytes[cursor] === 0x0a) {
      return { index, closing, after: cursor + 1 };
    }
    if (bytes[cursor] === 0x0d && bytes[cursor + 1] === 0x0a) {
      return { index, closing, after: cursor + 2 };
    }
  }
  return null;
}

function splitMultipart(bytes: Uint8Array, boundary: string): Uint8Array[] {
  const marker = encodeAscii(`--${boundary}`);
  const first = findBoundaryLine(bytes, marker, 0);
  if (!first) throw invalid("MHTMLの境界が見つかりません");
  if (first.closing) return [];

  const parts: Uint8Array[] = [];
  let start = first.after;
  for (;;) {
    const next = findBoundaryLine(bytes, marker, start);
    if (!next) throw invalid("MHTMLの境界が途中で切れています");
    let end = next.index;
    if (end >= 2 && bytes[end - 1] === 0x0a && bytes[end - 2] === 0x0d) {
      end -= 2;
    } else if (end >= 1 && bytes[end - 1] === 0x0a) {
      end -= 1;
    }
    parts.push(bytes.subarray(start, end));
    if (next.closing) return parts;
    start = next.after;
  }
}

function hexValue(byte: number): number {
  if (byte >= 0x30 && byte <= 0x39) return byte - 0x30;
  if (byte >= 0x41 && byte <= 0x46) return byte - 0x41 + 10;
  if (byte >= 0x61 && byte <= 0x66) return byte - 0x61 + 10;
  return -1;
}

function decodeQuotedPrintable(bytes: Uint8Array): Uint8Array {
  const output: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (byte !== 0x3d) {
      output.push(byte);
      continue;
    }
    if (bytes[index + 1] === 0x0d && bytes[index + 2] === 0x0a) {
      index += 2;
      continue;
    }
    if (bytes[index + 1] === 0x0a) {
      index += 1;
      continue;
    }
    const high = hexValue(bytes[index + 1]);
    const low = hexValue(bytes[index + 2]);
    if (high >= 0 && low >= 0) {
      output.push(high * 16 + low);
      index += 2;
      continue;
    }
    output.push(byte);
  }
  return Uint8Array.from(output);
}

function normalizeBase64(bytes: Uint8Array): string {
  return decodeAscii(bytes).replace(/\s+/g, "");
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x2000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function decodeText(bytes: Uint8Array, charset: string | undefined): string {
  const label = (charset ?? "utf-8").trim().toLowerCase();
  const normalized = CHARSET_ALIASES[label] ?? label;
  try {
    return new TextDecoder(normalized, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

function contentIdValue(headers: Map<string, string>): string | null {
  const value = headers.get("content-id")?.trim();
  if (!value) return null;
  return value.replace(/^</, "").replace(/>$/, "").trim() || null;
}

function contentLocationValue(headers: Map<string, string>): string | null {
  return headers.get("content-location")?.trim() || null;
}

function isFramePart(contentId: string | null, contentLocation: string | null): boolean {
  const id = (contentId ?? "").toLowerCase();
  const location = (contentLocation ?? "").toLowerCase();
  return (
    id.startsWith("frame-") ||
    location.startsWith("cid:frame-") ||
    location.includes("cid:frame-")
  );
}

function parsePart(bytes: Uint8Array, depth: number, state: ParseState): void {
  const split = findHeaderEnd(bytes);
  if (!split) throw invalid("MHTMLの部分のヘッダーが途中で切れています");
  const headers = parseHeaders(bytes.subarray(0, split.headerEnd));
  const body = bytes.subarray(split.bodyStart);
  const contentType = parseContentType(headers.get("content-type") ?? "text/plain");

  if (contentType.mediaType.startsWith("multipart/")) {
    if (depth >= state.limits.maxDepth) {
      throw new MhtmlError("too-deep", "MHTMLの入れ子が深すぎます");
    }
    const boundary = contentType.parameters.boundary;
    if (!boundary) throw invalid("MHTMLの入れ子の境界が見つかりません");
    for (const child of splitMultipart(body, boundary)) {
      parsePart(child, depth + 1, state);
    }
    return;
  }

  const transferEncoding = (headers.get("content-transfer-encoding") ?? "7bit")
    .trim()
    .toLowerCase();
  if (!SUPPORTED_TRANSFER_ENCODINGS.has(transferEncoding)) return;

  state.partCount += 1;
  if (state.partCount > state.limits.maxPartCount) {
    throw new MhtmlError("too-many-parts", "MHTMLの部分が多すぎます");
  }

  const contentId = contentIdValue(headers);
  const contentLocation = contentLocationValue(headers);
  const charset = contentType.parameters.charset;
  const mediaType = contentType.mediaType;
  const isText = mediaType === "text/html" || mediaType === "text/css";

  let decodedBytes: Uint8Array | null;
  let base64: string | null = null;
  if (transferEncoding === "base64") {
    base64 = normalizeBase64(body);
    decodedBytes = base64ToBytes(base64);
    // A broken base64 part is simply not used; the rest of the document still renders.
    if (!decodedBytes) return;
  } else if (transferEncoding === "quoted-printable") {
    decodedBytes = decodeQuotedPrintable(body);
  } else {
    decodedBytes = body;
  }

  state.decodedBytes += decodedBytes.length;
  if (state.decodedBytes > state.limits.maxDecodedBytes) {
    throw new MhtmlError("too-large", "MHTMLの展開後の大きさが上限を超えました");
  }

  const text = isText ? decodeText(decodedBytes, charset) : null;
  const imageBase64 = IMAGE_MIME_TYPES.has(mediaType)
    ? (base64 ?? bytesToBase64(decodedBytes))
    : null;
  state.leaves.push({
    contentType: mediaType,
    contentId,
    contentLocation,
    base64: imageBase64,
    text,
  });
}

function normalizeUrl(value: string | null | undefined, base?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    if (base) return new URL(trimmed, base).href;
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return new URL(trimmed).href;
  } catch {
    return null;
  }
  return trimmed;
}

export function parseMhtml(bytes: Uint8Array, limits: MhtmlLimits): MhtmlParseResult {
  const split = findHeaderEnd(bytes);
  if (!split) throw invalid("MHTMLのヘッダーが見つかりません");
  const headers = parseHeaders(bytes.subarray(0, split.headerEnd));
  const contentType = parseContentType(headers.get("content-type") ?? "");
  if (
    contentType.mediaType !== "multipart/related" &&
    contentType.mediaType !== "multipart/mixed"
  ) {
    throw invalid("MHTMLがmultipartではありません");
  }
  const boundary = contentType.parameters.boundary;
  if (!boundary) throw invalid("MHTMLの境界が見つかりません");

  const state: ParseState = {
    limits,
    partCount: 0,
    decodedBytes: 0,
    leaves: [],
  };
  const body = bytes.subarray(split.bodyStart);
  for (const part of splitMultipart(body, boundary)) {
    parsePart(part, 1, state);
  }

  const snapshotLocation =
    headers.get("snapshot-content-location") ?? headers.get("content-location") ?? null;
  const htmlLeaf = state.leaves.find(
    (leaf) =>
      leaf.contentType === "text/html" &&
      leaf.text !== null &&
      !isFramePart(leaf.contentId, leaf.contentLocation),
  );
  if (!htmlLeaf || htmlLeaf.text === null) {
    throw new MhtmlError("no-html", "MHTMLに本文のHTMLがありません");
  }

  const pageBase = normalizeUrl(snapshotLocation);
  const baseUrl =
    normalizeUrl(htmlLeaf.contentLocation, pageBase) ??
    normalizeUrl(htmlLeaf.contentLocation) ??
    pageBase;

  const resources: MhtmlResource[] = [];
  for (const leaf of state.leaves) {
    if (leaf.base64 && IMAGE_MIME_TYPES.has(leaf.contentType)) {
      resources.push({
        kind: "image",
        mime: leaf.contentType,
        contentId: leaf.contentId,
        location: leaf.contentLocation,
        base64: leaf.base64,
      });
      continue;
    }
    if (leaf.contentType === "text/css" && leaf.text !== null) {
      resources.push({
        kind: "css",
        mime: "text/css",
        contentId: leaf.contentId,
        location: leaf.contentLocation,
        baseUrl: normalizeUrl(leaf.contentLocation, pageBase) ?? baseUrl,
        text: leaf.text,
      });
    }
  }

  return { html: htmlLeaf.text, baseUrl, resources };
}
