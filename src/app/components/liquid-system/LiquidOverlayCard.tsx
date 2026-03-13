/**
 * LIQUID OVERLAY CARD - Rich Hover Detail Panel
 * 
 * A floating overlay panel that appears on hover/click with:
 * - Spring entrance animation (scale + fade)
 * - Heavy blur (32px) + saturate for depth
 * - Colored accent border matching context
 * - Nested sections with dividers
 * - Auto-positioning (above or below trigger)
 * 
 * Based on Apple WWDC25 Liquid Glass overlay patterns.
 */

import { ReactNode, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { springConfigs } from '../../utils/liquidGlassStyles';

/* ──────────────────────────────────────────────────────────────────
   TYPES
────────────────────────────────────────────────────────────────── */

export interface LiquidOverlaySection {
  /** Section icon (ReactNode) */
  icon?: ReactNode;
  /** Section title */
  title: string;
  /** Accent color for section header */
  color?: string;
  /** Section content */
  content: ReactNode;
}

export interface LiquidOverlayCardProps {
  /** Whether the overlay is visible */
  isVisible: boolean;
  /** Accent color for the overlay border */
  accentColor?: string;
  /** Title of the overlay */
  title?: string;
  /** Subtitle */
  subtitle?: string;
  /** Structured sections */
  sections?: LiquidOverlaySection[];
  /** Or free-form children */
  children?: ReactNode;
  /** Position relative to trigger */
  position?: 'top' | 'bottom' | 'auto';
  /** Max width */
  maxWidth?: number;
  /** Enable pointer events (clickable content) */
  interactive?: boolean;
  /** Additional className */
  className?: string;
}

/* ──────────────────────────────────────────────────────────────────
   COMPONENT
────────────────────────────────────────────────────────────────── */

export function LiquidOverlayCard({
  isVisible,
  accentColor = 'rgba(255, 255, 255, 0.4)',
  title,
  subtitle,
  sections = [],
  children,
  position = 'bottom',
  maxWidth = 480,
  interactive = false,
  className = '',
}: LiquidOverlayCardProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [resolvedPosition, setResolvedPosition] = useState<'top' | 'bottom'>(
    position === 'auto' ? 'bottom' : position
  );

  // Auto-position: check if there's room below
  useEffect(() => {
    if (position !== 'auto' || !isVisible || !overlayRef.current) return;
    
    const rect = overlayRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.top;
    setResolvedPosition(spaceBelow < 300 ? 'top' : 'bottom');
  }, [isVisible, position]);

  const positionStyles: React.CSSProperties = resolvedPosition === 'top'
    ? { bottom: '100%', marginBottom: '8px' }
    : { top: '100%', marginTop: '8px' };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={overlayRef}
          className={`absolute left-0 right-0 z-50 ${className}`}
          style={{
            ...positionStyles,
            maxWidth: `${maxWidth}px`,
            pointerEvents: interactive ? 'auto' : 'none',
          }}
          initial={{ opacity: 0, y: resolvedPosition === 'top' ? 8 : -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: resolvedPosition === 'top' ? 8 : -8, scale: 0.96 }}
          transition={springConfigs.snappy}
        >
          <div
            className="rounded-[24px] overflow-hidden"
            style={{
              background: 'rgba(12, 12, 16, 0.92)',
              backdropFilter: 'blur(32px) saturate(150%)',
              WebkitBackdropFilter: 'blur(32px) saturate(150%)',
              border: `0.5px solid ${accentColor}60`,
              boxShadow: `
                0 12px 48px rgba(0, 0, 0, 0.5),
                0 4px 16px rgba(0, 0, 0, 0.3),
                0 0 24px ${accentColor}20,
                inset 0 0.5px 0.5px rgba(255, 255, 255, 0.2)
              `,
            }}
          >
            {/* Lensing effect */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: '24px',
                background: `radial-gradient(ellipse 120% 50% at 50% -5%, ${accentColor}15 0%, transparent 50%)`,
                mixBlendMode: 'overlay',
              }}
            />

            {/* Content */}
            <div className="relative z-10 p-5">
              {/* Header */}
              {(title || subtitle) && (
                <div
                  className="mb-4 pb-3"
                  style={{ borderBottom: '0.5px solid rgba(255, 255, 255, 0.1)' }}
                >
                  {title && (
                    <h4 className="text-base font-black mb-0.5" style={{ color: '#ffffff' }}>
                      {title}
                    </h4>
                  )}
                  {subtitle && (
                    <p className="text-xs font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                      {subtitle}
                    </p>
                  )}
                </div>
              )}

              {/* Structured sections */}
              {sections.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {sections.map((section, idx) => (
                    <div key={idx}>
                      {/* Section header */}
                      <div className="flex items-center gap-2 mb-2">
                        {section.icon && (
                          <span style={{ color: section.color || accentColor, display: 'flex' }}>
                            {section.icon}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-black uppercase tracking-wider"
                          style={{ color: section.color || accentColor }}
                        >
                          {section.title}
                        </span>
                      </div>
                      {/* Section content */}
                      {section.content}
                    </div>
                  ))}
                </div>
              )}

              {/* Free-form children */}
              {children}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

LiquidOverlayCard.displayName = 'LiquidOverlayCard';

/* ──────────────────────────────────────────────────────────────────
   HELPER: Overlay List Item
────────────────────────────────────────────────────────────────── */

export interface LiquidOverlayListItemProps {
  children: ReactNode;
  color?: string;
}

export function LiquidOverlayListItem({ children, color }: LiquidOverlayListItemProps) {
  return (
    <div
      className="text-xs font-medium px-2.5 py-1.5 rounded-lg mb-1"
      style={{
        background: color ? `${color}12` : 'rgba(255, 255, 255, 0.05)',
        color: 'rgba(255, 255, 255, 0.8)',
        border: color ? `0.5px solid ${color}25` : undefined,
      }}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   HELPER: Overlay Script Block
────────────────────────────────────────────────────────────────── */

export interface LiquidOverlayScriptBlockProps {
  lines: string[];
  color?: string;
  maxHeight?: number;
}

export function LiquidOverlayScriptBlock({
  lines,
  color = '#3b82f6',
  maxHeight = 128,
}: LiquidOverlayScriptBlockProps) {
  return (
    <div
      className="text-[11px] font-mono leading-relaxed p-2.5 rounded-lg overflow-y-auto"
      style={{
        maxHeight: `${maxHeight}px`,
        background: `${color}10`,
        color: 'rgba(255, 255, 255, 0.7)',
        border: `0.5px solid ${color}25`,
      }}
    >
      {lines.map((line, i) => (
        <div key={i} className="mb-0.5">{line}</div>
      ))}
    </div>
  );
}
