import React, { useCallback, useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { ReciboDocument } from "@/lib/reciboGenerator";
import { Download, Mail, X, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  /** dados normalizados para o documento PDF */
  data: Record<string, any> | null;
  saving?: boolean;
  /** já salvo? recebe a url pública do PDF gerado */
  savedUrl?: string | null;
  onClose: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
  onSendEmail: () => void;
}

export const ReciboSaidaPreviewModal: React.FC<Props> = ({
  open,
  data,
  saving = false,
  savedUrl = null,
  onClose,
  onConfirm,
  onSendEmail,
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!data) return;
    setGenerating(true);
    setError(null);
    try {
      const generated = await pdf(<ReciboDocument data={data} />).toBlob();
      setBlob(generated);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(generated);
      });
    } catch (e: any) {
      setError(e?.message || "Erro ao gerar a prévia do recibo.");
    } finally {
      setGenerating(false);
    }
  }, [data]);

  useEffect(() => {
    if (open && data) generate();
    if (!open) {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setBlob(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  if (!open) return null;

  const download = () => {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `recibo-${data?.receipt_number || "saida"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Prévia do Recibo de Saída</h3>
            <p className="text-[11px] text-slate-400">
              Confira o recibo, salve o PDF e envie ao cliente por e-mail.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-900/60 p-4">
          {generating ? (
            <div className="flex h-full items-center justify-center text-slate-400 text-sm">
              Gerando prévia...
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-red-400">{error}</div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} title="Prévia do recibo" className="h-full min-h-[65vh] w-full rounded-lg bg-white" />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">
          {savedUrl && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Recibo salvo e PDF anexado ao registro.
            </span>
          )}
          <button
            onClick={download}
            disabled={!pdfUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Baixar PDF
          </button>
          {!savedUrl ? (
            <button
              onClick={() => blob && onConfirm(blob)}
              disabled={!blob || saving || generating}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              style={{ background: "#06b6d4" }}
            >
              {saving ? "Salvando..." : "Salvar recibo"}
            </button>
          ) : (
            <button
              onClick={onSendEmail}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-slate-950"
              style={{ background: "#06b6d4" }}
            >
              <Mail className="h-4 w-4" /> Enviar por e-mail
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
