import React, { useState } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReceiptViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export function ReceiptViewer({ open, onOpenChange, url, title = 'Comprovante' }: ReceiptViewerProps) {
  const [zoom, setZoom] = useState(100);

  if (!open) return null;

  const isPdf = url?.toLowerCase().endsWith('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url || '');

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));

  return (
    <>
      {/* Backdrop com glassmorphism sutil */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal com glassmorphism */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        <div
          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl flex flex-col max-w-4xl w-full max-h-[90vh] pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            
            <div className="flex items-center gap-3">
              {isImage && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    disabled={zoom <= 50}
                    className="h-9 w-9 hover:bg-white/10 text-white"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-white/70 w-12 text-center">{zoom}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    disabled={zoom >= 200}
                    className="h-9 w-9 hover:bg-white/10 text-white"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                asChild
                className="h-9 w-9 hover:bg-white/10 text-white"
              >
                <a href={url} download target="_blank" rel="noopener noreferrer" title="Baixar">
                  <Download className="h-4 w-4" />
                </a>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                asChild
                className="h-9 w-9 hover:bg-white/10 text-white"
              >
                <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-9 w-9 hover:bg-white/10 text-white"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {isPdf ? (
              <iframe
                src={url}
                className="w-full h-full min-h-[500px] border-0 rounded-lg"
                title={title}
              />
            ) : isImage ? (
              <div className="flex items-center justify-center h-full">
                <img
                  src={url}
                  alt={title}
                  className="max-w-full h-auto rounded-lg shadow-xl transition-transform"
                  style={{ transform: `scale(${zoom / 100})` }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/70">
                <p className="mb-4">Não é possível visualizar este tipo de arquivo.</p>
                <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  <a href={url} download>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Arquivo
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
