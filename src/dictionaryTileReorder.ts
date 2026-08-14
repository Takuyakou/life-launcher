export function moveIdToSlot(ids: string[], sourceId: string, targetIndex: number): string[] {
  const sourceIndex = ids.indexOf(sourceId);
  if (sourceIndex < 0 || ids.length < 2) return ids;
  const boundedTarget = Math.max(0, Math.min(targetIndex, ids.length - 1));
  if (sourceIndex === boundedTarget) return ids;
  const next = [...ids];
  next.splice(sourceIndex, 1);
  next.splice(boundedTarget, 0, sourceId);
  return next;
}

export function replaceVisibleOrder(
  dictionaryOrder: string[],
  visibleBefore: string[],
  visibleAfter: string[],
): string[] {
  if (
    visibleBefore.length !== visibleAfter.length ||
    new Set(visibleBefore).size !== visibleBefore.length ||
    new Set(visibleAfter).size !== visibleAfter.length ||
    visibleBefore.some((id) => !visibleAfter.includes(id))
  ) {
    return dictionaryOrder;
  }
  const visible = new Set(visibleBefore);
  let nextVisibleIndex = 0;
  return dictionaryOrder.map((id) =>
    visible.has(id) ? (visibleAfter[nextVisibleIndex++] ?? id) : id,
  );
}

export function nearestSlotIndex(
  clientX: number,
  clientY: number,
  slots: Array<{ left: number; top: number; width: number; height: number }>,
): number {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  slots.forEach((slot, index) => {
    const dx = clientX - (slot.left + slot.width / 2);
    const dy = clientY - (slot.top + slot.height / 2);
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearest;
}
