import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Document, Page, pdfjs } from "react-pdf";
import { pdf } from "@react-pdf/renderer";
import { ReciboDocument } from "@/lib/reciboGenerator";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = PdfWorker;

interface ReceiptPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Record<string, unknown>;
  onConfirm: (editedNumber: string) => Promise<void>;
  isGenerating?: boolean;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  open,
  onOpenChange,
  data,
  onConfirm,
  isGenerating = false,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Gerar PDF blob quando o modal abrir
  React.useEffect(() => {
    if (open && !pdfUrl && data) {
      generatePreviewPdf();
    }
  }, [open, data]);

  const generatePreviewPdf = async () => {
    try {
      setIsGeneratingPreview(true);
      setPreviewError(null);
      const pdfBlob = await pdf(<ReciboDocument data={data} />).toBlob();
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl(blobUrl);
    } catch (error) {
      console.error("Erro ao gerar preview do PDF:", error);
      setPreviewError("Erro ao gerar preview do recibo");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    setPageNumber(1);
  };

  const onDocumentLoadError = (error: unknown) => {
    console.error("Erro ao carregar PDF preview:", error);
    setPreviewError("Erro ao carregar preview");
  };

  const changePage = (offset: number) => {
    setPageNumber((prev) => {
      const newPage = prev + offset;
      return Math.max(1, Math.min(newPage, numPages));
    });
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  const fileObject = useMemo(() => ({
    url: pdfUrl,
    withCredentials: false,
  }), [pdfUrl]);

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0 sticky top-0 bg-background z-10 border-b">
          <div className="flex justify-between items-center">
            <DialogTitle className="flex items-center gap-2">
              <span>Prévia do Recibo</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden p-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => changePage(-1)}
                disabled={pageNumber <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[80px]">
                Página {pageNumber} de {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => changePage(1)}
                disabled={pageNumber >= numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={zoomOut} disabled={scale <= 0.5}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[45px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button variant="outline" size="sm" onClick={zoomIn} disabled={scale >= 3.0}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-auto border rounded-lg bg-muted/30 flex justify-center p-4">
            {isGeneratingPreview ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p>Gerando prévia...</p>
                </div>
              </div>
            ) : previewError ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-destructive text-center">
                  <p className="font-semibold">{previewError}</p>
                </div>
              </div>
            ) : pdfUrl ? (
              <Document
                file={fileObject}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <div className="text-muted-foreground">Carregando PDF...</div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center p-8">
                    <div className="text-destructive text-center">
                      <p className="font-semibold">Erro ao carregar PDF</p>
                    </div>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isGenerating}
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isGenerating || isGeneratingPreview}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Gerar PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

