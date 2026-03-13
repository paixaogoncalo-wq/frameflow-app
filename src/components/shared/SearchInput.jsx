import { useRef } from 'react'
import { Search, X } from 'lucide-react'

const SIZES = {
  compact: { height: 36, fontSize: 'var(--text-sm)', iconSize: 14, px: 10 },
  default: { height: 44, fontSize: 'var(--text-base)', iconSize: 16, px: 12 },
  large:   { height: 52, fontSize: 'var(--text-md)', iconSize: 18, px: 16 },
}

export function SearchInput({ value, onChange, placeholder = 'Pesquisar...', variant = 'default', style: sx, ...rest }) {
  const ref = useRef(null)
  const s = SIZES[variant] || SIZES.default

  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      height: s.height, borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '0.5px solid rgba(255,255,255,0.1)',
      transition: 'border-color 0.2s',
      ...sx,
    }}>
      <Search size={s.iconSize} style={{
        position: 'absolute', left: s.px, color: 'var(--text-muted)',
        pointerEvents: 'none',
      }} />
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="search"
        style={{
          width: '100%', height: '100%', background: 'transparent', border: 'none',
          color: 'var(--text-primary)', fontSize: s.fontSize,
          paddingLeft: s.px + s.iconSize + 8,
          paddingRight: value ? s.px + 24 : s.px,
          outline: 'none',
        }}
        {...rest}
      />
      {value && (
        <button
          onClick={() => { onChange(''); ref.current?.focus() }}
          style={{
            position: 'absolute', right: s.px - 2,
            width: 24, height: 24, borderRadius: 6,
            background: 'rgba(255,255,255,0.08)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
