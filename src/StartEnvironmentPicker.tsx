import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LauncherButton, OverlayPage } from "./types";
import { UiIcon } from "./components/UiIcon";

type PickerTab = "all" | "sidebar" | "dictionary";

type StartEnvironmentPickerProps = {
  buttons: LauncherButton[];
  overlayPages: OverlayPage[];
  selectedIds: string[];
  onChange: (buttonIds: string[]) => void;
  renderIcon: (button: LauncherButton, className: string) => ReactNode;
  maxSelected?: number;
};

const TAB_LABELS: Record<PickerTab, string> = {
  all: "すべて",
  sidebar: "サイドバー",
  dictionary: "辞書",
};

function isInTab(button: LauncherButton, tab: PickerTab) {
  if (tab === "sidebar") return button.showInSidebar !== false;
  if (tab === "dictionary") return button.showInOverlay !== false;
  return button.showInSidebar !== false || button.showInOverlay !== false;
}

export function StartEnvironmentPicker({
  buttons,
  overlayPages,
  selectedIds,
  onChange,
  renderIcon,
  maxSelected = 2,
}: StartEnvironmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [tab, setTab] = useState<PickerTab>("all");
  const [query, setQuery] = useState("");
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const buttonById = useMemo(
    () => new Map(buttons.map((button) => [button.id, button])),
    [buttons],
  );
  const pageNameById = useMemo(
    () => new Map(overlayPages.map((page) => [page.id, page.name])),
    [overlayPages],
  );

  const selectedRows = selectedIds.map((id) => ({ id, button: buttonById.get(id) }));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredButtons = buttons.filter((button) => {
    if (!isInTab(button, tab)) return false;
    if (!normalizedQuery) return true;
    const category =
      tab === "dictionary" || button.showInSidebar === false
        ? (pageNameById.get(button.overlayPageId ?? "") ?? "未分類")
        : button.group?.trim() || "その他";
    return [button.label, category, ...(button.aliases ?? [])].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    );
  });

  const categoryFor = (button: LauncherButton) => {
    const sidebarCategory = button.group?.trim() || "その他";
    const dictionaryCategory = pageNameById.get(button.overlayPageId ?? "") ?? "未分類";
    if (tab === "dictionary" || button.showInSidebar === false) return dictionaryCategory;
    if (tab === "sidebar" || button.showInOverlay === false) return sidebarCategory;
    return sidebarCategory;
  };

  const returnFocus = () => {
    window.requestAnimationFrame(() => openerRef.current?.focus());
  };

  const closePicker = () => {
    setOpen(false);
    returnFocus();
  };

  const openPicker = () => {
    setDraftIds([...selectedIds]);
    setTab("all");
    setQuery("");
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const toggleDraft = (buttonId: string) => {
    setDraftIds((current) => {
      if (current.includes(buttonId)) return current.filter((id) => id !== buttonId);
      if (current.length >= maxSelected) return current;
      return [...current, buttonId];
    });
  };

  return (
    <div className="startEnvironmentPicker">
      <div className="startEnvironmentHeader">
        <div>
          <strong>開始環境</strong>
          <span>タイマー開始時に順番に実行します</span>
        </div>
        <span
          className={
            selectedIds.length > maxSelected
              ? "startEnvironmentCount startEnvironmentCount--over"
              : "startEnvironmentCount"
          }
        >
          {selectedIds.length} / {maxSelected}
        </span>
      </div>

      {selectedRows.length > 0 ? (
        <div aria-label="選択済みの開始環境" className="startEnvironmentSelected">
          {selectedRows.map(({ id, button }) => (
            <div className="startEnvironmentSelectedItem" key={id}>
              {button ? (
                renderIcon(button, "startEnvironmentIcon")
              ) : (
                <span className="startEnvironmentIcon">?</span>
              )}
              <span title={button?.label ?? id}>{button?.label ?? "登録が見つかりません"}</span>
              <button
                aria-label={`${button?.label ?? id}を開始環境から外す`}
                className="startEnvironmentRemove"
                onClick={() => onChange(selectedIds.filter((selectedId) => selectedId !== id))}
                title="選択解除"
                type="button"
              >
                <UiIcon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="startEnvironmentEmpty">開始環境は選択されていません</p>
      )}

      {selectedIds.length > maxSelected ? (
        <p className="startEnvironmentWarning" role="status">
          保存済みの選択は保持しています。新しく追加するには{maxSelected}件以下まで外してください。
        </p>
      ) : null}

      <button
        className="secondaryButton startEnvironmentOpen"
        onClick={openPicker}
        ref={openerRef}
        type="button"
      >
        開始環境を選ぶ
      </button>

      {open ? (
        <div
          className="modalBackdrop startEnvironmentBackdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePicker();
          }}
          role="presentation"
        >
          <section
            aria-label="開始環境を選ぶ"
            aria-modal="true"
            className="dropDialog startEnvironmentDialog"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              closePicker();
            }}
            role="dialog"
          >
            <header className="startEnvironmentDialogHeader">
              <div>
                <p className="eyebrow">Start Environment</p>
                <h2>開始環境を選ぶ</h2>
              </div>
              <span
                className={
                  draftIds.length > maxSelected
                    ? "startEnvironmentCount startEnvironmentCount--over"
                    : "startEnvironmentCount"
                }
              >
                {draftIds.length} / {maxSelected}
              </span>
            </header>

            <div aria-label="表示対象" className="startEnvironmentTabs" role="tablist">
              {(Object.keys(TAB_LABELS) as PickerTab[]).map((key) => (
                <button
                  aria-selected={tab === key}
                  className={
                    tab === key
                      ? "startEnvironmentTab startEnvironmentTab--active"
                      : "startEnvironmentTab"
                  }
                  key={key}
                  onClick={() => setTab(key)}
                  role="tab"
                  type="button"
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>

            <label className="startEnvironmentSearch">
              <span className="srOnly">開始環境を検索</span>
              <input
                className="textInput"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="名前・カテゴリから検索"
                ref={searchRef}
                type="search"
                value={query}
              />
            </label>

            <div
              className="startEnvironmentOptions app-scrollbar"
              role="listbox"
              aria-multiselectable="true"
            >
              {filteredButtons.map((button) => {
                const selected = draftIds.includes(button.id);
                const additionBlocked = !selected && draftIds.length >= maxSelected;
                return (
                  <button
                    aria-disabled={additionBlocked}
                    aria-selected={selected}
                    className={
                      selected
                        ? "startEnvironmentOption startEnvironmentOption--selected"
                        : "startEnvironmentOption"
                    }
                    key={button.id}
                    onClick={() => {
                      if (!additionBlocked) toggleDraft(button.id);
                    }}
                    role="option"
                    type="button"
                  >
                    {renderIcon(button, "startEnvironmentOptionIcon")}
                    <span className="startEnvironmentOptionCopy">
                      <strong>{button.label}</strong>
                      <small>{categoryFor(button)}</small>
                    </span>
                    <span aria-hidden="true" className="startEnvironmentOptionState">
                      {selected ? "✓" : additionBlocked ? "上限" : ""}
                    </span>
                  </button>
                );
              })}
              {filteredButtons.length === 0 ? (
                <p className="startEnvironmentNoResults">該当する開始環境はありません</p>
              ) : null}
            </div>

            <div className="dialogActions">
              <button className="secondaryButton" onClick={closePicker} type="button">
                キャンセル
              </button>
              <button
                className="primaryButton"
                onClick={() => {
                  onChange(draftIds);
                  setOpen(false);
                  returnFocus();
                }}
                type="button"
              >
                選択を反映
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
