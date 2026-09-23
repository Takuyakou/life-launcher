import DOMPurify from "dompurify";
import { marked } from "marked";

const COMMON_FORBIDDEN_TAGS = [
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
  "embed",
  "video",
  "audio",
  "source",
  "track",
  "svg",
  "math",
];
const MARKDOWN_FORBIDDEN_TAGS = [...COMMON_FORBIDDEN_TAGS, "meta", "link", "style", "img"];
const HTML_FORBIDDEN_TAGS = [
  ...COMMON_FORBIDDEN_TAGS.filter((tag) => tag !== "svg" && tag !== "input"),
  "animate",
  "animateMotion",
  "animateTransform",
  "foreignObject",
  "set",
];
const SAFE_URI_PATTERN = /^(?:(?:(?:f|ht)tps?):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i;
const HTML_FRAME_CSP = [
  "default-src 'none'",
  "img-src asset: http://asset.localhost data:",
  "style-src 'unsafe-inline' asset: http://asset.localhost",
  "font-src asset: http://asset.localhost data:",
  "script-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "form-action 'none'",
  "base-uri asset: http://asset.localhost",
].join("; ");

function isTrustedAssetBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "asset:" || (url.protocol === "http:" && url.hostname === "asset.localhost")
    );
  } catch {
    return false;
  }
}

function isRelativeReference(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("\\\\") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  );
}

function isSafeDocumentAsset(value: string): boolean {
  const trimmed = value.trim();
  if (isRelativeReference(trimmed)) return true;
  if (/^asset:/i.test(trimmed)) return true;
  if (/^http:\/\/asset\.localhost(?:\/|$)/i.test(trimmed)) return true;
  return /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(trimmed);
}

function sanitizeCssReferences(source: string): string {
  const withoutRemoteImports = source.replace(
    /@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1\s*\)?[^;]*;?/gi,
    (rule, _quote: string, url: string) => (isSafeDocumentAsset(url) ? rule : ""),
  );
  return withoutRemoteImports.replace(
    /url\(\s*(["']?)(.*?)\1\s*\)/gi,
    (value, _quote: string, url: string) => (isSafeDocumentAsset(url) ? value : "none"),
  );
}

function sanitizeMarkdown(source: string): string {
  if (!DOMPurify.isSupported) return "";
  return DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true },
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: SAFE_URI_PATTERN,
    FORBID_ATTR: ["style", "srcset"],
    FORBID_TAGS: MARKDOWN_FORBIDDEN_TAGS,
  });
}

function sanitizeHtmlDocument(source: string, assetBaseUrl: string): string {
  if (!DOMPurify.isSupported || !isTrustedAssetBaseUrl(assetBaseUrl)) return "";

  const sanitized = DOMPurify.sanitize(source, {
    ALLOW_DATA_ATTR: false,
    ADD_TAGS: ["link", "meta"],
    ADD_ATTR: ["charset", "content", "http-equiv", "name", "rel"],
    ALLOWED_URI_REGEXP: SAFE_URI_PATTERN,
    FORBID_ATTR: ["srcset"],
    FORBID_TAGS: HTML_FORBIDDEN_TAGS,
    WHOLE_DOCUMENT: true,
  });
  const document = new DOMParser().parseFromString(sanitized, "text/html");

  document.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const style = element.getAttribute("style");
    if (style) element.setAttribute("style", sanitizeCssReferences(style));
  });
  document.querySelectorAll("style").forEach((style) => {
    style.textContent = sanitizeCssReferences(style.textContent ?? "");
  });
  document.querySelectorAll("meta").forEach((meta) => {
    const name = meta.getAttribute("name")?.toLocaleLowerCase();
    if (!meta.hasAttribute("charset") && name !== "viewport") meta.remove();
  });
  document.querySelectorAll("link").forEach((link) => {
    const rel = link.rel
      .split(/\s+/)
      .map((value) => value.toLocaleLowerCase())
      .filter(Boolean);
    const href = link.getAttribute("href") ?? "";
    if (!rel.includes("stylesheet") || !isSafeDocumentAsset(href)) {
      link.remove();
      return;
    }
    link.removeAttribute("crossorigin");
    link.removeAttribute("integrity");
    link.removeAttribute("referrerpolicy");
  });
  document.querySelectorAll("img").forEach((image) => {
    const src = image.getAttribute("src") ?? "";
    if (!isSafeDocumentAsset(src)) image.removeAttribute("src");
    image.removeAttribute("srcset");
  });
  document.querySelectorAll("input").forEach((input) => {
    input.disabled = true;
    input.tabIndex = -1;
    input.removeAttribute("autofocus");
    input.removeAttribute("form");
    input.removeAttribute("formaction");
    input.removeAttribute("name");
  });
  document.querySelectorAll<SVGElement>("svg, svg *").forEach((element) => {
    [
      "clip-path",
      "fill",
      "filter",
      "marker-end",
      "marker-mid",
      "marker-start",
      "mask",
      "stroke",
    ].forEach((name) => {
      const value = element.getAttribute(name);
      if (value) element.setAttribute(name, sanitizeCssReferences(value));
    });
    ["href", "xlink:href"].forEach((name) => {
      const value = element.getAttribute(name);
      if (!value) return;
      const safe =
        element.localName === "image" ? isSafeDocumentAsset(value) : value.trim().startsWith("#");
      if (!safe) element.removeAttribute(name);
    });
  });
  document.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    if (!isRelativeReference(href) && !/^https?:\/\//i.test(href)) {
      anchor.removeAttribute("href");
    }
    anchor.setAttribute("rel", "noopener noreferrer");
    anchor.removeAttribute("target");
  });

  const csp = document.createElement("meta");
  csp.httpEquiv = "Content-Security-Policy";
  csp.content = HTML_FRAME_CSP;
  const base = document.createElement("base");
  base.href = assetBaseUrl;
  document.head.prepend(base);
  document.head.prepend(csp);

  return "<!doctype html>\n" + document.documentElement.outerHTML;
}

export function renderSafeMarkdown(source: string): string {
  const parsed = marked.parse(source, {
    async: false,
    gfm: true,
  });
  return sanitizeMarkdown(parsed);
}

export function renderSafeHtml(source: string, assetBaseUrl: string): string {
  return sanitizeHtmlDocument(source, assetBaseUrl);
}
