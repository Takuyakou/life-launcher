import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { springSnappy } from "../motion";
import { buttonGlyph, PROJECT_COLOR_IDS, resolveProjectColorId } from "../projectIdentity";
import type { ProjectColorId } from "../types";
import { UiIcon } from "./UiIcon";
import type { ExitPresenceAttributes } from "./ExitPresence";

export type SearchItemKind = "nextStep" | "wishlist" | "button" | "instruction" | "action";

export type SearchItem = {
  /** Stable id: the palette looks the entry up again by this id before running it. */
  id: string;
  kind: SearchItemKind;
  title: string;
  subtitle?: string;
  meta?: string;
  /** P10-14d (S1): presentation only. The caller may pass the button's glyph and the
      Project's own colour; without them the row draws its fallback. */
  icon?: string;
  projectId?: string;
  colorId?: ProjectColorId | null;
  /** P10-14d (S1): the overlay page a button lives on, shown after the group name. */
  pageName?: string;
};

export type SearchSection = {
  id: string;
  title: string;
  items: SearchItem[];
  /** How many results the group found, before it was cut to five. */
  total: number;
};

type SearchPaletteProps = {
  sections: SearchSection[];
  query: string;
  onQueryChange: (value: string) => void;
  onActivate: (item: SearchItem, mode: "enter" | "shift") => void;
  onClose: () => void;
  busy?: boolean;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

const LIST_ID = "search-palette-list";

/** P10-14d (S1): the Project name sits above the step text on these two kinds of row. */
function projectNameOf(item: SearchItem): string | undefined {
  if (item.kind !== "nextStep" && item.kind !== "wishlist") return undefined;
  return item.subtitle?.trim() || undefined;
}

/** P10-14d (S1): the project-colour dot. An explicit colour wins; otherwise the same
    automatic colour the Project's own ProjectIdentity dot gets. */
function projectColorOf(
  item: SearchItem,
  knownColors: Record<string, ProjectColorId>,
): ProjectColorId | undefined {
  if (item.colorId) return item.colorId;
  const projectName = projectNameOf(item);
  if (projectName && knownColors[projectName]) return knownColors[projectName];
  const projectId =
    item.projectId ?? (item.kind === "nextStep" ? item.id.slice("nextStep:".length) : undefined);
  if (projectId) return resolveProjectColorId(projectId);
  return projectName ? resolveProjectColorId(projectName) : undefined;
}

/** P10-14d (S1): the 12px grey hint at the right edge. Buttons show "group ・ page",
    instructions show the folder path, and a Next Step keeps its existing trigger text. */
function rowHintOf(item: SearchItem): string | undefined {
  if (item.kind === "button") {
    const group = item.subtitle?.trim();
    const page = item.pageName?.trim() || item.meta?.trim();
    if (group && page) return `${group} ・ ${page}`;
    return group || page || undefined;
  }
  if (item.kind === "instruction") return item.subtitle?.trim() || undefined;
  if (item.kind === "nextStep") return item.meta?.trim() || undefined;
  return undefined;
}

/** P10-14d (S2): what Enter does, as text. Actions run nothing on Enter. */
function enterHintOf(item: SearchItem): string | undefined {
  switch (item.kind) {
    case "nextStep":
      return "5分で始める";
    case "wishlist":
      return "次の一手にする";
    case "button":
    case "instruction":
      return "開く";
    default:
      return undefined;
  }
}

/** P10-03 (D4): the search window that sits above the main window. */
export function SearchPalette({
  sections,
  query,
  onQueryChange,
  onActivate,
  onClose,
  busy = false,
  exitProps,
}: SearchPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Kept so Enter still tries the entry that was selected before the list shrank (the caller
  // looks it up again and warns when it is gone).
  const lastSelectedRef = useRef<SearchItem | null>(null);

  // V151-S7: the App re-renders every second while a timer runs, which rebuilt `sections`.
  // Only a change in the listed entries (or the query) may move the selection back to the top.
  const itemKey = useMemo(() => flat.map((item) => item.id).join("\n"), [flat]);

  // A new result list always starts at the first entry.
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, itemKey]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // P10-14d (S1): the palette receives text only, and a wishlist id has no Project id in it.
  // The main screen has already resolved each Project's colour into its ProjectIdentity dot,
  // so reuse those colours for the dot (passing SearchItem.colorId skips this).
  const [knownProjectColors, setKnownProjectColors] = useState<Record<string, ProjectColorId>>({});
  useEffect(() => {
    if (typeof document === "undefined") return;
    const colors: Record<string, ProjectColorId> = {};
    for (const element of document.querySelectorAll<HTMLElement>("[data-project-color][title]")) {
      const title = element.getAttribute("title") ?? "";
      const prefix = "プロジェクト: ";
      if (!title.startsWith(prefix)) continue;
      const name = title.slice(prefix.length).trim();
      const color = element.dataset.projectColor;
      if (name && color && PROJECT_COLOR_IDS.includes(color as ProjectColorId)) {
        colors[name] = color as ProjectColorId;
      }
    }
    setKnownProjectColors(colors);
  }, [itemKey]);

  const selected = flat[Math.min(selectedIndex, Math.max(flat.length - 1, 0))];
  if (selected) lastSelectedRef.current = selected;

  useEffect(() => {
    const selectedId = selected?.id;
    if (!selectedId) return;
    const element = dialogRef.current?.querySelector<HTMLElement>(`[data-search-item="${selectedId}"]`);
    element?.scrollIntoView({ block: "nearest" });
  }, [selected?.id]);

  const move = useCallback(
    (delta: number) => {
      if (flat.length === 0) return;
      setSelectedIndex((current) => {
        const next = current + delta;
        if (next < 0) return 0;
        if (next > flat.length - 1) return flat.length - 1;
        return next;
      });
    },
    [flat.length],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const native = event.nativeEvent;
    if (event.key === "Escape") {
      // Japanese input uses Escape to cancel the conversion; never close while composing.
      if (native.isComposing || native.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === "Enter") {
      // Japanese input uses Enter to commit; never run anything while composing.
      if (native.isComposing || native.keyCode === 229) return;
      const target = selected ?? lastSelectedRef.current;
      if (!target || busy) return;
      event.preventDefault();
      onActivate(target, event.shiftKey ? "shift" : "enter");
      return;
    }
    if (event.key === "Tab") {
      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("input, button, [tabindex='0']") ?? [],
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }
  };

  // V151-S2-3: the palette only receives keydown while focus is inside it. When focus moves to the
  // page (body) the window listener still closes the palette with one Escape. The capture phase and
  // stopImmediatePropagation keep the app's other Escape handlers (dialogs, menus, drags) out of it.
  // V164: while the close motion plays, the palette no longer takes Escape (the next one belongs to
  // whatever is under it).
  const exiting = exitProps?.["data-exiting"] === "true";
  useEffect(() => {
    if (exiting) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [exiting, onClose]);

  return (
    <div
      className="searchPaletteBackdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
      {...exitProps}
    >
      <section
        aria-label="検索"
        aria-modal="true"
        className="searchPalette"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="searchPaletteInputRow">
          <UiIcon name="search" size={18} />
          <input autoComplete="off"
            aria-autocomplete="list"
            aria-controls={LIST_ID}
            aria-activedescendant={selected ? `search-option-${selected.id}` : undefined}
            aria-expanded="true"
            aria-label="検索語"
            className="searchPaletteInput"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="一手・ボタン・手順書を検索"
            ref={inputRef}
            role="combobox"
            type="text"
            value={query}
          />
        </div>
        <div aria-label="検索結果" className="searchPaletteList app-scrollbar" id={LIST_ID} role="listbox">
          {sections.map((section) => (
            <div className="searchPaletteGroup" key={section.id}>
              <p className="searchPaletteGroupTitle">
                <span>{section.title}</span>
                <span className="searchPaletteGroupCount">{section.total}件</span>
              </p>
              {section.items.map((item) => {
                const isSelected = selected?.id === item.id;
                const projectName = projectNameOf(item);
                const hint = rowHintOf(item);
                const enterHint = enterHintOf(item);
                return (
                  <div
                    aria-selected={isSelected}
                    className={
                      isSelected ? "searchPaletteItem searchPaletteItem--selected" : "searchPaletteItem"
                    }
                    data-kind={item.kind}
                    data-search-item={item.id}
                    id={`search-option-${item.id}`}
                    key={item.id}
                    onClick={() => {
                      if (!busy) onActivate(item, "enter");
                    }}
                    role="option"
                  >
                    <AnimatePresence initial={false}>
                      {isSelected && (
                        <motion.span
                          animate={{ opacity: 1 }}
                          className="searchPaletteHighlight"
                          exit={{ opacity: 0 }}
                          initial={{ opacity: 0 }}
                          key="highlight"
                          layoutId="search-highlight"
                          transition={springSnappy}
                        />
                      )}
                    </AnimatePresence>
                    {item.kind === "nextStep" || item.kind === "wishlist" ? (
                      <span
                        aria-hidden="true"
                        className="searchPaletteItemIcon searchPaletteItemIcon--dot"
                        data-project-color={projectColorOf(item, knownProjectColors)}
                      >
                        <span className="projectIdentityDot searchPaletteItemDot" />
                      </span>
                    ) : item.kind === "instruction" ? (
                      <span
                        aria-hidden="true"
                        className="searchPaletteItemIcon searchPaletteItemIcon--glyph searchPaletteItemIcon--file"
                      >
                        <UiIcon name="fileText" size={16} />
                      </span>
                    ) : item.kind === "action" ? (
                      <span
                        aria-hidden="true"
                        className="searchPaletteItemIcon searchPaletteItemIcon--glyph searchPaletteItemIcon--action"
                      >
                        <UiIcon name="add" size={16} />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="searchPaletteItemIcon uiLetterIcon"
                        data-project-color={resolveProjectColorId(item.id)}
                      >
                        {buttonGlyph({ label: item.title, icon: item.icon })}
                      </span>
                    )}
                    <span className="searchPaletteItemText">
                      {projectName && (
                        <span className="searchPaletteItemSubtitle searchPaletteItemKicker">
                          {projectName}
                        </span>
                      )}
                      <span className="searchPaletteItemTitle">{item.title}</span>
                    </span>
                    <span className="searchPaletteItemRight">
                      {hint && <span className="searchPaletteItemMeta searchPaletteItemHint">{hint}</span>}
                      {isSelected && enterHint && (
                        <span
                          className={
                            item.kind === "nextStep"
                              ? "searchPaletteItemEnter searchPaletteItemEnter--start"
                              : "searchPaletteItemEnter"
                          }
                        >
                          {enterHint}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
