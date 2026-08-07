import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Minus, GripHorizontal, X } from 'lucide-react';

export interface FloatingPanelProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  /** posição inicial relativa ao container (px) */
  defaultPosition?: { x: number; y: number };
  defaultCollapsed?: boolean;
  width?: number;
  accentClassName?: string;
  onClose?: () => void;
  children: React.ReactNode;
}

const STORAGE_PREFIX = 'planovoo-panel:';

/**
 * Painel flutuante arrastável que pode ser recolhido em um ícone.
 * A posição é persistida em localStorage por `id`.
 */
export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  id,
  title,
  icon,
  defaultPosition = { x: 16, y: 16 },
  defaultCollapsed = true,
  width = 260,
  accentClassName,
  onClose,
  children,
}) => {
  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + id);
      if (raw) return JSON.parse(raw) as { x: number; y: number };
    } catch { /* ignore */ }
    return defaultPosition;
  });
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(pos)); } catch { /* ignore */ }
  }, [id, pos]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: Math.max(0, e.clientX - dragRef.current.dx),
      y: Math.max(0, e.clientY - dragRef.current.dy),
    });
  }, []);

  const endDrag = useCallback(() => { dragRef.current = null; }, []);

  return (
    <div
      className="absolute z-[1200] select-none"
      style={{ left: pos.x, top: pos.y, width: collapsed ? undefined : width }}
    >
      {collapsed ? (
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={() => { if (!dragRef.current) setCollapsed(false); }}
          onDoubleClick={() => setCollapsed(false)}
          title={title}
          className={cn(
            'h-11 w-11 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing',
            'bg-card/90 backdrop-blur-md border border-border shadow-lg text-foreground',
            'hover:bg-card transition-colors',
            accentClassName,
          )}
        >
          {icon}
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-xl overflow-hidden">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-background/60 cursor-grab active:cursor-grabbing"
          >
            <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground truncate flex-1">
              {title}
            </span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Recolher"
              className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Fechar"
                className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="p-2 max-h-[45vh] overflow-y-auto">{children}</div>
        </div>
      )}
    </div>
  );
};
