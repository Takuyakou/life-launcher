import { MhtmlError, type MhtmlParseResult } from "./parseMhtml";
import type { MhtmlLimits } from "./limits";

/**
 * P97-03: turns the decoded MHTML parts into one HTML document whose images and
 * stylesheets come from inside the file (data: URLs and <style>). Remote references are
 * left for the existing HTML sanitizer to remove; nothing is fetched here.
 */

type IndexedResource =
  | { kind: "image"; dataUrl: string }
  | { kind: "css"; text: string; baseUrl: string | null };

function normalizeCid(value: string): string {
  let cid = value.trim().replace(/^</, "").replace(/>$/, "").trim();
  try {
    cid = decodeURIComponent(cid);
  } catch {
    // Keep the literal value when it is not valid percent-encoding.
  }
  return cid.toLowerCase();
}

function resolveUrl(value: string, base: string | null): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (base) return new URL(trimmed, base).href;
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return new URL(trimmed).href;
  } catch {
    return null;
  }
  return null;
}

function buildIndex(result: MhtmlParseResult): Map<string, IndexedResource> {
  const index = new Map<string, IndexedResource>();
  const add = (key: string | null, resource: IndexedResource) => {
    if (!key) return;
    const normalized = key.toLowerCase();
    if (!index.has(normalized)) index.set(normalized, resource);
  };

  for (const resource of result.resources) {
    const indexed: IndexedResource =
      resource.kind === "image"
        ? { kind: "image", dataUrl: `data:${resource.mime};base64,${resource.base64}` }
        : { kind: "css", text: resource.text, baseUrl: resource.baseUrl };
    if (resource.contentId) add(`cid:${normalizeCid(resource.contentId)}`, indexed);
    if (resource.location) {
      add(resource.location, indexed);
      add(resolveUrl(resource.location, result.baseUrl), indexed);
    }
  }
  return index;
}

function lookupResource(
  index: Map<string, IndexedResource>,
  reference: string,
  base: string | null,
): IndexedResource | null {
  const value = reference.trim();
  if (!value || value.startsWith("#") || value.toLowerCase().startsWith("data:")) return null;
  if (value.toLowerCase().startsWith("cid:")) {
    return index.get(`cid:${normalizeCid(value.slice(4))}`) ?? null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) {
    return index.get(value.toLowerCase()) ?? index.get(resolveUrl(value, base) ?? "") ?? null;
  }
  return (
    index.get(resolveUrl(value, base) ?? "") ?? index.get(value.toLowerCase()) ?? null
  );
}

function rewriteCss(
  source: string,
  base: string | null,
  index: Map<string, IndexedResource>,
): string {
  // MHTML stylesheets are inlined; @import is not followed (remote or embedded).
  const withoutImports = source.replace(
    /@import\s+(?:url\(\s*)?(["']?)[^"')\s;]+\1\s*\)?[^;]*;?/gi,
    "",
  );
  return withoutImports.replace(
    /url\(\s*(["']?)(.*?)\1\s*\)/gi,
    (match: string, _quote: string, reference: string) => {
      const resource = lookupResource(index, reference, base);
      return resource?.kind === "image" ? `url("${resource.dataUrl}")` : match;
    },
  );
}

export function assembleMhtml(result: MhtmlParseResult, limits: MhtmlLimits): string {
  const index = buildIndex(result);
  const document = new DOMParser().parseFromString(result.html, "text/html");
  const base = result.baseUrl;

  document.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    const resource = lookupResource(index, image.getAttribute("src") ?? "", base);
    if (resource?.kind === "image") image.setAttribute("src", resource.dataUrl);
    else image.removeAttribute("src");
    image.removeAttribute("srcset");
  });

  document.querySelectorAll<HTMLLinkElement>("link").forEach((link) => {
    const rel = (link.getAttribute("rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!rel.includes("stylesheet")) return;
    const resource = lookupResource(index, link.getAttribute("href") ?? "", base);
    if (resource?.kind === "css") {
      const style = document.createElement("style");
      style.textContent = rewriteCss(resource.text, resource.baseUrl ?? base, index);
      link.replaceWith(style);
    } else {
      link.remove();
    }
  });

  document.querySelectorAll("style").forEach((style) => {
    style.textContent = rewriteCss(style.textContent ?? "", base, index);
  });
  document.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const value = element.getAttribute("style");
    if (value) element.setAttribute("style", rewriteCss(value, base, index));
  });

  const html = `<!doctype html>\n${document.documentElement.outerHTML}`;
  if (new TextEncoder().encode(html).length > limits.maxAssembledBytes) {
    throw new MhtmlError("too-large", "MHTMLを展開すると大きすぎます");
  }
  return html;
}
