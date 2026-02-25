import React, { useRef, useState } from 'react';
import { TableHead } from '@/components/ui/table';

interface ResizableTableHeaderProps {
  columnId: string;
  width: number;
  onResize: (columnId: string, newWidth: number) => void;
  children: React.ReactNode;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}

export function ResizableTableHeader({
  columnId,
  width,
  onResize,
  children,
  minWidth = 60,
  maxWidth = 500,
  className = '',
}: ResizableTableHeaderProps) {
  const [isResizing, setIsResizing] = useState(false);
  const headerRef = useRef<HTMLTableCellElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + diff));
      onResize(columnId, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <TableHead
      ref={headerRef}
      className={`relative select-none ${className}`}
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
      }}
    >
      <div className="flex items-center justify-between h-full pr-0">
        <div className="flex-1 truncate">
          {children}
        </div>
        <div
          onMouseDown={handleMouseDown}
          className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors ${
            isResizing ? 'bg-primary' : ''
          }`}
          title="Arraste para redimensionar"
        />
      </div>
    </TableHead>
  );
}
