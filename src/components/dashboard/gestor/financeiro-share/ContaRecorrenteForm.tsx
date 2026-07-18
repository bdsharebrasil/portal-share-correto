
import React, { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { format } from "date-fns";
import { X, Save } from "lucide-react";

interface ContaRecorrenteFormProps {
  conta?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const frequencias = [
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" }
];

const diasDoMes = Array.from({ length: 31 }, (_, i) => i + 1);

const TIPOS_DESPESA = [
  { value: "DESPESAS EMPRESA", label: "EMPRESA" },
  { value: "DESPESAS PARTICULARES", label: "PARTICULAR" },
  { value: "DESPESAS REEMBOLSÁVEIS", label: "CLIENTE - REEMBOLSÁVEL" },
];

export function ContaRecorrenteForm({
  conta,
  onSuccess,
  onCancel
}: ContaRecorrenteFormProps) {
  const { user } = useAuth();
  const { categorias } = useCategoriasFinanceiro();
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [selectedFornecedorId, setSelectedFornecedorId] = useState<string>("");
  const [contaPagamento, setContaPagamento] = useState<string>("");
  const [tipoDespesa, setTipoDespesa] = useState<string>("");

  useEffect(() => {
    loadFornecedores();
  }, []);

  const loadFornecedores = async () => {
    try {
      const { data, error } = await supabase
        .from("fornecedores_favoritos")
        .select("id, nome_completo, documento, categoria, apelido, conta_pagamento")
        .order("nome_completo", { ascending: true });

      if (error) {
        console.error("Erro ao carregar fornecedores:", error);
        return;
      }
      setFornecedores(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar fornecedores:", error.message);
    }
  };

  const fornecedorItems = useMemo(() => {
    return fornecedores.map(f => ({
      id: f.id,
      label: f.apelido ? `${f.nome_completo} (${f.apelido})` : f.nome_completo
    }));
  }, [fornecedores]);

  // Subcategorias filtradas pelo grupo_categoria selecionado
  const subcategorias = useMemo(() => {
    if (!tipoDespesa) return [];
    return categorias
      .filter(cat => cat.tipo === "despesa" && cat.grupo_categoria === tipoDespesa)
      .map(cat => ({ id: cat.id, label: cat.nome }));
  }, [categorias, tipoDespesa]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      descricao: "",
      fornecedor: "",
      valor: "",
      categoria: "",
      status: "agendado",
      frequencia_recorrencia: "mensal",
      dia_recorrencia: "1",
      lembrete_antecipado: true,
      notas: ""
    }
  });

  const lembreteAntecipado = watch("lembrete_antecipado");

  useEffect(() => {
    if (conta) {
      setValue("descricao", conta.descricao);
      setValue("fornecedor", conta.fornecedor);
      setValue("valor", conta.valor?.toString() || "");
      setValue("categoria", conta.categoria || "");
      setValue("status", conta.status || (conta as any).status);
      setValue("frequencia_recorrencia", conta.frequencia_recorrencia || "mensal");
      setValue("dia_recorrencia", conta.dia_recorrencia?.toString() || "1");
      setValue("lembrete_antecipado", conta.lembrete_antecipado || false);
      setValue("notas", conta.notas || "");

      // Set fornecedor selection
      if (conta.fornecedor_favorito_id) {
        setSelectedFornecedorId(conta.fornecedor_favorito_id);
        const forn = fornecedores.find(f => f.id === conta.fornecedor_favorito_id);
        if (forn) setContaPagamento(forn.conta_pagamento || "");
      }

      // Set tipo despesa from categoria
      if (conta.tipo_despesa) {
        setTipoDespesa(conta.tipo_despesa);
      }
    } else {
      reset();
      setValue("status", "agendado");
      setValue("frequencia_recorrencia", "mensal");
      setValue("dia_recorrencia", "1");
      setValue("lembrete_antecipado", true);
      setSelectedFornecedorId("");
      setContaPagamento("");
      setTipoDespesa("");
    }
  }, [conta, setValue, reset, fornecedores]);

  const handleFornecedorChange = (id: string, label: string) => {
    setSelectedFornecedorId(id);
    const forn = fornecedores.find(f => f.id === id);
    if (forn) {
      setValue("fornecedor", forn.nome_completo);
      setContaPagamento(forn.conta_pagamento || "");
    } else {
      setValue("fornecedor", "");
      setContaPagamento("");
    }
  };

  const onSubmit = async (formData: any) => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    try {
      let valor = null;
      if (formData.valor) {
        valor = parseFloat(formData.valor);
        if (isNaN(valor) || valor < 0) {
          toast.error("Valor deve ser um número válido e maior ou igual a zero");
          return;
        }
      }

      const data = {
        descricao: formData.descricao,
        fornecedor: formData.fornecedor,
        fornecedor_favorito_id: selectedFornecedorId || null,
        conta_pagamento: contaPagamento || null,
        valor: valor !== null ? valor : null,
        categoria: formData.categoria || null,
        tipo_despesa: tipoDespesa || null,
        status: formData.status,
        frequencia_recorrencia: formData.frequencia_recorrencia,
        dia_recorrencia: formData.dia_recorrencia ? parseInt(formData.dia_recorrencia) : null,
        lembrete_antecipado: formData.lembrete_antecipado || false,
        notas: formData.notas || null,
        atualizado_por: user.id,
      };

      if (conta?.id) {
        const { error } = await supabase
          .from("contas_recorrentes")
          .update(data as any)
          .eq("id", conta.id);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
        toast.success("Conta recorrente atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("contas_recorrentes")
          .insert({
            ...data,
            criado_por: user.id
          } as any);

        if (error) {
          toast.error(`Erro ao criar: ${error.message}`);
          return;
        }
        toast.success("Conta recorrente criada com sucesso!");
      }

      reset();
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar conta recorrente");
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-foreground">
          {conta ? "Editar Conta Recorrente" : "Nova Conta Recorrente"}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="descricao">Descrição da Conta *</Label>
              <Input
                id="descricao"
                placeholder="Ex: Internet, Aluguel, Seguro"
                {...register("descricao", { required: "Descrição é obrigatória" })}
                className={errors.descricao ? "border-destructive" : ""}
              />
              {errors.descricao && <span className="text-xs text-destructive">{errors.descricao.message}</span>}
            </div>

            <div>
              <Label htmlFor="fornecedor">Fornecedor/Beneficiário *</Label>
              <SearchableCombobox
                items={fornecedorItems}
                value={selectedFornecedorId}
                onChange={handleFornecedorChange}
                placeholder="Selecione um fornecedor..."
                searchPlaceholder="Buscar fornecedor..."
                emptyMessage="Nenhum fornecedor encontrado."
              />
              {errors.fornecedor && <span className="text-xs text-destructive">{errors.fornecedor.message}</span>}
              {contaPagamento && (
                <div className="mt-1.5 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">💳 Conta pagamento: {contaPagamento}</p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="valor">Valor</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                placeholder="R$"
                {...register("valor")}
                className={errors.valor ? "border-destructive" : ""}
              />
            </div>

            {/* Seleção de Tipo de Despesa (nível 1) */}
            <div>
              <Label>Tipo de Despesa</Label>
              <RegularSelect value={tipoDespesa} onValueChange={(val) => {
                setTipoDespesa(val);
                setValue("categoria", ""); // Reset subcategoria
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="w-full">
                  {TIPOS_DESPESA.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </RegularSelect>
            </div>

            {/* Subcategoria (nível 2) - aparece após selecionar tipo */}
            {tipoDespesa && (
              <div>
                <Label>Categoria</Label>
                <SearchableCombobox
                  items={subcategorias}
                  value={subcategorias.find(s => s.label === watch("categoria"))?.id || ""}
                  onChange={(id, label) => setValue("categoria", label)}
                  placeholder="Selecione a categoria..."
                  searchPlaceholder="Buscar categoria..."
                  emptyMessage="Nenhuma categoria encontrada para este tipo."
                />
              </div>
            )}

            <div>
              <Label htmlFor="status">Status</Label>
              <RegularSelect value={watch("status")} onValueChange={(value) => setValue("status", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-full">
                  <SelectItem value="agendado">Ativo</SelectItem>
                  <SelectItem value="cancelado">Inativo</SelectItem>
                </SelectContent>
              </RegularSelect>
            </div>
          </div>

          {/* Seção de Recorrência */}
          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="font-semibold text-foreground">Configuração de Recorrência</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
              <div>
                <Label htmlFor="frequencia_recorrencia">Frequência de Pagamento *</Label>
                <RegularSelect value={watch("frequencia_recorrencia")} onValueChange={(value) => setValue("frequencia_recorrencia", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    {frequencias.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </RegularSelect>
              </div>

              <div>
                <Label htmlFor="dia_recorrencia">Dia do Mês para Vencimento *</Label>
                <RegularSelect value={watch("dia_recorrencia")} onValueChange={(value) => setValue("dia_recorrencia", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] w-full">
                    {diasDoMes.map((dia) => (
                      <SelectItem key={dia} value={dia.toString()}>
                        Dia {dia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </RegularSelect>
                <p className="text-xs text-muted-foreground mt-1">
                  Esta conta vence todo dia <strong>{watch("dia_recorrencia") || "?"}</strong> do mês
                </p>
              </div>

              <div className="md:col-span-2 space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="lembrete_antecipado"
                    checked={lembreteAntecipado}
                    onCheckedChange={(checked) => setValue("lembrete_antecipado", checked as boolean)}
                  />
                  <Label htmlFor="lembrete_antecipado" className="cursor-pointer">
                    Deseja receber lembretes antecipados sobre essa conta?
                  </Label>
                </div>
                {lembreteAntecipado && (
                  <p className="text-sm text-muted-foreground ml-6 p-2 bg-primary/10 rounded border border-primary/20">
                    🔔 Você receberá notificações <strong>3 dias antes</strong>, <strong>2 dias antes</strong> e <strong>1 dia antes</strong> do vencimento.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notas">Notas e Observações</Label>
            <Textarea
              id="notas"
              placeholder="Adicione observações sobre essa conta recorrente (opcional)"
              rows={2}
              {...register("notas")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? "Salvando..." : "Salvar Conta Recorrente"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
