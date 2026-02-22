export default function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  ...rest
}) {
  const base = 'font-mono text-sm font-medium px-4 py-2 rounded border transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:
      'bg-matrix-green/10 border-matrix-green text-matrix-green hover:bg-matrix-green/20 hover:shadow-glow active:scale-[0.98]',
    danger:
      'bg-matrix-red/10 border-matrix-red text-matrix-red hover:bg-matrix-red/20 active:scale-[0.98]',
    ghost:
      'border-matrix-dim text-matrix-green-dim hover:border-matrix-green hover:text-matrix-green hover:bg-matrix-green/5 active:scale-[0.98]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
