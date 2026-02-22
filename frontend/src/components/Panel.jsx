export default function Panel({ title, children, className = '' }) {
  return (
    <section
      className={`
        rounded-lg border border-matrix-border bg-matrix-surface/80 backdrop-blur
        shadow-glow overflow-hidden ${className}
      `}
    >
      <header className="flex items-center gap-2 border-b border-matrix-border px-4 py-2.5 bg-matrix-bg/50">
        <span className="text-matrix-cyan font-semibold text-sm tracking-wider">&gt;&gt;</span>
        <h2 className="text-matrix-green font-mono font-semibold text-sm uppercase tracking-widest">
          {title}
        </h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}
