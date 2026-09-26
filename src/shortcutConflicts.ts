export type ShortcutBinding<Field extends string> = {
  field: Field;
  label: string;
  value: string;
};

export type ShortcutConflict<Field extends string> = {
  chord: string;
  bindings: ShortcutBinding<Field>[];
};

export function shortcutIdentity(value: string): string {
  const parts = value.trim().split("+").map((part) => part.trim().toLowerCase());
  const key = parts.pop() ?? "";
  const modifiers = parts.map((part) => (part === "command" ? "super" : part));
  return [...new Set(modifiers)].sort().join("+") + "+" + key;
}

export function findShortcutConflicts<Field extends string>(
  bindings: ShortcutBinding<Field>[],
): ShortcutConflict<Field>[] {
  const groups = new Map<string, ShortcutBinding<Field>[]>();
  for (const binding of bindings) {
    if (!binding.value.trim()) continue;
    const identity = shortcutIdentity(binding.value);
    groups.set(identity, [...(groups.get(identity) ?? []), binding]);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({ chord: group[0].value.trim(), bindings: group }));
}
