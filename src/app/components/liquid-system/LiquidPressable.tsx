/**
 * LIQUID PRESSABLE - Micro-Interaction Wrapper
 * 
 * Wrapper component with spring-based press/hover micro-interactions:
 * - Scale down on press (spring physics)
 * - Subtle lift on hover
 * - Glow intensification on hover
 * - Supports custom press/hover callbacks
 * 
 * Based on Apple WWDC25 Liquid Glass interaction patterns.
 */

import { ReactNode, useState, useCallback } from 'react';
import { motion } from 'motion/react';

/* ──────────────────────────────────────────────────────────────────
   TYPES
────────────────────────────────────────────────────────────────── */

export interface LiquidPressableProps {
  children: ReactNode;
  /** Callback on click */
  onClick?: () => void;
  /** Scale amount on press (default 0.97) */
  pressScale?: number;
  /** Scale amount on hover (default 1.02) */
  hoverScale?: number;
  /** Enable hover lift shadow */
  hoverLift?: boolean;
  /** Glow color on hover (e.g. '#10b981') */
  hoverGlow?: string;
  /** Spring stiffness (default 400) */
  stiffness?: number;
  /** Spring damping (default 25) */
  damping?: number;
  /** Additional className */
  className?: string;
  /** Additional styles */
  style?: React.CSSProperties;
  /** Disable interactions */
  disabled?: boolean;
  /** Animate entrance */
  animated?: boolean;
  /** Animation delay in ms */
  animationDelay?: number;
  /** Callback on hover start */
  onHoverStart?: () => void;
  /** Callback on hover end */
  onHoverEnd?: () => void;
}

/* ──────────────────────────────────────────────────────────────────
   COMPONENT
────────────────────────────────────────────────────────────────── */

export function LiquidPressable({
  children,
  onClick,
  pressScale = 0.97,
  hoverScale = 1.02,
  hoverLift = true,
  hoverGlow,
  stiffness = 400,
  damping = 25,
  className = '',
  style,
  disabled = false,
  animated = false,
  animationDelay = 0,
  onHoverStart,
  onHoverEnd,
}: LiquidPressableProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleHoverStart = useCallback(() => {
    setIsHovered(true);
    onHoverStart?.();
  }, [onHoverStart]);

  const handleHoverEnd = useCallback(() => {
    setIsHovered(false);
    onHoverEnd?.();
  }, [onHoverEnd]);

  const springTransition = {
    type: 'spring' as const,
    stiffness,
    damping,
  };

  const hoverShadow = hoverGlow
    ? `0 8px 32px ${hoverGlow}35, 0 0 24px ${hoverGlow}20`
    : hoverLift
    ? '0 8px 32px rgba(0, 0, 0, 0.25)'
    : undefined;

  return (
    <motion.div
      className={className}
      style={{
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
      onClick={disabled ? undefined : onClick}
      onHoverStart={disabled ? undefined : handleHoverStart}
      onHoverEnd={handleHoverEnd}
      whileHover={disabled ? undefined : { 
        scale: hoverScale,
        boxShadow: hoverShadow,
      }}
      whileTap={disabled ? undefined : { 
        scale: pressScale,
      }}
      transition={springTransition}
      {...(animated ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          ...springTransition,
          delay: animationDelay / 1000,
        },
      } : {})}
    >
      {/* Hover glow underlay */}
      {hoverGlow && (
        <motion.div
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{
            background: `radial-gradient(ellipse at center, ${hoverGlow}15 0%, transparent 70%)`,
            filter: 'blur(20px)',
          }}
        />
      )}
      {children}
    </motion.div>
  );
}

LiquidPressable.displayName = 'LiquidPressable';
