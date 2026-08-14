import DOMPurify from "dompurify";
import { marked } from "marked";

const FORBIDDEN_TAGS = [
  "script",
  "base",
  "form",
  "button",
  "textarea",
  "input",
  "select",
  "option",
  "iframe",
  "object",
  "meta",
  "embed",
  "link",
  "style",
  "img",
  "video",
  "audio",
  "source",
  "track",
  "svg",
  "math",
];
const SAFE_URI_PATTERN = /^https?:\/\//i;

function sanitizeHtml(source: string, documentMode = false): string {
  if (!DOMPurify.isSupported) return "";
  return DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true },
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: SAFE_URI_PATTERN,
    FORBID_ATTR: documentMode ? ["srcset"] : ["style", "srcset"],
    FORBID_TAGS: documentMode
      ? FORBIDDEN_TAGS.filter((tag) => tag !== "style")
      : FORBIDDEN_TAGS,
    WHOLE_DOCUMENT: documentMode,
  });
}

export function renderSafeMarkdown(source: string): string {
  const parsed = marked.parse(source, {
    async: false,
    gfm: true,
  });
  return sanitizeHtml(parsed);
}

export function renderSafeHtml(source: string): string {
  return sanitizeHtml(source, true);
}
