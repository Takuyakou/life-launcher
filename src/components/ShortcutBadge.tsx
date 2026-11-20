type ShortcutBadgeProps = {
  label: string;
  shortcut: string | null | undefined;
  registered: boolean;
  tone?: "accent" | "muted";
};

export function ShortcutBadge({
  label,
  shortcut,
  registered,
  tone = "accent",
}: ShortcutBadgeProps) {
  const value = shortcut?.trim();
  if (!value) return null;

  const title = registered
    ? `${label}: ${value}`
    : `${label}: ${value}（ショートカットを登録できていません）`;
  return (
    <kbd
      className={`uiKey${tone === "accent" ? " uiKey--accent" : ""}${
        registered ? "" : " shortcutBadge--unavailable"
      }`}
      title={title}
      aria-label={title}
    >
      {value}
    </kbd>
  );
}
