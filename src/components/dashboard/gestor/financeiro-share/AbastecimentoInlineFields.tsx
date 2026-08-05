import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { ChevronDown, Fuel } from "lucide-react";

export interface AbastecimentoFields {
  data: string;
  abastecedor_id: string;
  combustivel_tipo: string;
  comanda: string;
  origem_aerodromo: string;
  destino_aerodromo: string;
  local: string;
  litros: string;
  abastecimento_galoes: string;
  valor_unitario: string;
  valor_total: string;
  nf: string;
}

export const emptyAbastecimento = (data = ""): AbastecimentoFields => ({
  data,
  abastecedor_id: "",
  combustivel_tipo: "",
  comanda: "",
  origem_aerodromo: "",
  destino_aerodromo: "",
  local: "",
  litros: "",
  abastecimento_galoes: "",
  valor_unitario: "",
  valor_total: "",
  nf: "",
});

const TIPOS_COMBUSTIVEL = [
  { id: "avgas", label: "AVGAS" },
  { id: "jet", label: "JET A-1" },
];

interface Props {
  value: AbastecimentoFields;
  onChange: (patch: Partial<AbastecimentoFields>) => void;
  /** Chamado quando o valor total calculado muda, para refletir no valor do lançamento. */
  onTotalChange?: (total: number, fornecedorNome: string | null) => void;
}

/**
 * Bloco expansível com as perguntas do abastecimento (mesmas do controle de
 * abastecimento), sem status de pagamento, observações e anexos — esses campos
 * já existem no formulário do lançamento.
 */
export default function AbastecimentoInlineFields({ value, onChange, onTotalChange }: Props) {
  const [open, setOpen] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("fornecedores_combustivel")
      .select("id,nome_fornecedor,nome_cidade,codigo_icao,preco_avgas,preco_jet")
      .order("nome_fornecedor")
      .then(({ data }) => setSuppliers(data ?? []));
  }, []);

  const supplierItems = useMemo(
    () =>
      suppliers.map((s: any) => ({
        id: s.id,
        label: `${s.nome_fornecedor}${s.nome_cidade ? ` — ${s.nome_cidade}` : ""}`,
      })),
    [suppliers],
  );

  const fornecedorSel = useMemo(
    () => suppliers.find((s: any) => s.id === value.abastecedor_id) || null,
    [suppliers, value.abastecedor_id],
  );

  // Preço unitário sugerido pelo fornecedor
  useEffect(() => {
    if (!fornecedorSel || !value.combustivel_tipo || value.valor_unitario) return;
    const preco = value.combustivel_tipo === "avgas" ? fornecedorSel.preco_avgas : fornecedorSel.preco_jet;
    if (preco !== null && preco !== undefined) onChange({ valor_unitario: String(preco) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornecedorSel, value.combustivel_tipo]);

  // Total = litros * valor unitário
  const total = useMemo(() => {
    const l = parseFloat(value.litros);
    const u = parseFloat(value.valor_unitario);
    return Number.isFinite(l) && Number.isFinite(u) ? Number((l * u).toFixed(2)) : 0;
  }, [value.litros, value.valor_unitario]);

  useEffect(() => {
    onChange({ valor_total: total ? String(total) : "" });
    onTotalChange?.(total, fornecedorSel?.nome_fornecedor ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, fornecedorSel?.nome_fornecedor]);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Fuel className="h-4 w-4 text-primary" /> DADOS DO ABASTECIMENTO
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-border/60 p-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>DATA DO ABASTECIMENTO *</Label>
            <Input type="date" value={value.data} onChange={(e) => onChange({ data: e.target.value })} />
          </div>

          <div className="lg:col-span-2">
            <Label>ABASTECEDOR / FORNECEDOR *</Label>
            <SearchableCombobox
              items={supplierItems}
              value={value.abastecedor_id}
              onChange={(id) => onChange({ abastecedor_id: id })}
              placeholder="Selecione o abastecedor"
              searchPlaceholder="Buscar fornecedor de combustível..."
            />
          </div>

          <div>
            <Label>TIPO DE COMBUSTÍVEL *</Label>
            <SearchableCombobox
              items={TIPOS_COMBUSTIVEL}
              value={value.combustivel_tipo}
              onChange={(id) => onChange({ combustivel_tipo: id })}
              placeholder="Selecione"
            />
          </div>

          <div>
            <Label>COMANDA</Label>
            <Input value={value.comanda} onChange={(e) => onChange({ comanda: e.target.value })} />
          </div>

          <div>
            <Label>NOTA FISCAL</Label>
            <Input value={value.nf} onChange={(e) => onChange({ nf: e.target.value })} />
          </div>

          <div>
            <Label>ORIGEM</Label>
            <Input
              placeholder="SBSP"
              value={value.origem_aerodromo}
              onChange={(e) => onChange({ origem_aerodromo: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <Label>DESTINO</Label>
            <Input
              placeholder="SBRJ"
              value={value.destino_aerodromo}
              onChange={(e) => onChange({ destino_aerodromo: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <Label>LOCAL DO ABASTECIMENTO</Label>
            <Input value={value.local} onChange={(e) => onChange({ local: e.target.value })} />
          </div>

          <div>
            <Label>LITROS *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={value.litros}
              onChange={(e) => onChange({ litros: e.target.value })}
            />
          </div>
          <div>
            <Label>GALÕES</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={value.abastecimento_galoes}
              onChange={(e) => onChange({ abastecimento_galoes: e.target.value })}
            />
          </div>
          <div>
            <Label>VALOR UNITÁRIO (R$) *</Label>
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={value.valor_unitario}
              onChange={(e) => onChange({ valor_unitario: e.target.value })}
            />
          </div>

          <div className="lg:col-span-3">
            <p className="text-xs text-muted-foreground">
              Valor total calculado:{" "}
              <span className="font-semibold text-foreground">
                {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>{" "}
              — este valor é aplicado automaticamente ao lançamento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
