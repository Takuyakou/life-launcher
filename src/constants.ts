export const TODAY_ITEM_LIMIT = 3;
export const WEEKLY_FOCUS_LIMIT = 3;
export const EXECUTION_TRIGGER_MAX_CHARS = 40;
export const OVERLAY_PAGE_NAME_MAX_CHARS = 24;
export const TOAST_TIMEOUT_MS = 4000;
// 「元に戻す」付きの通知も、ふつうの通知と同じ 4 秒(v1.6.4。前は 5 秒)。乗せている間・フォーカス中・画面が隠れている間は止まる。
export const TOAST_UNDO_TIMEOUT_MS = 4000;
export const TIMER_TICK_MS = 1000;
export const MAX_TIMER_MINUTES = 240;
/** V163-B4: minutes added by 「続ける」 when settings.extendTimerMinutes is not set. */
export const DEFAULT_EXTEND_TIMER_MINUTES = 15;
export const DEFAULT_BUTTON_GROUP = "その他";
export const GROUP_COLLAPSE_STORAGE_KEY = "life-launcher.sidebar-groups";
export const WEEKLY_REVIEW_SEEN_STORAGE_KEY = "life-launcher.weekly-review-seen";
