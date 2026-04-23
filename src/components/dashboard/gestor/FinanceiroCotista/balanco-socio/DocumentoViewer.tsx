import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';

interface DocumentoViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export function DocumentoViewer({ open, onOpenChange, url, title = 'Documento' }: DocumentoViewerProps) {
  const [zoom, setZoom] = useState(100);
  
  const isPdf = url?.toLowerCase().endsWith('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url || '');

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            {isImage && (
              <>
                <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= 50}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= 200}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" asChild>
              <a href={url} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-4 bg-muted/30 rounded-lg">
          {isPdf ? (
            <iframe
              src={url}
              className="w-full h-full min-h-[600px] border-0 rounded"
              title={title}
            />
          ) : isImage ? (
            <div className="flex items-center justify-center h-full">
              <img
                src={url}
                alt={title}
                className="max-w-full h-auto rounded-lg shadow-lg transition-transform"
                style={{ transform: `scale(${zoom / 100})` }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
              <p>Não é possível visualizar este tipo de arquivo.</p>
              <Button variant="outline" asChild className="mt-4">
                <a href={url} download>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Arquivo
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
