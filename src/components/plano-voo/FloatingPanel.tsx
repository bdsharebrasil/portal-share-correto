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
  const [visible, setVisible] = useState(true);
  const dragRef = useRef<{ dx: number; dy: number; left: number; top: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(pos)); } catch { /* ignore */ }
  }, [id, pos]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const container = (e.currentTarget as HTMLElement).closest('[data-flight-map]')?.getBoundingClientRect();
    const left = container?.left ?? 0;
    const top = container?.top ?? 0;
    movedRef.current = false;
    dragRef.current = { dx: e.clientX - left - pos.x, dy: e.clientY - top - pos.y, left, top };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const container = (e.currentTarget as HTMLElement).closest('[data-flight-map]')?.getBoundingClientRect();
    const bounds = container ?? { left: dragRef.current.left, top: dragRef.current.top, width: window.innerWidth, height: window.innerHeight };
    const nextX = e.clientX - bounds.left - dragRef.current.dx;
    const nextY = e.clientY - bounds.top - dragRef.current.dy;
    if (Math.abs(nextX - pos.x) > 3 || Math.abs(nextY - pos.y) > 3) movedRef.current = true;
    const maxX = Math.max(0, bounds.width - (collapsed ? 44 : width) - 8);
    const maxY = Math.max(0, bounds.height - 52);
    setPos({ x: Math.min(maxX, Math.max(0, nextX)), y: Math.min(maxY, Math.max(0, nextY)) });
  }, [collapsed, pos.x, pos.y, width]);

  const endDrag = useCallback((e?: React.PointerEvent) => {
    e?.stopPropagation();
    dragRef.current = null;
  }, []);

  if (!visible) return null;

  return (
    <div
      className="absolute z-[1200] max-w-[calc(100%-1rem)] select-none touch-none"
      style={{ left: pos.x, top: pos.y, width: collapsed ? undefined : width }}
    >
      {collapsed ? (
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={() => {
            if (movedRef.current) {
              movedRef.current = false;
              return;
            }
            setCollapsed(false);
          }}
          onDoubleClick={() => setCollapsed(false)}
          title={title}
          className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none',
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
              className="h-9 w-9 rounded hover:bg-muted flex items-center justify-center text-muted-foreground touch-manipulation"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setVisible(false);
                onClose?.();
              }}
              title="Remover do mapa"
              className="h-9 w-9 rounded hover:bg-muted flex items-center justify-center text-muted-foreground touch-manipulation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-2 sm:max-h-[45vh]">{children}</div>
        </div>
      )}
    </div>
  );
};
