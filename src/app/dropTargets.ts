export function instructionPathKey(path: string): string {
  return path.replace(/\//g, "\\").replace(/\\+$/, "").toLocaleLowerCase();
}

export function instructionPathWithin(path: string, root: string): boolean {
  const normalizedPath = instructionPathKey(path);
  const normalizedRoot = instructionPathKey(root);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}\\`);
}

export function sidebarDropTargetFromPoint(
  x: number,
  y: number,
  sourceId?: string,
): {
  groupName: string;
  buttonId?: string;
  indicator?: { left: number; top: number; width: number };
} | null {
  const groupElement = Array.from(
    document.querySelectorAll<HTMLElement>("[data-sidebar-group-section]"),
  ).find((element) => {
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  const groupName = groupElement?.dataset.sidebarGroupSection;
  if (!groupElement || !groupName) return null;

  const allButtons = Array.from(
    groupElement.querySelectorAll<HTMLElement>("[data-sidebar-button-id]"),
  );
  const buttons = allButtons.filter((element) => element.dataset.sidebarButtonId !== sourceId);
  if (buttons.length === 0) return allButtons.length === 0 ? { groupName } : null;

  const target = buttons.reduce((closest, candidate) => {
    const closestRect = closest.getBoundingClientRect();
    const candidateRect = candidate.getBoundingClientRect();
    return Math.abs(y - (candidateRect.top + candidateRect.height / 2)) <
      Math.abs(y - (closestRect.top + closestRect.height / 2))
      ? candidate
      : closest;
  });
  const buttonId = target.dataset.sidebarButtonId;
  if (!buttonId) return { groupName };
  const targetRect = target.getBoundingClientRect();
  return {
    buttonId,
    groupName,
    indicator: {
      left: targetRect.left + 4,
      top: targetRect.bottom + 1,
      width: Math.max(0, targetRect.width - 8),
    },
  };
}

export function sidebarGroupDropTargetFromPoint(
  x: number,
  y: number,
): { groupName: string; placement: "before" | "after" } | null {
  const groupElement = Array.from(
    document.querySelectorAll<HTMLElement>("[data-sidebar-group-section]"),
  ).find((element) => {
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  const groupName = groupElement?.dataset.sidebarGroupSection;
  if (!groupElement || !groupName) return null;

  const rect = groupElement.getBoundingClientRect();
  return {
    groupName,
    placement: y < rect.top + rect.height / 2 ? "before" : "after",
  };
}

export function todayDropTargetFromPoint(
  x: number,
  y: number,
): {
  index: number;
  placement: "before" | "after";
  indicator: { left: number; top: number; width: number; height: number };
} | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-today-index]"));
  const rowElement = rows.find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  if (!rowElement) return null;

  const index = Number(rowElement.dataset.todayIndex);
  if (Number.isNaN(index)) return null;
  const rect = rowElement.getBoundingClientRect();
  const sharesRow = rows.some(
    (candidate) =>
      candidate !== rowElement && Math.abs(candidate.getBoundingClientRect().top - rect.top) < 2,
  );
  const placement = sharesRow
    ? x < rect.left + rect.width / 2
      ? "before"
      : "after"
    : y < rect.top + rect.height / 2
      ? "before"
      : "after";
  const indicator = sharesRow
    ? {
        left: placement === "before" ? rect.left - 2 : rect.right + 1,
        top: rect.top + 6,
        width: 3,
        height: Math.max(0, rect.height - 12),
      }
    : {
        left: rect.left + 6,
        top: placement === "before" ? rect.top - 2 : rect.bottom + 1,
        width: Math.max(0, rect.width - 12),
        height: 3,
      };

  return {
    index,
    placement,
    indicator,
  };
}

export function todayAdoptionDropTargetFromPoint(
  x: number,
  y: number,
): {
  insertionIndex: number;
  indicator: { left: number; top: number; width: number; height: number };
} | null {
  const grid = document.querySelector<HTMLElement>(".todayGrid");
  if (!grid) return null;
  const gridRect = grid.getBoundingClientRect();
  if (x < gridRect.left || x > gridRect.right || y < gridRect.top || y > gridRect.bottom) {
    return null;
  }
  const direct = todayDropTargetFromPoint(x, y);
  if (direct) {
    return {
      insertionIndex: direct.index + (direct.placement === "after" ? 1 : 0),
      indicator: direct.indicator,
    };
  }
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-today-index]"));
  if (rows.length === 0) {
    return {
      insertionIndex: 0,
      indicator: {
        left: gridRect.left + 8,
        top: gridRect.top + 8,
        width: Math.max(0, gridRect.width - 16),
        height: 3,
      },
    };
  }
  const nearest = rows.reduce(
    (best, row) => {
      const rect = row.getBoundingClientRect();
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const distance = Math.hypot(dx, dy);
      return !best || distance < best.distance ? { row, distance } : best;
    },
    null as { row: HTMLElement; distance: number } | null,
  );
  if (!nearest) return null;
  const rect = nearest.row.getBoundingClientRect();
  const index = Number(nearest.row.dataset.todayIndex);
  if (Number.isNaN(index)) return null;
  const sharesRow = rows.some(
    (row) => row !== nearest.row && Math.abs(row.getBoundingClientRect().top - rect.top) < 2,
  );
  const after = sharesRow ? x >= rect.left + rect.width / 2 : y >= rect.top + rect.height / 2;
  return {
    insertionIndex: index + (after ? 1 : 0),
    indicator: sharesRow
      ? {
          left: after ? rect.right + 1 : rect.left - 2,
          top: rect.top + 6,
          width: 3,
          height: Math.max(0, rect.height - 12),
        }
      : {
          left: rect.left + 6,
          top: after ? rect.bottom + 1 : rect.top - 2,
          width: Math.max(0, rect.width - 12),
          height: 3,
        },
  };
}

export function pointWithinSelector(x: number, y: number, selector: string): boolean {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
export const TODAY_REMOVE_DROP_HIT_TOP_PX = 20;
export const TODAY_REMOVE_DROP_HIT_BOTTOM_PX = 6;
export const TODAY_REMOVE_DROP_HIT_BOTTOM_NARROW_PX = 32;
export const TODAY_REMOVE_DROP_NARROW_WIDTH_PX = 860;

export function pointWithinTodayRemoveDropZone(x: number, y: number): boolean {
  const element = document.querySelector<HTMLElement>(".todayRemoveDropZone");
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const bottomExtension =
    window.innerWidth <= TODAY_REMOVE_DROP_NARROW_WIDTH_PX
      ? TODAY_REMOVE_DROP_HIT_BOTTOM_NARROW_PX
      : TODAY_REMOVE_DROP_HIT_BOTTOM_PX;
  return (
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top - TODAY_REMOVE_DROP_HIT_TOP_PX &&
    y <= rect.bottom + bottomExtension
  );
}

export function draggedCardTopWithinTodayRemoveDropZone(
  pointerX: number,
  pointerY: number,
  offsetX: number,
  offsetY: number,
  width: number,
): boolean {
  const element = document.querySelector<HTMLElement>(".todayRemoveDropZone");
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const cardLeft = pointerX - offsetX;
  const cardRight = cardLeft + width;
  const cardTop = pointerY - offsetY;
  const bottomExtension =
    window.innerWidth <= TODAY_REMOVE_DROP_NARROW_WIDTH_PX
      ? TODAY_REMOVE_DROP_HIT_BOTTOM_NARROW_PX
      : TODAY_REMOVE_DROP_HIT_BOTTOM_PX;
  return (
    cardRight >= rect.left &&
    cardLeft <= rect.right &&
    cardTop >= rect.top - TODAY_REMOVE_DROP_HIT_TOP_PX &&
    cardTop <= rect.bottom + bottomExtension
  );
}

export function projectDropTargetFromPoint(
  x: number,
  y: number,
): { id: string; placement: "before" | "after" } | null {
  const element = document.elementFromPoint(x, y);
  if (!element) return nearestProjectDropTargetFromPoint(x, y);

  const cardElement = element.closest<HTMLElement>(".nextStepCard[data-project-id]");
  if (!cardElement) return nearestProjectDropTargetFromPoint(x, y);
  return projectDropTargetFromCard(cardElement, x, y);
}

export function projectDropTargetFromCard(
  cardElement: HTMLElement,
  x: number,
  y: number,
): { id: string; placement: "before" | "after" } | null {
  const id = cardElement.dataset.projectId;
  if (!id) return null;
  const rect = cardElement.getBoundingClientRect();
  const sharesRow = Array.from(
    document.querySelectorAll<HTMLElement>(".nextStepCard[data-project-id]"),
  ).some(
    (candidate) =>
      candidate !== cardElement && Math.abs(candidate.getBoundingClientRect().top - rect.top) < 2,
  );
  return {
    id,
    placement: sharesRow
      ? x < rect.left + rect.width / 2
        ? "before"
        : "after"
      : y < rect.top + rect.height / 2
        ? "before"
        : "after",
  };
}

export function nearestProjectDropTargetFromPoint(
  x: number,
  y: number,
): { id: string; placement: "before" | "after" } | null {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(".nextStepCard[data-project-id]"),
  );
  if (cards.length === 0) return null;

  const nearest = cards.reduce<{ card: HTMLElement; distance: number } | null>((best, card) => {
    const rect = card.getBoundingClientRect();
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) {
      return { card, distance };
    }
    return best;
  }, null);

  return nearest ? projectDropTargetFromCard(nearest.card, x, y) : null;
}

export function wishlistGroupDropTargetFromPoint(
  x: number,
  y: number,
): {
  key: string;
  placement: "before" | "after";
  indicator: { left: number; top: number; width: number };
} | null {
  const group = Array.from(document.querySelectorAll<HTMLElement>("[data-wishlist-group]")).find(
    (candidate) => {
      const rect = candidate.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    },
  );
  const key = group?.dataset.wishlistGroup;
  if (!group || !key) return null;
  const rect = group.getBoundingClientRect();
  const placement = y < rect.top + rect.height / 2 ? "before" : "after";
  return {
    key,
    placement,
    indicator: {
      left: rect.left + 6,
      top: placement === "before" ? rect.top - 2 : rect.bottom + 1,
      width: Math.max(0, rect.width - 12),
    },
  };
}

export function inboxDropTargetFromPoint(
  x: number,
  y: number,
): {
  index: number;
  placement: "before" | "after";
  indicator: { left: number; top: number; width: number };
} | null {
  const row = Array.from(document.querySelectorAll<HTMLElement>("[data-inbox-index]")).find(
    (candidate) => {
      const rect = candidate.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    },
  );
  if (!row) return null;

  const index = Number(row.dataset.inboxIndex);
  if (Number.isNaN(index)) return null;
  const rect = row.getBoundingClientRect();
  const placement = y < rect.top + rect.height / 2 ? "before" : "after";
  return {
    index,
    placement,
    indicator: {
      left: rect.left + 6,
      top: placement === "before" ? rect.top - 2 : rect.bottom + 1,
      width: Math.max(0, rect.width - 12),
    },
  };
}

export function projectDropIndicator(
  id: string,
  placement: "before" | "after",
): { left: number; top: number; width: number; height?: number } | undefined {
  const card = document.querySelector<HTMLElement>(
    `.nextStepCard[data-project-id="${CSS.escape(id)}"]`,
  );
  if (!card) return undefined;
  const rect = card.getBoundingClientRect();
  const sharesRow = Array.from(
    document.querySelectorAll<HTMLElement>(".nextStepCard[data-project-id]"),
  ).some(
    (candidate) =>
      candidate !== card && Math.abs(candidate.getBoundingClientRect().top - rect.top) < 2,
  );
  if (sharesRow) {
    return {
      left: placement === "before" ? rect.left - 2 : rect.right + 1,
      top: rect.top + 6,
      width: 3,
      height: Math.max(0, rect.height - 12),
    };
  }
  return {
    left: rect.left + 6,
    top: placement === "before" ? rect.top - 2 : rect.bottom + 1,
    width: Math.max(0, rect.width - 12),
  };
}

export function isReorderBlockedTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, input, textarea, select, a, [role='button']"))
  );
}

export async function notifyTimerComplete(label: string) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission === "granted") {
    new Notification("Life Launcher", {
      body: `${label} が満了しました`,
    });
  }
}
