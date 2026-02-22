import { PropsWithChildren } from "react";

type Variant = "primary" | "ghost" | "danger";

export function Button(
  props: PropsWithChildren<{
    onClick?: () => void;
    disabled?: boolean;
    variant?: Variant;
    className?: string;
    type?: "button" | "submit";
  }>
) {
  const v = props.variant || "primary";
  const base =
    "select-none inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-semibold tracking-wide border transition active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed";
  const style =
    v === "primary"
      ? "bg-ink-800 border-term-700 text-term-50 hover:shadow-glow"
      : v === "danger"
        ? "bg-ink-800 border-red-700 text-red-200 hover:shadow-[0_0_0_1px_rgba(239,68,68,0.25),0_0_24px_rgba(239,68,68,0.12)]"
        : "bg-transparent border-grid text-term-50/90 hover:border-term-700";

  return (
    <button type={props.type || "button"} disabled={props.disabled} onClick={props.onClick} className={`${base} ${style} ${props.className || ""}`}>
      {props.children}
    </button>
  );
}

