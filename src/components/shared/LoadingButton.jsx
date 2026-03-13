import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
    border: '0.5px solid rgba(255,255,255,0.15)',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    boxShadow: 'none',
  },
}

const SIZES = {
  sm: { height: 36, fontSize: 'var(--text-sm)', px: 12, gap: 6 },
  md: { height: 44, fontSize: 'var(--text-base)', px: 16, gap: 8 },
  lg: { height: 52, fontSize: 'var(--text-md)', px: 20, gap: 8 },
}

export function LoadingButton({
  children, isLoading, loadingText, variant = 'primary', size = 'md',
  disabled, style: sx, onClick, ...rest
}) {
  const handleClick = onClick ? (e) => { if (!isLoading && !disabled) navigator.vibrate?.(8); onClick(e) } : undefined
  const v = VARIANTS[variant] || VARIANTS.primary
  const s = SIZES[size] || SIZES.md

  return (
    <button
      disabled={isLoading || disabled}
      onClick={handleClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap, height: s.height, padding: `0 ${s.px}px`,
        borderRadius: 12, fontSize: s.fontSize, fontWeight: 600,
        cursor: isLoading || disabled ? 'not-allowed' : 'pointer',
        opacity: isLoading || disabled ? 0.6 : 1,
        transition: 'opacity 0.2s, transform 0.1s',
        whiteSpace: 'nowrap',
        ...v, ...sx,
      }}
      {...rest}
    >
      {isLoading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
      {isLoading ? (loadingText || children) : children}
    </button>
  )
}
