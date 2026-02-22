export default function StatusBar({ message, error, position }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-matrix-border bg-matrix-surface/95 backdrop-blur px-4 py-2 flex items-center justify-between text-xs font-mono text-matrix-green-dim z-50">
      <span className={error ? 'text-matrix-red' : ''}>
        {error ? `[ERR] ${message}` : message ? `[OK] ${message}` : '> idle'}
      </span>
      {position != null && (
        <span className="text-matrix-dim">mouse: ({position.x}, {position.y})</span>
      )}
    </div>
  )
}
