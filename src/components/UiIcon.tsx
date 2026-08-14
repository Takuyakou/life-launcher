import type { SVGProps } from "react";

export type UiIconName =
  | "add"
  | "back"
  | "book"
  | "clock"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "close"
  | "edit"
  | "external"
  | "fileCode"
  | "fileText"
  | "folder"
  | "help"
  | "lock"
  | "miniMode"
  | "pause"
  | "pin"
  | "play"
  | "power"
  | "records"
  | "refresh"
  | "settings"
  | "unlock";

type UiIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: UiIconName;
  size?: 16 | 18 | 20;
};

export function UiIcon({ name, size = 18, className, ...props }: UiIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  const content =
    name === "add" ? (
      <path {...common} d="M12 5v14M5 12h14" />
    ) : name === "back" ? (
      <path {...common} d="m14.5 6-6 6 6 6M9 12h10" />
    ) : name === "book" ? (
      <>
        <path {...common} d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" />
        <path {...common} d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22V5.5Z" />
      </>
    ) : name === "clock" ? (
      <>
        <circle {...common} cx="12" cy="12" r="8.5" />
        <path {...common} d="M12 7.5V12l3 2" />
      </>
    ) : name === "chevronDown" ? (
      <path {...common} d="m6 9 6 6 6-6" />
    ) : name === "chevronLeft" ? (
      <path {...common} d="m15 6-6 6 6 6" />
    ) : name === "chevronRight" ? (
      <path {...common} d="m9 6 6 6-6 6" />
    ) : name === "close" ? (
      <path {...common} d="m6 6 12 12M18 6 6 18" />
    ) : name === "edit" ? (
      <>
        <path {...common} d="m4 20 4.2-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
        <path {...common} d="m13.8 7.4 2.8 2.8" />
      </>
    ) : name === "external" ? (
      <>
        <path {...common} d="M14 4h6v6M20 4l-9 9" />
        <path {...common} d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
      </>
    ) : name === "fileCode" ? (
      <>
        <path {...common} d="M6 3.5h8l4 4V21H6V3.5Z" />
        <path {...common} d="M14 3.5V8h4M11 12l-2 2 2 2M15 12l2 2-2 2" />
      </>
    ) : name === "fileText" ? (
      <>
        <path {...common} d="M6 3.5h8l4 4V21H6V3.5Z" />
        <path {...common} d="M14 3.5V8h4M9 12h6M9 15h6M9 18h4" />
      </>
    ) : name === "folder" ? (
      <path {...common} d="M3.5 6.5h6l2 2h9v9.8A1.7 1.7 0 0 1 18.8 20H5.2a1.7 1.7 0 0 1-1.7-1.7V6.5Z" />
    ) : name === "help" ? (
      <>
        <path {...common} d="M9.6 9a2.5 2.5 0 1 1 4.3 1.7c-1.2 1-1.9 1.5-1.9 3.3" />
        <path {...common} d="M12 17.5h.01" />
        <circle {...common} cx="12" cy="12" r="9" />
      </>
    ) : name === "lock" ? (
      <>
        <rect {...common} height="10" rx="2" width="14" x="5" y="10" />
        <path {...common} d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ) : name === "miniMode" ? (
      <>
        <rect {...common} height="15" rx="2" width="17" x="3.5" y="4.5" />
        <path {...common} d="M13 4.5v6h7.5M13 10.5h7.5" />
      </>
    ) : name === "pause" ? (
      <path {...common} d="M9 6v12M15 6v12" />
    ) : name === "pin" ? (
      <>
        <path {...common} d="m9 4 6 6m-7 1 5 5m-3-9 6 6M7 17l-3 3" />
        <path {...common} d="m14 4 2 2-3 3 2 2-3 3-5-5 3-3 2 2 3-3Z" />
      </>
    ) : name === "play" ? (
      <path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none" />
    ) : name === "power" ? (
      <>
        <path {...common} d="M12 3v9" />
        <path {...common} d="M7.1 5.7a7 7 0 1 0 9.8 0" />
      </>
    ) : name === "records" ? (
      <>
        <rect {...common} height="16" rx="2" width="14" x="5" y="4" />
        <path {...common} d="M9 9h6M9 13h6M9 17h4" />
      </>
    ) : name === "refresh" ? (
      <>
        <path {...common} d="M20 12a8 8 0 0 0-14.4-4.8L4 9" />
        <path {...common} d="M4 4v5h5M4 12a8 8 0 0 0 14.4 4.8L20 15" />
        <path {...common} d="M20 20v-5h-5" />
      </>
    ) : name === "unlock" ? (
      <>
        <rect {...common} height="10" rx="2" width="14" x="5" y="10" />
        <path {...common} d="M16 10V7a4 4 0 0 0-7.5-2" />
      </>
    ) : (
      <>
        <circle {...common} cx="12" cy="12" r="3" />
        <path {...common} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.3 2.3-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.3-2.3.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4.7v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L6 7.7l2.3-2.3.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.3 2.3-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3.2h-.2a1.7 1.7 0 0 0-1.4 1.2Z" />
      </>
    );

  return (
    <svg
      aria-hidden="true"
      className={className ? `uiIcon ${className}` : "uiIcon"}
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {content}
    </svg>
  );
}
