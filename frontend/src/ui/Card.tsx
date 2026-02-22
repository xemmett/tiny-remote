import { PropsWithChildren, type ReactNode } from "react";

export function Card(props: PropsWithChildren<{ title: string; right?: ReactNode }>) {
  return (
    <section className="border border-grid bg-ink-900/70 shadow-glow">
      <header className="flex items-center justify-between gap-4 border-b border-grid px-4 py-3">
        <div className="text-sm font-bold tracking-wide text-term-200">{props.title}</div>
        {props.right ? <div className="text-xs text-term-50/80">{props.right}</div> : null}
      </header>
      <div className="p-4">{props.children}</div>
    </section>
  );
}

