import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Fuel, Loader2 } from "lucide-react";

const db = supabase as any;

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  abastecimentoId: string | null;
}

function Campo({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold">
        {value === null || value === undefined || value === "" ? "—" : value}
      </p>
    </div>
  );
}

/** Visualização somente-leitura de um abastecimento já registrado no checklist */
export function AbastecimentoViewDialog({ open, onOpenChange, abastecimentoId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["abastecimento-view", abastecimentoId],
    enabled: open && !!abastecimentoId,
    queryFn: async () => {
      const { data, error } = await db
        .from("abastecimentos")
        .select("*, clientes:id_clientes(razao_social)")
        .eq("id", abastecimentoId)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-primary" />
            Abastecimento registrado
          </DialogTitle>
          <DialogDescription>
            Visualização do abastecimento vinculado a este checklist de pré-voo.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Abastecimento não encontrado.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Cliente" value={data.clientes?.razao_social} />
            <Campo label="Sócio" value={data.socio_nome} />
            <Campo
              label="Data"
              value={data.data ? new Date(`${data.data}T00:00:00`).toLocaleDateString("pt-BR") : null}
            />
            <Campo label="Trecho" value={data.trecho} />
            <Campo label="Local" value={data.local} />
            <Campo label="Combustível" value={data.tipo_combustivel} />
            <Campo label="Abastecedor" value={data.abastecedor} />
            <Campo label="Comanda" value={data.comanda} />
            <Campo
              label="Litros"
              value={`${Number(data.litros || 0).toLocaleString("pt-BR")} L`}
            />
            <Campo label="Valor unitário" value={brl(data.valor_unitario)} />
            <Campo label="Valor total" value={brl(data.valor_total)} />
            <Campo label="Tipo de faturamento" value={data.tipo_faturamento} />
            <Campo label="Prazo" value={data.prazo} />
            <Campo label="Pago por" value={data.pago_por} />
            <Campo label="Status" value={(data.status || "pendente").toUpperCase()} />
            <div className="sm:col-span-2">
              <Campo label="Observação" value={data.observacao} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AbastecimentoViewDialog;
