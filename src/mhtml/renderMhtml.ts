import { renderSafeHtml } from "../markdown";
import { assembleMhtml } from "./assembleMhtml";
import type { MhtmlLimits } from "./limits";
import {
  MhtmlError,
  type MhtmlErrorCode,
  type MhtmlParseResult,
} from "./parseMhtml";

type WorkerResponse =
  | { ok: true; result: MhtmlParseResult }
  | { ok: false; code?: string; message?: string };

function parseInWorker(bytes: ArrayBuffer, limits: MhtmlLimits): Promise<MhtmlParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./mhtmlWorker.ts", import.meta.url), {
      type: "module",
    });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      worker.terminate();
      callback();
    };
    const timeout = window.setTimeout(() => {
      finish(() =>
        reject(new MhtmlError("invalid", "MHTMLの読み解きが時間内に終わりませんでした")),
      );
    }, limits.timeoutMs);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (data.ok) {
        finish(() => resolve(data.result));
        return;
      }
      finish(() =>
        reject(
          new MhtmlError(
            (data.code as MhtmlErrorCode | undefined) ?? "invalid",
            data.message ?? "MHTMLを読み解けませんでした",
          ),
        ),
      );
    };
    worker.onerror = (event) => {
      finish(() => reject(new MhtmlError("invalid", event.message || "MHTMLを読み解けませんでした")));
    };
    worker.postMessage({ bytes, limits } satisfies { bytes: ArrayBuffer; limits: MhtmlLimits });
  });
}

/** Decode MHTML in a worker, embed its own images and CSS, then run the existing HTML sanitizer. */
export async function renderMhtmlDocument(
  bytes: ArrayBuffer,
  limits: MhtmlLimits,
  assetBaseUrl: string,
): Promise<string> {
  const parsed = await parseInWorker(bytes, limits);
  const assembled = assembleMhtml(parsed, limits);
  return renderSafeHtml(assembled, assetBaseUrl);
}
