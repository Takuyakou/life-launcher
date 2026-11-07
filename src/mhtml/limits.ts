/**
 * P97-03: limits for reading an MHTML file. The file-size limit (20 MiB) is enforced in
 * Rust before the bytes are sent; these limits apply while the webview decodes the parts.
 */
export type MhtmlLimits = {
  /** Maximum number of MIME parts, including nested ones. */
  maxPartCount: number;
  /** Maximum nesting depth of multipart containers (the outer one is 1). */
  maxDepth: number;
  /** Maximum total size of the decoded parts. */
  maxDecodedBytes: number;
  /** Maximum size of the assembled HTML before it is sanitized. */
  maxAssembledBytes: number;
  /** Maximum time for decoding in the worker. */
  timeoutMs: number;
};

export const DEFAULT_MHTML_LIMITS: MhtmlLimits = {
  maxPartCount: 1_000,
  maxDepth: 3,
  maxDecodedBytes: 64 * 1024 * 1024,
  maxAssembledBytes: 64 * 1024 * 1024,
  timeoutMs: 10_000,
};

export function resolveMhtmlLimits(override?: Partial<MhtmlLimits>): MhtmlLimits {
  const resolved = { ...DEFAULT_MHTML_LIMITS };
  if (!override) return resolved;
  for (const key of Object.keys(resolved) as Array<keyof MhtmlLimits>) {
    const value = override[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * Tests lower the limits to exercise the too-large and timeout paths without building
 * 64 MiB fixtures. Production never sets this global.
 */
export function currentMhtmlLimits(): MhtmlLimits {
  const override = (
    globalThis as typeof globalThis & { __LIFE_LAUNCHER_MHTML_LIMITS__?: Partial<MhtmlLimits> }
  ).__LIFE_LAUNCHER_MHTML_LIMITS__;
  return resolveMhtmlLimits(override);
}
