import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasFinanceiro, useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { useAeronaves } from "@/hooks/useAeronaves";
import { format } from "date-fns";

interface FluxoCaixaInlineFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  movimentacao?: any;
}

interface Referencia {
  id: string;
  nome: string;
  documento: string;
  tipo: 'client' | 'user' | 'fornecedor';
}

interface FornecedorFavorito {
  id: string;
  nome_completo: string;
  documento: string | null;
  cidade: string | null;
  telefone: string | null;
}

export function FluxoCaixaInlineForm({
  onSuccess,
  onCancel,
  movimentacao
}: FluxoCaixaInlineFormProps) {
  const { user } = useAuth();
  const { categorias: allCategorias } = useCategoriasFinanceiro();
  const { contas } = useCategoriasConta();
  const { aeronaves } = useAeronaves();

  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [referenciaSearch, setReferenciaSearch] = useState("");
  const [openReferenciaPopover, setOpenReferenciaPopover] = useState(false);

  const categoriaNomes = allCategorias.map(c => c.nome);
  const contaNomes = contas.map(c => c.nome);

  // Get today's date in local timezone without conversion issues
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    mode: "onBlur",
    defaultValues: {
      data: getTodayDateString(),
      tipo_movimento: "entrada",
      categoria: "",
      descricao: "",
      valor: "",
      conta_banco: "",
      numero_documento: "",
      referencia: "",
      status: "recebido",
      observacoes: "",
      aeronave: ""
    }
  });

  const tipoMovimento = watch("tipo_movimento");

  useEffect(() => {
    loadReferencias();
  }, []);

  const loadReferencias = async () => {
    try {
      const [clientsData, usersData, fornecedoresData] = await Promise.all([
        supabase.from("clients").select("id, company_name, cnpj").order("company_name"),
        supabase.from("user_profiles").select("id, full_name, cpf").order("full_name"),
        supabase.from("fornecedores_favoritos").select("id, nome_completo, documento, cidade, telefone").order("nome_completo")
      ]);

      const referenciasList: Referencia[] = [];

      if (clientsData.data) {
        clientsData.data.forEach(client => {
          if (client.company_name) {
            referenciasList.push({
              id: client.id,
              nome: client.company_name,
              documento: client.cnpj || "",
              tipo: 'client'
            });
          }
        });
      }

      if (usersData.data) {
        usersData.data.forEach(user => {
          if (user.full_name) {
            referenciasList.push({
              id: user.id,
              nome: user.full_name,
              documento: user.cpf || "",
              tipo: 'user'
            });
          }
        });
      }

      if (fornecedoresData.data) {
        fornecedoresData.data.forEach((fornecedor: FornecedorFavorito) => {
          referenciasList.push({
            id: fornecedor.id,
            nome: fornecedor.nome_completo,
            documento: fornecedor.documento || "",
            tipo: 'fornecedor'
          });
        });
      }

      setReferencias(referenciasList);
    } catch (error) {
      console.error("Erro ao carregar referências:", error);
    }
  };

  useEffect(() => {
    if (movimentacao) {
      setValue("data", movimentacao.data);
      setValue("tipo_movimento", movimentacao.tipo_movimento);
      setValue("categoria", movimentacao.categoria);
      setValue("descricao", movimentacao.descricao);
      setValue("valor", movimentacao.valor.toString());
      setValue("conta_banco", movimentacao.conta_banco || "");
      setValue("numero_documento", movimentacao.numero_documento || "");
      setValue("referencia", movimentacao.referencia || "");
      setValue("status", movimentacao.status);
      setValue("observacoes", movimentacao.observacoes || "");
      setValue("aeronave", movimentacao.aeronave || "");
    } else {
      reset();
      setValue("data", getTodayDateString());
      setValue("status", "recebido");
    }
  }, [movimentacao, setValue, reset]);

  // Atualiza o status quando o tipo de movimento muda
  useEffect(() => {
    if (!movimentacao) {
      setValue("status", tipoMovimento === "entrada" ? "recebido" : "pago");
    }
  }, [tipoMovimento, movimentacao, setValue]);

  const onSubmit = async (formData: any) => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    try {
      const valor = parseFloat(formData.valor);
      if (isNaN(valor) || valor <= 0) {
        toast.error("Valor deve ser maior que zero");
        return;
      }

      const data = {
        data: formData.data,
        tipo_movimento: formData.tipo_movimento,
        categoria: formData.categoria,
        descricao: formData.descricao,
        valor,
        conta_banco: formData.conta_banco || null,
        numero_documento: formData.numero_documento || null,
        referencia: formData.referencia || null,
        status: formData.status,
        observacoes: formData.observacoes || null,
        aeronave: formData.aeronave || null,
        atualizado_por: user.id,
      };

      if (movimentacao?.id) {
        const { error } = await supabase
          .from("controle_bancario")
          .update(data)
          .eq("id", movimentacao.id);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
        toast.success("Movimentação atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("controle_bancario")
          .insert([{
            ...data,
            criado_por: user.id
          }]);

        if (error) {
          toast.error(`Erro ao criar: ${error.message}`);
          return;
        }
        toast.success("Movimentação criada com sucesso!");
      }

      reset();
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar movimentação");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border/30">
        <h3 className="text-lg font-semibold text-foreground">
          {movimentacao ? "Editar Movimentação" : "Nova Movimentação"}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Row 1: Data e Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <Label htmlFor="data" className="text-sm font-semibold text-foreground mb-2">
              Data *
            </Label>
            <Input
              id="data"
              type="date"
              {...register("data", { required: "Data é obrigatória" })}
              className={`h-10 bg-background ${errors.data ? "border-red-500" : ""}`}
            />
            {errors.data && <span className="text-xs text-red-500 mt-1 block">{errors.data.message}</span>}
          </div>

          <div>
            <Label htmlFor="tipo_movimento" className="text-sm font-semibold text-foreground mb-2">
              Tipo *
            </Label>
            <Select value={tipoMovimento} onValueChange={(value) => setValue("tipo_movimento", value)}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saída">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="valor" className="text-sm font-semibold text-foreground mb-2">
              Valor *
            </Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register("valor", { required: "Valor é obrigatório" })}
              className={`h-10 bg-background ${errors.valor ? "border-red-500" : ""}`}
            />
            {errors.valor && <span className="text-xs text-red-500 mt-1 block">{errors.valor.message}</span>}
          </div>
        </div>

        {/* Row 2: Categoria e Descrição */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <Label htmlFor="categoria" className="text-sm font-semibold text-foreground mb-2">
              Categoria *
            </Label>
            <Select defaultValue="" onValueChange={(value) => setValue("categoria", value)}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent align="start">
                {categoriaNomes.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
                {categoriaNomes.length === 0 && (
                  <div className="text-center py-3 text-muted-foreground text-sm">
                    Nenhuma categoria disponível
                  </div>
                )}
              </SelectContent>
            </Select>
            {errors.categoria && <span className="text-xs text-red-500 mt-1 block">Obrigatório</span>}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="descricao" className="text-sm font-semibold text-foreground mb-2">
              Descrição *
            </Label>
            <Input
              id="descricao"
              placeholder="Descreva a movimentação"
              {...register("descricao", { required: "Descrição é obrigatória" })}
              className={`h-10 bg-background ${errors.descricao ? "border-red-500" : ""}`}
            />
            {errors.descricao && <span className="text-xs text-red-500 mt-1 block">{errors.descricao.message}</span>}
          </div>
        </div>

        {/* Row 3: Conta, Documento, Referência e Aeronave */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div>
            <Label htmlFor="conta_banco" className="text-sm font-semibold text-foreground mb-2">
              Conta
            </Label>
            <Select defaultValue="" onValueChange={(value) => setValue("conta_banco", value)}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent align="start">
                {contaNomes.map((conta) => (
                  <SelectItem key={conta} value={conta}>
                    {conta}
                  </SelectItem>
                ))}
                {contaNomes.length === 0 && (
                  <div className="text-center py-3 text-muted-foreground text-sm">
                    Nenhuma conta disponível
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="numero_documento" className="text-sm font-semibold text-foreground mb-2">
              Nº Documento
            </Label>
            <Input
              id="numero_documento"
              placeholder="Ex: NF, Cheque"
              {...register("numero_documento")}
              className="h-10 bg-background"
            />
          </div>

          <div>
            <Label htmlFor="referencia" className="text-sm font-semibold text-foreground mb-2">
              Referência
            </Label>
            <Popover open={openReferenciaPopover} onOpenChange={setOpenReferenciaPopover}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Input
                    id="referencia"
                    placeholder="Buscar cliente ou colaborador..."
                    value={watch("referencia")}
                    onChange={(e) => {
                      setValue("referencia", e.target.value);
                      setReferenciaSearch(e.target.value);
                      if (e.target.value) {
                        setOpenReferenciaPopover(true);
                      }
                    }}
                    onFocus={() => setOpenReferenciaPopover(true)}
                    className="h-10 bg-background pr-10"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                <Command className="bg-card">
                  <CommandInput
                    placeholder="Buscar..."
                    value={referenciaSearch}
                    onValueChange={setReferenciaSearch}
                    className="bg-background"
                  />
                  <CommandList>
                    <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                      Nenhum resultado encontrado
                    </CommandEmpty>
                    {referencias.filter(r => r.tipo === 'client').some(r =>
                      r.nome.toLowerCase().includes(referenciaSearch.toLowerCase()) ||
                      r.documento.includes(referenciaSearch)
                    ) && (
                      <CommandGroup heading="Clientes" className="text-muted-foreground">
                        {referencias
                          .filter(r => r.tipo === 'client')
                          .filter(r =>
                            r.nome.toLowerCase().includes(referenciaSearch.toLowerCase()) ||
                            r.documento.includes(referenciaSearch)
                          )
                          .slice(0, 10)
                          .map((r) => (
                            <CommandItem
                              key={r.id}
                              onSelect={() => {
                                setValue("referencia", r.nome);
                                setOpenReferenciaPopover(false);
                                setReferenciaSearch("");
                              }}
                              className="cursor-pointer hover:bg-muted"
                            >
                              <div>
                                <p className="font-medium text-foreground">{r.nome}</p>
                                {r.documento && <p className="text-xs text-muted-foreground">{r.documento}</p>}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    )}
                    {referencias.filter(r => r.tipo === 'fornecedor').some(r =>
                      r.nome.toLowerCase().includes(referenciaSearch.toLowerCase()) ||
                      r.documento.includes(referenciaSearch)
                    ) && (
                      <CommandGroup heading="Fornecedores Favoritos" className="text-muted-foreground">
                        {referencias
                          .filter(r => r.tipo === 'fornecedor')
                          .filter(r =>
                            r.nome.toLowerCase().includes(referenciaSearch.toLowerCase()) ||
                            r.documento.includes(referenciaSearch)
                          )
                          .slice(0, 10)
                          .map((r) => (
                            <CommandItem
                              key={r.id}
                              onSelect={() => {
                                setValue("referencia", r.nome);
                                setOpenReferenciaPopover(false);
                                setReferenciaSearch("");
                              }}
                              className="cursor-pointer hover:bg-muted"
                            >
                              <div>
                                <p className="font-medium text-foreground">{r.nome}</p>
                                {r.documento && <p className="text-xs text-muted-foreground">{r.documento}</p>}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    )}
                    {referencias.filter(r => r.tipo === 'user').some(r =>
                      r.nome.toLowerCase().includes(referenciaSearch.toLowerCase()) ||
                      r.documento.includes(referenciaSearch)
                    ) && (
                      <CommandGroup heading="Colaboradores" className="text-muted-foreground">
                        {referencias
                          .filter(r => r.tipo === 'user')
                          .filter(r =>
                            r.nome.toLowerCase().includes(referenciaSearch.toLowerCase()) ||
                            r.documento.includes(referenciaSearch)
                          )
                          .slice(0, 10)
                          .map((r) => (
                            <CommandItem
                              key={r.id}
                              onSelect={() => {
                                setValue("referencia", r.nome);
                                setOpenReferenciaPopover(false);
                                setReferenciaSearch("");
                              }}
                              className="cursor-pointer hover:bg-muted"
                            >
                              <div>
                                <p className="font-medium text-foreground">{r.nome}</p>
                                {r.documento && <p className="text-xs text-muted-foreground">{r.documento}</p>}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="aeronave" className="text-sm font-semibold text-foreground mb-2">
              Aeronave (Opcional)
            </Label>
            <Select value={watch("aeronave") || ""} onValueChange={(value) => setValue("aeronave", value)}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="Selecione uma aeronave" />
              </SelectTrigger>
              <SelectContent align="start">
                {aeronaves && aeronaves.length > 0 ? (
                  aeronaves.map((aero) => (
                    <SelectItem key={aero.id} value={aero.registration || ""}>
                      {aero.registration} - {aero.model || ""}
                    </SelectItem>
                  ))
                ) : (
                  <div className="text-center py-3 text-muted-foreground text-sm">
                    Nenhuma aeronave disponível
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 4: Status e Observações */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label htmlFor="status" className="text-sm font-semibold text-foreground mb-2">
              Status
            </Label>
            <Select
              defaultValue={tipoMovimento === "entrada" ? "recebido" : "pago"}
              onValueChange={(value) => setValue("status", value)}
            >
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {tipoMovimento === "entrada" ? (
                  <SelectItem value="recebido">Recebido</SelectItem>
                ) : (
                  <SelectItem value="pago">Pago</SelectItem>
                )}
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="observacoes" className="text-sm font-semibold text-foreground mb-2">
              Observações
            </Label>
            <Input
              id="observacoes"
              placeholder="Notas adicionais"
              {...register("observacoes")}
              className="h-10 bg-background"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-6 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-10 px-6"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-primary hover:bg-primary/90 h-10 px-6"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
