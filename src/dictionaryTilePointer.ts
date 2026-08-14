export const DICTIONARY_TILE_DRAG_THRESHOLD_PX = 6;
const DICTIONARY_TILE_DRAG_THRESHOLD_SQUARED =
  DICTIONARY_TILE_DRAG_THRESHOLD_PX * DICTIONARY_TILE_DRAG_THRESHOLD_PX;

export type DictionaryTilePointerPhase = "IDLE" | "PRESSED" | "DRAGGING" | "DROPPING" | "CANCELLED";

export type DictionaryTilePointerState = {
  phase: DictionaryTilePointerPhase;
  buttonId: string | null;
  pointerId: number | null;
  startX: number;
  startY: number;
};

export type DictionaryTilePointerEffect = "NONE" | "LAUNCH" | "DROP";

export const IDLE_DICTIONARY_TILE_POINTER_STATE: DictionaryTilePointerState = {
  phase: "IDLE",
  buttonId: null,
  pointerId: null,
  startX: 0,
  startY: 0,
};

export function pressDictionaryTile(
  state: DictionaryTilePointerState,
  input: {
    buttonId: string;
    pointerId: number;
    clientX: number;
    clientY: number;
    button: number;
    isPrimary: boolean;
    disabled: boolean;
  },
): DictionaryTilePointerState {
  if (state.phase !== "IDLE" || input.button !== 0 || !input.isPrimary || input.disabled) {
    return state;
  }
  return {
    phase: "PRESSED",
    buttonId: input.buttonId,
    pointerId: input.pointerId,
    startX: input.clientX,
    startY: input.clientY,
  };
}

export function moveDictionaryTilePointer(
  state: DictionaryTilePointerState,
  input: { pointerId: number; clientX: number; clientY: number },
): DictionaryTilePointerState {
  if (state.phase !== "PRESSED" || state.pointerId !== input.pointerId) return state;
  const deltaX = input.clientX - state.startX;
  const deltaY = input.clientY - state.startY;
  return deltaX * deltaX + deltaY * deltaY > DICTIONARY_TILE_DRAG_THRESHOLD_SQUARED
    ? { ...state, phase: "DRAGGING" }
    : state;
}

export function releaseDictionaryTilePointer(
  state: DictionaryTilePointerState,
  pointerId: number,
): { state: DictionaryTilePointerState; effect: DictionaryTilePointerEffect } {
  if (state.pointerId !== pointerId) return { state, effect: "NONE" };
  if (state.phase === "PRESSED") {
    return { state: IDLE_DICTIONARY_TILE_POINTER_STATE, effect: "LAUNCH" };
  }
  if (state.phase === "DRAGGING") {
    return { state: { ...state, phase: "DROPPING" }, effect: "DROP" };
  }
  return { state, effect: "NONE" };
}

export function cancelDictionaryTilePointer(
  state: DictionaryTilePointerState,
  pointerId?: number,
): DictionaryTilePointerState {
  if (
    state.phase === "IDLE" ||
    state.phase === "CANCELLED" ||
    (pointerId !== undefined && state.pointerId !== pointerId)
  ) {
    return state;
  }
  return { ...state, phase: "CANCELLED" };
}
