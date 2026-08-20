import React, { useCallback, useRef, useState } from 'react';
import { X, GripHorizontal, ExternalLink, Contrast, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export interface ChartProjectionItem {
  title: string;
  url?: string;
  format?: string;
}

interface Props {
  chart: ChartProjectionItem;
  onClose: () => void;
}

type BlendMode = 'normal' | 'multiply' | 'screen';

/**
 * Visualizador de carta sobreposto ao mapa do plano de voo.
 * Permite arrastar, redimensionar e remover o fundo da carta (blend multiply/screen)
 * para "projetar" a carta sobre o mapa.
 */
export const ChartProjectionOverlay: React.FC<Props> = ({ chart, onClose }) => {
  const [pos, setPos] = useState({ x: 120, y: 80 });
  const [size, setSize] = useState({ w: 620, h: 460 });
  const [opacity, setOpacity] = useState(90);
  const [blend, setBlend] = useState<BlendMode>('multiply');
  const [invert, setInvert] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onDragDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }, [pos]);

  const onResizeDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    resizeRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  }, [size]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      setPos({ x: Math.max(0, e.clientX - dragRef.current.dx), y: Math.max(0, e.clientY - dragRef.current.dy) });
    } else if (resizeRef.current) {
      const r = resizeRef.current;
      setSize({ w: Math.max(280, r.w + (e.clientX - r.x)), h: Math.max(220, r.h + (e.clientY - r.y)) });
    }
  }, []);

  const endDrag = useCallback(() => { dragRef.current = null; resizeRef.current = null; }, []);

  const isPdf = chart.format?.toLowerCase() === 'pdf' || (chart.url || '').toLowerCase().includes('.pdf');

  return (
    <div
      className="absolute z-[1400]"
      style={{ left: pos.x, top: pos.y, width: size.w }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Barra de controle (sempre opaca) */}
      <div
        onPointerDown={onDragDown}
        className="flex items-center gap-2 px-2 py-1.5 rounded-t-lg border border-border bg-card/95 backdrop-blur-md cursor-grab active:cursor-grabbing"
      >
        <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-bold text-foreground truncate flex-1">{chart.title}</span>

        <div className="flex items-center gap-1 w-24" title="Opacidade">
          <Slider value={[opacity]} min={10} max={100} step={5} onValueChange={(v) => setOpacity(v[0])} />
        </div>

        <Button
          size="icon"
          variant={blend === 'multiply' ? 'default' : 'ghost'}
          className="h-6 w-6"
          title="Remover fundo (projeção)"
          onClick={() => setBlend((b) => (b === 'multiply' ? 'normal' : 'multiply'))}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant={invert ? 'default' : 'ghost'}
          className="h-6 w-6"
          title="Inverter cores (modo noturno)"
          onClick={() => setInvert((v) => !v)}
        >
          <Contrast className="w-3.5 h-3.5" />
        </Button>
        {chart.url && (
          <a href={chart.url} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba">
            <Button size="icon" variant="ghost" className="h-6 w-6"><ExternalLink className="w-3.5 h-3.5" /></Button>
          </a>
        )}
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose} title="Fechar">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Conteúdo da carta — sem fundo, projetado sobre o mapa */}
      <div
        className={cn('relative border-x border-b border-border rounded-b-lg overflow-hidden')}
        style={{ height: size.h, background: blend === 'normal' ? 'hsl(var(--card))' : 'transparent' }}
      >
        {chart.url ? (
          isPdf ? (
            <iframe
              src={`${chart.url}#toolbar=0&navpanes=0&view=FitH`}
              title={chart.title}
              className="w-full h-full"
              style={{ opacity: opacity / 100, mixBlendMode: blend, filter: invert ? 'invert(1) hue-rotate(180deg)' : undefined }}
            />
          ) : (
            <img
              src={chart.url}
              alt={chart.title}
              className="w-full h-full object-contain"
              style={{ opacity: opacity / 100, mixBlendMode: blend, filter: invert ? 'invert(1) hue-rotate(180deg)' : undefined }}
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            Carta sem arquivo disponível
          </div>
        )}

        {/* Handle de redimensionamento */}
        <div
          onPointerDown={onResizeDown}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-primary/60 rounded-tl"
        />
      </div>
    </div>
  );
};
