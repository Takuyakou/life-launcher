export const secretChecks = [
  [/https?:\/\/[^\s/@:]+:[^\s/@]+@/i, "URL embedded credential"],
  [/(?:ghp_|github_pat_)[A-Za-z0-9_-]{16,}/i, "token-like value"],
  [/gh[ousr]_[A-Za-z0-9_-]{16,}/i, "GitHub token"],
  [/sk-ant-[A-Za-z0-9_-]{8,}/i, "Anthropic API key"],
  [/\bsk-(?!ant-)[A-Za-z0-9_-]{16,}/i, "token-like value"],
  [/xox[baprs]-[A-Za-z0-9_-]{16,}/i, "token-like value"],
  [/Authorization\s*:\s*(?:token|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/i, "Authorization credential"],
  [/--(?:password|token|api-key)(?:=|\s+)(?:"[^"]+"|'[^']+'|[^\s"']+)/i, "command-line credential"],
  [/Bearer\s+[A-Za-z0-9._~-]{16,}/i, "Bearer credential"],
  [/AIza[A-Za-z0-9_-]{30,}/, "Google API key"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/(?:api[_-]?key|password|client[_-]?secret)\s*[:=]\s*["'][^"']{8,}["']/i, "credential assignment"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/https?:\/\/pianowithjonny\.com/i, "prior-use external URL"],
];

export function findSecretFindings(body) {
  return secretChecks
    .filter(([pattern]) => pattern.test(body))
    .map(([, label]) => label);
}

export function isForbiddenAiToolPath(rel) {
  const segments = rel.replaceAll("\\", "/").toLowerCase().split("/");
  const basename = segments.at(-1) ?? "";
  if (segments.some((part) => [".commandcode", ".cursor", ".codex"].includes(part))) {
    return true;
  }
  return segments.includes(".claude") && /^settings.*\.json$/.test(basename);
}

export function forbiddenAiToolFinding(rel, trackedPaths, ignoredPaths) {
  if (!isForbiddenAiToolPath(rel)) return null;
  const key = rel.replaceAll("\\", "/").toLowerCase();
  if (trackedPaths.has(key)) return "tracked";
  if (ignoredPaths.has(key)) return null;
  return "prohibited";
}
