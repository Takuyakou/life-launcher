/**
 * Phase 10 の動き(D32〜D38)で使うばねの値。
 * 値は 1 か所にまとめ、部品からはここを import する。
 */
export const springSnappy = { type: "spring", visualDuration: 0.25, bounce: 0.15 } as const;
export const springLayout = { type: "spring", visualDuration: 0.3, bounce: 0 } as const;
/** P10-14f (F6): the faster open/close spring for the sidebar and the main sections. */
export const springCollapse = { type: "spring", visualDuration: 0.2, bounce: 0 } as const;
/** 中の項目を上から順に出すときの 1 件あたりの遅れ(秒)。 */
export const staggerStep = 0.02;
/** その遅れの合計の上限(秒)。 */
export const staggerMax = 0.12;
