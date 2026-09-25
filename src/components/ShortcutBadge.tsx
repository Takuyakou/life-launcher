type ShortcutBadgeProps = {
  label: string;
  shortcut: string | null | undefined;
  registered: boolean;
};

export function ShortcutBadge({ label, shortcut, registered }: ShortcutBadgeProps) {
  const value = shortcut?.trim();
  if (!value) return null;

  const title = registered
    ? `${label}: ${value}`
    : `${label}: ${value}（ショートカットを登録できていません）`;
  return (
    <kbd
      className={`shortcutBadge${registered ? "" : " shortcutBadge--unavailable"}`}
      title={title}
      aria-label={title}
    >
      {value}
    </kbd>
  );
}
