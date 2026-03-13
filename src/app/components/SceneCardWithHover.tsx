import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Shirt, 
  Package, 
  Users, 
  FileText, 
  Camera,
  Palette,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { 
  LiquidOverlayCard, 
  LiquidOverlayListItem, 
  LiquidOverlayScriptBlock,
  LiquidBadge,
} from './liquid-system';
import { glassCard, lensingOverlay, nestedCard, springConfigs } from '../utils/liquidGlassStyles';
import type { LiquidOverlaySection } from './liquid-system';

/**
 * SCENE CARD WITH HOVER - Liquid Glass Phase 4
 * 
 * Card de cena com:
 * - Spring press/hover micro-interactions
 * - Thumbnail visual à esquerda
 * - Info básica sempre visível
 * - Expandable detail section (items list)
 * - Rich hover overlay with script, wardrobe, continuity, characters
 * - All styles via liquid-system utilities
 */

interface SceneItem {
  title: string;
  type: 'Guarda-Roupa' | 'Adereço' | 'Prop' | 'Arte';
  status: 'confirmed' | 'pending' | 'ready';
  department?: string;
  notes?: string;
}

interface SceneCardProps {
  id: string;
  number: string;
  title: string;
  description: string;
  location: string;
  timeOfDay: 'INT' | 'EXT';
  period: 'DIA' | 'NOITE' | 'ANOITECER' | 'AMANHECER';
  thumbnail?: string;
  color: string;
  items: SceneItem[];
  script?: string[];
  continuityNotes?: string[];
  characters?: string[];
  wardrobe?: string[];
  isNext?: boolean;
}

/* Item type → color mapping */
const ITEM_COLORS: Record<string, string> = {
  'Guarda-Roupa': '#f97316',
  'Adereço': '#a855f7',
  'Prop': '#a855f7',
  'Arte': '#f59e0b',
};

const ITEM_ICONS: Record<string, typeof Shirt> = {
  'Guarda-Roupa': Shirt,
  'Adereço': Package,
  'Prop': Package,
  'Arte': Palette,
};

export function SceneCardWithHover({
  id,
  number,
  title,
  description,
  location,
  timeOfDay,
  period,
  thumbnail,
  color,
  items,
  script = [],
  continuityNotes = [],
  characters = [],
  wardrobe = [],
  isNext = false,
}: SceneCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(isNext);

  // Cores semânticas cinematográficas — INT=azul, EXT=verde
  const timeColor = timeOfDay === 'INT' ? '#3b82f6' : '#10b981';

  const cardStyles = glassCard({ intensity: 'standard', variant: 'default', radius: 'xl' });
  const lensingStyles = lensingOverlay({ radius: 'xl' });
  const innerCardStyles = nestedCard({ parentRadius: 'xl', intensity: 'subtle' });

  // Build overlay sections for the hover detail panel
  const overlaySections: LiquidOverlaySection[] = [];

  if (characters.length > 0) {
    overlaySections.push({
      icon: <Users size={12} />,
      title: 'Personagens',
      color,
      content: (
        <div className="space-y-1">
          {characters.map((char, i) => (
            <LiquidOverlayListItem key={i}>{char}</LiquidOverlayListItem>
          ))}
        </div>
      ),
    });
  }

  if (wardrobe.length > 0) {
    overlaySections.push({
      icon: <Shirt size={12} />,
      title: 'Guarda-Roupa',
      color: '#f97316',
      content: (
        <div className="space-y-1">
          {wardrobe.map((item, i) => (
            <LiquidOverlayListItem key={i} color="#f97316">{item}</LiquidOverlayListItem>
          ))}
        </div>
      ),
    });
  }

  if (script.length > 0) {
    overlaySections.push({
      icon: <FileText size={12} />,
      title: 'Guião',
      color: '#3b82f6',
      content: <LiquidOverlayScriptBlock lines={script} color="#3b82f6" />,
    });
  }

  if (continuityNotes.length > 0) {
    overlaySections.push({
      icon: <AlertCircle size={12} />,
      title: 'Continuidade',
      color: '#f59e0b',
      content: (
        <div className="space-y-1">
          {continuityNotes.map((note, i) => (
            <LiquidOverlayListItem key={i} color="#f59e0b">{note}</LiquidOverlayListItem>
          ))}
        </div>
      ),
    });
  }

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springConfigs.gentle}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.008 }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Main card */}
      <motion.div
        style={cardStyles}
        animate={{
          boxShadow: isHovered
            ? `0 8px 32px rgba(0,0,0,0.2), 0 0 24px ${color}20, inset 0 0.5px 0.5px rgba(255,255,255,0.3)`
            : `0 2px 20px rgba(0,0,0,0.12), inset 0 0.5px 0.5px rgba(255,255,255,0.25)`,
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Lensing effect */}
        <div style={lensingStyles} />

        {/* Hover border glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ borderRadius: 'inherit' }}
          animate={{
            boxShadow: isHovered
              ? `inset 0 0 0 0.5px ${color}50`
              : 'inset 0 0 0 0.5px transparent',
          }}
          transition={{ duration: 0.25 }}
        />

        {/* Main content container */}
        <div className="relative z-10">
          {/* Header - Always visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-5 flex items-start gap-4 text-left group"
          >
            {/* Thumbnail */}
            <motion.div
              className="relative flex-shrink-0 overflow-hidden"
              style={{
                width: '120px',
                height: '80px',
                borderRadius: '20px', // Nested corners: 28 - 8
                background: thumbnail
                  ? `url(${thumbnail}) center/cover`
                  : `linear-gradient(135deg, ${color}30, ${color}15)`,
                border: `0.5px solid ${color}40`,
                boxShadow: `0 0 16px ${color}20`,
              }}
              whileHover={{ scale: 1.05 }}
              transition={springConfigs.snappy}
            >
              {/* No thumbnail placeholder */}
              {!thumbnail && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera size={24} style={{ color, opacity: 0.5 }} />
                </div>
              )}

              {/* Scene number badge */}
              <div
                className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black"
                style={{
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  border: '0.5px solid rgba(255,255,255,0.2)',
                }}
              >
                {number}
              </div>

              {/* Next badge */}
              {isNext && (
                <div
                  className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black"
                  style={{
                    background: 'rgba(16,185,129,0.9)',
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(16,185,129,0.6)',
                  }}
                >
                  PRÓX
                </div>
              )}
            </motion.div>

            {/* Info column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {/* Title with dot indicator */}
                  <h3
                    className="text-base font-black leading-tight mb-1 flex items-center gap-2"
                    style={{ color: '#ffffff' }}
                  >
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        background: color,
                        boxShadow: `0 0 8px ${color}`,
                      }}
                      animate={{
                        boxShadow: isHovered
                          ? `0 0 12px ${color}, 0 0 24px ${color}60`
                          : `0 0 8px ${color}`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                    {id} - {title}
                  </h3>

                  {/* Description */}
                  <p
                    className="text-xs font-medium leading-snug mb-2 line-clamp-2"
                    style={{ color: 'rgba(255,255,255,0.55)' }}
                  >
                    {description}
                  </p>

                  {/* Meta badges — using LiquidBadge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <LiquidBadge
                      variant={timeOfDay === 'INT' ? 'blue' : 'emerald'}
                      size="sm"
                    >
                      {timeOfDay}
                    </LiquidBadge>

                    <LiquidBadge variant="default" size="sm">
                      {period}
                    </LiquidBadge>

                    <div
                      className="flex items-center gap-1 text-[11px] font-black"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      <MapPin size={10} />
                      <span className="truncate max-w-[150px]">{location}</span>
                    </div>
                  </div>
                </div>

                {/* Expand toggle button with spring rotation */}
                <motion.div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `${color}20`,
                    border: `0.5px solid ${color}40`,
                  }}
                  whileHover={{ scale: 1.15, background: `${color}35` }}
                  whileTap={{ scale: 0.9 }}
                  transition={springConfigs.snappy}
                >
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={springConfigs.snappy}
                  >
                    <ChevronDown size={14} style={{ color }} />
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </button>

          {/* Expanded content - Items list */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4">
                  <div
                    className="rounded-[20px] overflow-hidden"
                    style={innerCardStyles}
                  >
                    {items.map((item, idx) => {
                      const itemColor = ITEM_COLORS[item.type] || '#10b981';
                      const ItemIcon = ITEM_ICONS[item.type] || Camera;

                      return (
                        <div key={idx}>
                          <motion.div
                            className="flex items-center gap-3 px-4 py-3"
                            whileHover={{
                              background: 'rgba(255,255,255,0.03)',
                            }}
                            transition={{ duration: 0.15 }}
                          >
                            {/* Icon */}
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                background: `${itemColor}15`,
                                border: `0.5px solid ${itemColor}35`,
                              }}
                            >
                              <ItemIcon size={14} style={{ color: itemColor }} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-sm font-black leading-tight"
                                style={{ color: '#ffffff' }}
                              >
                                {item.title}
                              </div>
                              <div
                                className="text-[10px] font-black mt-0.5"
                                style={{ color: itemColor }}
                              >
                                {item.type}
                              </div>
                            </div>

                            {/* Status dot with glow */}
                            <motion.div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                background:
                                  item.status === 'confirmed' || item.status === 'ready'
                                    ? '#10b981'
                                    : '#f59e0b',
                              }}
                              animate={{
                                boxShadow:
                                  item.status === 'confirmed' || item.status === 'ready'
                                    ? '0 0 8px #10b981, 0 0 16px rgba(16,185,129,0.4)'
                                    : '0 0 8px #f59e0b, 0 0 16px rgba(245,158,11,0.4)',
                              }}
                            />
                          </motion.div>

                          {/* Divider */}
                          {idx < items.length - 1 && (
                            <div
                              className="mx-4"
                              style={{
                                height: '0.5px',
                                background: 'rgba(255,255,255,0.07)',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* HOVER DETAIL PANEL — Rich Overlay via LiquidOverlayCard */}
      <LiquidOverlayCard
        isVisible={isHovered && overlaySections.length > 0}
        accentColor={color}
        title="Detalhes da Cena"
        subtitle={`${location}`}
        sections={overlaySections}
        position="bottom"
        maxWidth={520}
      />
    </motion.div>
  );
}