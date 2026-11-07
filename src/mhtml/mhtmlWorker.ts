import { MhtmlError, parseMhtml, type MhtmlParseResult } from "./parseMhtml";
import type { MhtmlLimits } from "./limits";

type WorkerRequest = { bytes: ArrayBuffer; limits: MhtmlLimits };
type WorkerResponse =
  | { ok: true; result: MhtmlParseResult }
  | { ok: false; code: string; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

scope.onmessage = (event) => {
  try {
    const result = parseMhtml(new Uint8Array(event.data.bytes), event.data.limits);
    scope.postMessage({ ok: true, result });
  } catch (error) {
    scope.postMessage({
      ok: false,
      code: error instanceof MhtmlError ? error.code : "invalid",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
