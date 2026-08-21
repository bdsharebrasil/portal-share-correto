import { Eraser, PenLine, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export type WhiteboardPoint = { x: number; y: number };

export type WhiteboardStroke = {
  id: string;
  points: WhiteboardPoint[];
  color: string;
  width: number;
};

type WhiteboardProps = {
  strokes: WhiteboardStroke[];
  canEdit: boolean;
  onStroke: (stroke: WhiteboardStroke) => void;
  onClear: () => void;
};

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: WhiteboardStroke,
  width: number,
  height: number,
) {
  if (stroke.points.length === 0) return;
  const [firstPoint] = stroke.points;
  if (!firstPoint) return;
  context.beginPath();
  context.moveTo(firstPoint.x * width, firstPoint.y * height);
  stroke.points.slice(1).forEach((point) => {
    context.lineTo(point.x * width, point.y * height);
  });
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
}

export function Whiteboard({
  strokes,
  canEdit,
  onStroke,
  onClear,
}: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeRef = useRef<WhiteboardStroke | null>(null);
  const [color, setColor] = useState("#f5c84b");
  const [width, setWidth] = useState(5);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((stroke) =>
      drawStroke(context, stroke, canvas.width, canvas.height),
    );
  }, [strokes]);

  function pointFromEvent(
    event: React.PointerEvent<HTMLCanvasElement>,
  ): WhiteboardPoint {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!canEdit) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activeStrokeRef.current = {
      id: crypto.randomUUID(),
      points: [pointFromEvent(event)],
      color,
      width,
    };
    onStroke(activeStrokeRef.current);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const activeStroke = activeStrokeRef.current;
    if (!canEdit || !activeStroke) return;
    activeStrokeRef.current = {
      ...activeStroke,
      points: [...activeStroke.points, pointFromEvent(event)],
    };
    onStroke(activeStrokeRef.current);
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activeStrokeRef.current = null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0d1628] shadow-2xl shadow-slate-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-300/10 text-amber-300">
            <PenLine className="size-4" />
          </span>
          Lousa virtual
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
            {canEdit ? "modo instrutor" : "somente visualização"}
          </span>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Cor
              <input
                aria-label="Cor da caneta"
                className="size-7 cursor-pointer rounded border border-slate-600 bg-transparent p-0"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Espessura
              <select
                aria-label="Espessura da caneta"
                className="h-8 rounded-md border border-slate-600 bg-slate-900 px-2 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-amber-300/60"
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
              >
                <option value={3}>Fina</option>
                <option value={5}>Média</option>
                <option value={9}>Grossa</option>
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-600 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={onClear}
            >
              <Eraser className="size-4" /> Limpar
            </Button>
          </div>
        )}
        {!canEdit && (
          <Trash2 className="size-4 text-slate-600" aria-hidden="true" />
        )}
      </div>
      <div className="relative aspect-[16/8] min-h-[260px] w-full bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px]">
        <canvas
          ref={canvasRef}
          width={1280}
          height={640}
          className={`absolute inset-0 size-full touch-none ${canEdit ? "cursor-crosshair" : "cursor-default"}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
        />
        {!canEdit && strokes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            O instrutor ainda não desenhou na lousa.
          </div>
        )}
      </div>
    </div>
  );
}
