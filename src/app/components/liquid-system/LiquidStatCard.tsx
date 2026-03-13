/**
 * LIQUID STAT CARD - Interactive Stat Display
 * 
 * Stat/metric card with:
 * - Spring press micro-interaction
 * - Hover glow intensification
 * - Animated value transitions
 * - Dot indicator with pulse
 * - Trend indicator (up/down/neutral)
 * 
 * Based on Apple WWDC25 Liquid Glass widget patterns.
 */

import { ReactNode, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { glassCard, lensingOverlay, springConfigs, type GlassVariant } from '../../utils/liquidGlassStyles';

/* ──────────────────────────────────────────────────────────────────
   TYPES
────────────────────────────────────────────────────────────────── */

export interface LiquidStatCardProps {
  /** Stat label */
  label: string;
  /** Stat value */
  value: string | number;
  /** Optional icon */
  icon?: ReactNode;
  /** Color variant */
  variant?: GlassVariant;
  /** Trend direction */
  trend?: 'up' | 'down' | 'neutral';
  /** Trend value (e.g. '+12%') */
  trendValue?: string;
  /** On click handler */
  onClick?: () => void;
  /** Show pulsing dot indicator */
  pulse?: boolean;
  /** Animation delay */
  animationDelay?: number;
  /** Subtitle text */
  subtitle?: string;
}

/* ──────────────────────────────────────────────────────────────────
   ACCENT COLOR MAP
────────────────────────────────────────────────────────────────── */

const ACCENT_HEX: Record<string, string> = {
  emerald: '#10b981',
  blue: '#3b82f6',
  purple: '#a855f7',
  amber: '#f59e0b',
  error: '#ef4444',
  primary: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  default: '#ffffff',
};

/* ──────────────────────────────────────────────────────────────────
   COMPONENT
────────────────────────────────────────────────────────────────── */

export function LiquidStatCard({
  label,
  value,
  icon,
  variant = 'default',
  trend,
  trendValue,
  onClick,
  pulse = false,
  animationDelay = 0,
  subtitle,
}: LiquidStatCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const accentHex = ACCENT_HEX[variant] || ACCENT_HEX.default;
  const cardStyles = glassCard({ intensity: 'subtle', variant, radius: 'xl', interactive: !!onClick });
  const lensingStyles = lensingOverlay({ radius: 'xl' });

  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...springConfigs.gentle,
        delay: animationDelay / 1000,
      }}
      whileHover={onClick ? { scale: 1.03, boxShadow: `0 8px 32px ${accentHex}25` } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        ...cardStyles,
        padding: '24px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Lensing */}
      <div style={lensingStyles} />

      {/* Hover glow intensification */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ borderRadius: 'inherit' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <div
          className="absolute inset-0"
          style={{
            borderRadius: 'inherit',
            boxShadow: `inset 0 0 30px ${accentHex}10, 0 0 40px ${accentHex}08`,
          }}
        />
      </motion.div>

      {/* Content */}
      <div className="relative z-10">
        {/* Top row: label + icon */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {pulse && (
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                style={{
                  background: accentHex,
                  boxShadow: `0 0 8px ${accentHex}, 0 0 16px ${accentHex}60`,
                }}
              />
            )}
            <span
              className="text-xs font-black uppercase tracking-wider"
              style={{ color: 'var(--fb-text-secondary)' }}
            >
              {label}
            </span>
          </div>
          {icon && (
            <span style={{ color: accentHex, opacity: 0.7 }}>
              {icon}
            </span>
          )}
        </div>

        {/* Value */}
        <div className="flex items-end gap-3">
          <motion.span
            className="text-3xl font-black tabular-nums"
            style={{ color: '#ffffff' }}
            key={value}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {value}
          </motion.span>

          {/* Trend */}
          {trend && (
            <div className="flex items-center gap-1 mb-1">
              <TrendIcon size={12} style={{ color: trendColor }} />
              {trendValue && (
                <span className="text-xs font-black" style={{ color: trendColor }}>
                  {trendValue}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p
            className="text-[11px] font-medium mt-1"
            style={{ color: 'var(--fb-text-tertiary)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
}

LiquidStatCard.displayName = 'LiquidStatCard';
