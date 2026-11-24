import type { Dispatch, SetStateAction } from "react";
import type { ActiveView, ContextMenuTarget } from "../app/dashboardTypes";
import type { ShortcutRegistrationStatus, TestProfileInfo } from "../tauri";
import type { AppConfig } from "../types";
import { TOP_MENU_GROUP_LABELS, TOP_MENU_LABELS } from "../app/dashboardTypes";
import { ShortcutBadge } from "./ShortcutBadge";
import { UiIcon } from "./UiIcon";

// V164-A1: the top bar, moved out of App.tsx (same DOM, text and handlers).

export type TopBarProps = {
  activeView: ActiveView;
  config: AppConfig;
  openContextMenu: (
    target: ContextMenuTarget,
    x: number,
    y: number,
    opener?: HTMLElement | null,
  ) => void;
  openInstructionsManually: () => Promise<void>;
  openSearchPalette: () => void;
  openSettingsCenter: () => void;
  setActiveView: Dispatch<SetStateAction<ActiveView>>;
  shortcutRegistration: ShortcutRegistrationStatus | null;
  testProfile: TestProfileInfo | null;
  toggleAutoStart: () => Promise<void>;
  topMenuBarRef: Dispatch<SetStateAction<HTMLElement | null>>;
  topMenuLabelLevel: number;
  topMenuPillsRef: Dispatch<SetStateAction<HTMLDivElement | null>>;
};

export function TopBar({
  activeView,
  config,
  openContextMenu,
  openInstructionsManually,
  openSearchPalette,
  openSettingsCenter,
  setActiveView,
  shortcutRegistration,
  testProfile,
  toggleAutoStart,
  topMenuBarRef,
  topMenuLabelLevel,
  topMenuPillsRef,
}: TopBarProps) {
  return (
    <header
      className="topBar"
      data-tauri-drag-region=""
      data-top-menu-labels={topMenuLabelLevel}
      ref={topMenuBarRef}
    >
      <div
        className="topBrand"
        data-tauri-drag-region=""
        onContextMenu={(event) => {
          event.preventDefault();
          openContextMenu(
            { kind: "sidebar" },
            event.clientX,
            event.clientY,
            event.currentTarget,
          );
        }}
      >
        <span className="topBrandIcon" aria-hidden="true" data-tauri-drag-region="">
          <img alt="" draggable={false} src="/life-launcher-icon.svg" />
        </span>
        <span className="topBrandName" data-tauri-drag-region="">
          Life Launcher
        </span>
        {testProfile?.testProfile && (
          <span className="uiPill testProfileBadge" title="テスト用の起動（普段のデータとは別）">
            テスト
          </span>
        )}
        {shortcutRegistration && (
          <ShortcutBadge
            label="Life Launcherを表示/隠す"
            shortcut={config?.settings.focusHotkey}
            registered={shortcutRegistration.main}
          />
        )}
      </div>
      <button
        aria-keyshortcuts="Control+F"
        aria-label="一手・ボタン・手順書を検索(Ctrl+F)"
        className="topSearchButton"
        data-top-search=""
        onClick={() => openSearchPalette()}
        title="一手・ボタン・手順書を検索(Ctrl+F)"
        type="button"
      >
        <UiIcon name="search" size={18} />
        <span className="topSearchLabel">検索</span>
        <ShortcutBadge label="検索" registered shortcut="Ctrl+F" tone="muted" />
      </button>

      <div className="topPills" data-tauri-drag-region="" ref={topMenuPillsRef}>
        <div
          aria-label={TOP_MENU_GROUP_LABELS.autoStart}
          className="topPillGroup topPillGroup--autostart"
          role="group"
        >
          <button
            aria-label="Windows自動起動"
            aria-pressed={config.settings.autoStart === true}
            className={
              config.settings.autoStart
                ? "viewToggleButton viewToggleButton--autoStart viewToggleButton--active"
                : "viewToggleButton viewToggleButton--autoStart"
            }
            onClick={() => void toggleAutoStart()}
            title={config.settings.autoStart ? "Windows自動起動: ON" : "Windows自動起動: OFF"}
            type="button"
          >
            <UiIcon name="power" size={18} />
            {config.settings.autoStart && (
              <span aria-hidden="true" className="autoStartDot" />
            )}
          </button>
        </div>
        <span aria-hidden="true" className="topPillsDivider" />
        <div
          aria-label={TOP_MENU_GROUP_LABELS.work}
          className="topPillGroup topPillGroup--work"
          role="group"
        >
          <button
            className="viewToggleButton"
            data-view-toggle=""
            onClick={() => setActiveView((view) => (view === "records" ? "main" : "records"))}
            title={activeView === "records" ? "メイン画面に戻る" : "記録ビューを開く"}
            aria-label={activeView === "records" ? "メイン画面に戻る" : "記録ビューを開く"}
            type="button"
          >
            <UiIcon name={activeView === "records" ? "back" : "records"} size={18} />
            <span className="viewToggleButtonLabel">
              {activeView === "records" ? TOP_MENU_LABELS.dashboard : TOP_MENU_LABELS.records}
            </span>
          </button>
          <button
            aria-label="手順書を開く"
            className="viewToggleButton"
            data-menu-label-secondary=""
            onClick={() => void openInstructionsManually()}
            title="手順書を開く"
            type="button"
          >
            <UiIcon name="book" size={18} />
            <span className="viewToggleButtonLabel">
              {TOP_MENU_LABELS.instructions}
            </span>
          </button>
          <button
            className="viewToggleButton"
            data-menu-label-secondary=""
            onClick={openSettingsCenter}
            title="設定を開く"
            aria-label="設定を開く"
            type="button"
          >
            <UiIcon name="settings" size={18} />
            <span className="viewToggleButtonLabel">{TOP_MENU_LABELS.settings}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
