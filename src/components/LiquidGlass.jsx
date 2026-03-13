import { forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { LIQUID_GLASS, RADIUS, PADDING, SPRING, COLORS } from '../core/design.js'

// ══════════════════════════════════════════════════════════════════
// FF07 — LIQUID GLASS COMPONENT SYSTEM
// Hierarquia: GlassTray → NestedTray → Elementos (alto contraste)
//             GlassTray → ChartTray → BarChart
// ══════════════════════════════════════════════════════════════════

// ── GlassTray — container principal com gradiente colorido no topo ──
export function GlassTray({ children, accentColor = '#10b981', borderRadius = 28, icon, iconPosition = 'top-right', style: sx, className, ...rest }) {
  const bg = `linear-gradient(180deg, ${accentColor}25 0%, ${accentColor}15 20%, rgba(30, 34, 42, 0.50) 50%, rgba(30, 34, 42, 0.50) 100%)`
  const posMap = {
    'top-right': { top: 16, right: 16 },
    'top-left': { top: 16, left: 16 },
    'bottom-right': { bottom: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
  }
  return (
    <div
      data-glass
      className={className}
      style={{
        position: 'relative',
        background: bg,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '0.5px solid rgba(255, 255, 255, 0.18)',
        borderRadius,
        padding: 24,
        boxShadow: '0 2px 20px rgba(0, 0, 0, 0.08), inset 0 0.5px 0.5px rgba(255, 255, 255, 0.3)',
        overflow: 'hidden',
        ...sx,
      }}
      {...rest}
    >
      {/* Lensing refraction effect */}
      <div style={{
        position: 'absolute', top: 0, left: '20%', right: '20%', height: '40%',
        background: `radial-gradient(ellipse at center top, ${accentColor}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {icon && (
        <div style={{ position: 'absolute', ...posMap[iconPosition], zIndex: 1 }}>
          {icon}
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}

// ── NestedTray — sub-container cinza puro (SEM gradiente colorido) ──
export function NestedTray({ children, style: sx, className, ...rest }) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(30, 34, 42, 0.30)',
        border: '0.5px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        padding: 12,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

// ── ChartTray — fundo escuro para gráficos ──
export function ChartTray({ children, title, accentColor = '#10b981', style: sx, className, ...rest }) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(0, 0, 0, 0.15)',
        border: '0.5px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        padding: 16,
        ...sx,
      }}
      {...rest}
    >
      {title && (
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
          color: accentColor, textTransform: 'uppercase', marginBottom: 12,
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

// ── IconContainer — ícone decorativo com glow ──
export function IconContainer({ icon, color = '#10b981', size = 48, glow = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.5,
      background: `${color}15`,
      border: `0.5px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color,
      boxShadow: glow ? `0 0 16px ${color}30` : 'none',
      flexShrink: 0,
    }}>
      {icon}
    </div>
  )
}

// ── GlassModal — overlay modal com backdrop blur ──
export function GlassModal({ isOpen, onClose, children, accentColor = '#10b981', title, icon, width = 390 }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ width: '90%', maxWidth: width, maxHeight: '64vh', overflowY: 'auto' }}
          >
            <GlassTray accentColor={accentColor} borderRadius={32} style={{ padding: 24 }}>
              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  position: 'absolute', top: 16, right: 16, zIndex: 10,
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '0.5px solid rgba(255, 255, 255, 0.18)',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
              {/* Header */}
              {(icon || title) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  {icon}
                  {title && (
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', margin: 0 }}>
                      {title}
                    </h2>
                  )}
                </div>
              )}
              {children}
            </GlassTray>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── LiquidWidget — container principal de conteudo ──
export function LiquidWidget({ children, variant = 'default', style: sx, className, ...rest }) {
  const glass = LIQUID_GLASS[variant] || LIQUID_GLASS.default
  return (
    <div
      data-glass
      className={className}
      style={{
        ...glass,
        borderRadius: RADIUS.container,
        padding: PADDING.nested,
        position: 'relative',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

// ── LiquidCard — card clickable com nested corners ──
export function LiquidCard({ children, onClick, style: sx, className, ...rest }) {
  const Comp = onClick ? motion.button : motion.div
  return (
    <Comp
      onClick={onClick}
      whileHover={onClick ? { scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={SPRING.subtle}
      className={className}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: RADIUS.nested,
        padding: PADDING.nested,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', width: '100%',
        position: 'relative',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Comp>
  )
}

// ── PillButton — botao principal (FF07: glass, accent, colored, ghost) ──
const PILL_VARIANTS = {
  accent: {
    background: `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.emeraldDark})`,
    color: '#fff', border: 'none',
    boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
  },
  glass: {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    color: '#ffffff',
    border: '0.5px solid rgba(255, 255, 255, 0.18)',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '0.5px solid rgba(255,255,255,0.15)',
    boxShadow: 'none',
  },
  default: {
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    boxShadow: 'none',
  },
}

const PILL_SIZES = {
  xs: { h: 28, px: 10, fontSize: 11, gap: 4 },
  sm: { h: 36, px: 14, fontSize: 12, gap: 5 },
  md: { h: 44, px: 18, fontSize: 13, gap: 6 },
  lg: { h: 52, px: 24, fontSize: 14, gap: 8 },
  icon: { h: 44, px: 0, fontSize: 0, gap: 0, w: 44 },
}

export function PillButton({ children, variant = 'default', size = 'md', accentColor, onClick, disabled, style: sx, ...rest }) {
  const handleClick = onClick ? (e) => { navigator.vibrate?.(8); onClick(e) } : undefined
  let v = PILL_VARIANTS[variant] || PILL_VARIANTS.default
  // FF07: accent/colored use accentColor prop
  if (accentColor && variant === 'accent') {
    v = { ...v, background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 4px 16px ${accentColor}60` }
  }
  if (variant === 'colored' && accentColor) {
    v = { background: accentColor, color: '#fff', border: 'none', boxShadow: `0 4px 16px ${accentColor}60` }
  }
  const s = PILL_SIZES[size] || PILL_SIZES.md

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING.subtle}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap, height: s.h, width: s.w || 'auto',
        padding: s.w ? 0 : `0 ${s.px}px`,
        borderRadius: 999, fontSize: s.fontSize, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        ...v, ...sx,
      }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

// ── LiquidInput — input com focus glow ──
export const LiquidInput = forwardRef(function LiquidInput({ label, type = 'text', style: sx, ...rest }, ref) {
  const inputMode = rest.inputMode || (
    type === 'number' ? 'numeric' :
    type === 'email'  ? 'email'   :
    type === 'tel'    ? 'tel'     :
    type === 'url'    ? 'url'     : undefined
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        inputMode={inputMode}
        style={{
          height: 48, padding: '0 16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(255,255,255,0.12)',
          color: 'var(--text-primary)', fontSize: 15,
          outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
          ...sx,
        }}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(16,185,129,0.5)'
          e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)'
        }}
        onBlur={e => {
          e.target.style.borderColor = 'rgba(255,255,255,0.12)'
          e.target.style.boxShadow = 'none'
        }}
        {...rest}
      />
    </div>
  )
})

// ── StatusBadge (FF07 API: color + pulse) ──
const STATUS_MAP = {
  active:    { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Ativo' },
  pending:   { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Pendente' },
  inactive:  { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', label: 'Inativo' },
  completed: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Completo' },
}

export function StatusBadge({ status, label, color: colorProp, pulse = false }) {
  // FF07: aceita color directamente OU status string
  const s = colorProp
    ? { bg: `${colorProp}15`, color: colorProp, label: label || '' }
    : (STATUS_MAP[status] || STATUS_MAP.inactive)
  const c = s.color
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      background: s.bg, color: c,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `0.5px solid ${c}60`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: c,
        boxShadow: `0 0 6px ${c}`,
        animation: pulse ? 'ff-pulse 2s ease-in-out infinite' : 'none',
      }} />
      {label || s.label}
    </span>
  )
}

// ── GlowButton ──
export function GlowButton({ children, color = COLORS.emerald, onClick, style: sx, ...rest }) {
  const handleClick = onClick ? (e) => { navigator.vibrate?.(8); onClick(e) } : undefined
  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.05, boxShadow: `0 0 24px ${color}66` }}
      whileTap={{ scale: 0.95 }}
      transition={SPRING.subtle}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '10px 20px', borderRadius: 12,
        background: color, color: '#fff', border: 'none',
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        boxShadow: `0 4px 16px ${color}40`,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

// ── DepartmentPill ──
export function DepartmentPill({ name, color, count }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: `${color}18`, border: `0.5px solid ${color}30`,
      fontSize: 12, fontWeight: 600, color,
    }}>
      {name}
      {count !== undefined && (
        <span style={{
          fontSize: 10, fontWeight: 700, background: `${color}25`,
          padding: '1px 5px', borderRadius: 999,
        }}>
          {count}
        </span>
      )}
    </span>
  )
}
