import { X, Download } from "lucide-react";

interface Props {
  url: string;
  title?: string;
  onClose: () => void;
}

export default function AttachmentViewerModal({ url, title, onClose }: Props) {
  const isPdf = /\.pdf(\?|$)/i.test(url);
  const isImg = /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(url);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(2,6,23,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[85vh] rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/60">
          <span className="text-sm font-bold text-foreground truncate">{title || "Anexo"}</span>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download
              className="p-1.5 rounded hover:bg-card-secondary text-muted-foreground"
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-300"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-card overflow-auto flex items-center justify-center">
          {isImg ? (
            <img src={url} alt={title || "anexo"} className="max-w-full max-h-full object-contain" />
          ) : isPdf ? (
            <iframe src={url} title={title || "PDF"} className="w-full h-full border-0" />
          ) : (
            <iframe src={url} title={title || "Anexo"} className="w-full h-full border-0 bg-white" />
          )}
        </div>
      </div>
    </div>
  );
}
