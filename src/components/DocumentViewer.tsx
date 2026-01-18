import { useState, useMemo } from "react";
import { Document, Page } from "react-pdf";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import { usePDFWorker } from "@/hooks/use-pdf-worker";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface DocumentViewerProps {
  url: string;
  fileName: string;
  fileType: string;
  onDownload?: () => void;
}

export function DocumentViewer({ url, fileName, fileType, onDownload }: DocumentViewerProps) {
  // Configurar PDF worker (apenas uma vez, mesmo que múltiplos DocumentViewers montem)
  usePDFWorker();

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const onDocumentLoadError = (error: any) => {
    // Extrair mensagem de erro de forma mais robusta
    let errorDetails = 'Erro desconhecido';

    if (error instanceof Error) {
      errorDetails = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorDetails = error.message || error.toString() || JSON.stringify(error);
    } else if (typeof error === 'string') {
      errorDetails = error;
    }

    console.error('Erro ao carregar PDF:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      errorType: error?.name,
      fullError: errorDetails,
    });

    // Mensagem mais específica baseado no tipo de erro
    let errorMessage = 'Não foi possível carregar o PDF.';

    const errorLower = errorDetails.toLowerCase();

    if (errorLower.includes('worker') || errorLower.includes('dynamically imported')) {
      errorMessage = 'Erro ao carregar o worker do PDF. Verifique sua conexão de internet e recarregue a página.';
    } else if (errorLower.includes('failed to fetch')) {
      errorMessage = 'Falha ao carregar o PDF. Verifique sua conexão de internet.';
    } else if (errorLower.includes('404') || errorLower.includes('not found')) {
      errorMessage = 'PDF não encontrado. O arquivo pode ter sido excluído.';
    } else if (errorLower.includes('cors')) {
      errorMessage = 'Erro de acesso ao PDF. Tente novamente mais tarde.';
    } else if (errorLower.includes('version') || errorLower.includes('mismatch')) {
      errorMessage = 'Erro de compatibilidade do PDF. Recarregue a página.';
    } else if (errorDetails.length > 0) {
      errorMessage = `Erro ao carregar PDF: ${errorDetails.substring(0, 80)}`;
    }

    setError(errorMessage);
  };

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => prevPageNumber + offset);
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  // Memoizar objeto file para evitar re-renderizações desnecessárias
  const fileObject = useMemo(() => ({
    url: url,
    withCredentials: false,
  }), [url]);

  // Renderizar PDF
  if (fileType === "application/pdf") {
    // Se houver erro ao configurar worker, mostrar mensagem
    if (error) {
      return (
        <div className="border rounded-lg overflow-auto bg-muted/30 flex items-center justify-center p-8" style={{ minHeight: "70vh" }}>
          <div className="text-destructive text-center max-w-md">
            <p className="font-semibold text-lg mb-2">Erro ao Carregar PDF</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <p className="text-xs text-muted-foreground">
              Você pode tentar fazer o download do arquivo usando o botão abaixo
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={previousPage}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {pageNumber} de {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={zoomOut} disabled={scale <= 0.5}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{Math.round(scale * 100)}%</span>
            <Button variant="outline" size="sm" onClick={zoomIn} disabled={scale >= 3.0}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            {onDownload && (
              <Button variant="outline" size="sm" onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            )}
          </div>
        </div>

        <div className="border rounded-lg overflow-auto bg-muted/30 flex justify-center p-4" style={{ maxHeight: "70vh" }}>
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
              <div className="flex items-center justify-center p-8 flex-col gap-4">
                <div className="text-destructive text-center">
                  <p className="font-semibold">Erro ao carregar PDF</p>
                  <p className="text-sm mt-2">Verifique se a URL é válida ou tente novamente mais tarde</p>
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
        </div>
      </div>
    );
  }

  // Renderizar Word/Excel usando Google Docs Viewer
  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileType === "application/msword" ||
    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    fileType === "application/vnd.ms-excel" ||
    fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    fileType === "application/vnd.ms-powerpoint"
  ) {
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          )}
        </div>
        <div className="border rounded-lg overflow-hidden bg-muted/30">
          <iframe
            src={viewerUrl}
            className="w-full"
            style={{ height: "70vh" }}
            title={fileName}
          />
        </div>
      </div>
    );
  }

  // Renderizar imagens
  if (fileType?.startsWith("image/")) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          )}
        </div>
        <div className="border rounded-lg overflow-auto bg-muted/30 flex justify-center p-4" style={{ maxHeight: "70vh" }}>
          <img src={url} alt={fileName} className="max-w-full h-auto" />
        </div>
      </div>
    );
  }

  // Fallback para outros tipos de arquivo
  return (
    <div className="py-12 text-center space-y-4">
      <p className="text-muted-foreground">
        Visualização não disponível para este tipo de arquivo
      </p>
      {onDownload && (
        <Button onClick={onDownload}>
          <Download className="h-4 w-4 mr-2" />
          Baixar arquivo
        </Button>
      )}
    </div>
  );
}
