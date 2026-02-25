import React, { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { X, Search, ChevronRight, Folder, Users, Split, Upload, FileText, Receipt, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fromUntyped } from "@/lib/supabase-helpers";
import { marcarDespesaComoRecebida } from "@/lib/reconciliation-utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasFinanceiro, useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { useAeronaves } from "@/hooks/useAeronaves";
import { useClientes } from "@/hooks/useClientes";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RateioDialog } from "./RateioDialog";

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

interface RateioSocio {
  cliente_id: string;
  cliente_nome: string;
  percentual: number;
  valor_rateado: number;
  horas_voadas?: number;
}

// Cores para os grupos de subcategorias
const SUBCATEGORIA_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  "Despesa Particular": {
    bg: "bg-orange-950/30",
    border: "border-orange-600/50",
    text: "text-orange-400",
    badge: "bg-orange-500/20 text-orange-300 border-orange-500/40"
  },
  "Despesas Reembolsáveis Cliente": {
    bg: "bg-purple-950/30",
    border: "border-purple-600/50",
    text: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/40"
  },
  "Impostos": {
    bg: "bg-blue-950/30",
    border: "border-blue-600/50",
    text: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/40"
  },
  "Folha de Pagamento": {
    bg: "bg-green-950/30",
    border: "border-green-600/50",
    text: "text-green-400",
    badge: "bg-green-500/20 text-green-300 border-green-500/40"
  },
  "Manutenção": {
    bg: "bg-yellow-950/30",
    border: "border-yellow-600/50",
    text: "text-yellow-400",
    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
  },
  "Operacional": {
    bg: "bg-cyan-950/30",
    border: "border-cyan-600/50",
    text: "text-cyan-400",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
  },
  "Administrativo": {
    bg: "bg-pink-950/30",
    border: "border-pink-600/50",
    text: "text-pink-400",
    badge: "bg-pink-500/20 text-pink-300 border-pink-500/40"
  },
  "Combustível": {
    bg: "bg-red-950/30",
    border: "border-red-600/50",
    text: "text-red-400",
    badge: "bg-red-500/20 text-red-300 border-red-500/40"
  },
  "default": {
    bg: "bg-slate-800/30",
    border: "border-slate-600/50",
    text: "text-slate-400",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/40"
  }
};

const getSubcategoriaColor = (subcategoria: string) => {
  return SUBCATEGORIA_COLORS[subcategoria] || SUBCATEGORIA_COLORS["default"];
};

export function FluxoCaixaInlineForm({
  onSuccess,
  onCancel,
  movimentacao
}: FluxoCaixaInlineFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { categorias: allCategorias } = useCategoriasFinanceiro();
  const { contas } = useCategoriasConta();
  const { aeronaves } = useAeronaves();
  const { clientes } = useClientes();

  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [referenciaSearch, setReferenciaSearch] = useState("");
  const [openReferenciaPopover, setOpenReferenciaPopover] = useState(false);
  const [selectedSubcategoria, setSelectedSubcategoria] = useState<string | null>(null);
  const [openCategoriaPopover, setOpenCategoriaPopover] = useState(false);

  // Novos estados para reembolso e rateio
  const [isReembolsavel, setIsReembolsavel] = useState(false);
  const [temRateio, setTemRateio] = useState(false);
  const [rateioDialogOpen, setRateioDialogOpen] = useState(false);

  // Estados para upload de arquivos
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
  const [nfUrl, setNfUrl] = useState<string | null>(null);
  const [reciboUrl, setReciboUrl] = useState<string | null>(null);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [rateioData, setRateioData] = useState<{ socios: RateioSocio[]; tipo: string } | null>(null);

  // Mapeia conta para exibir o banco ao invés do nome
  const contasComBanco = contas.map(c => ({
    nome: c.nome,
    banco: c.banco || c.nome
  }));

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
      tipo_movimento: "saida",
      categoria: "",
      descricao: "",
      valor: "",
      conta_banco: "",
      numero_documento: "",
      referencia: "",
      status: "pago",
      observacoes: "",
      aeronave: "",
      client_id: "",
      client_name: "",
      colaborador_id: "",
      fornecedores_favoritos_id: "",
      grupo_categoria: "",
      data_vencimento: ""
    }
  });

  const tipoMovimento = watch("tipo_movimento");
  const selectedCategoria = watch("categoria");

  // Agrupar categorias por subcategoria (campo 'categoria' na tabela)
  const categoriasPorSubcategoria = useMemo(() => {
    const filteredByType = tipoMovimento === "saida"
      ? allCategorias.filter(c => c.tipo === "despesa")
      : allCategorias.filter(c => c.tipo === "receita");

    const grouped: Record<string, typeof allCategorias> = {};

    filteredByType.forEach(cat => {
      const subcategoria = cat.grupo_categoria || "Sem Grupo";
      if (!grouped[subcategoria]) {
        grouped[subcategoria] = [];
      }
      grouped[subcategoria].push(cat);
    });

    return grouped;
  }, [allCategorias, tipoMovimento]);

  // Lista de subcategorias únicas
  const subcategorias = useMemo(() => {
    return Object.keys(categoriasPorSubcategoria).sort();
  }, [categoriasPorSubcategoria]);

  // Categorias da subcategoria selecionada
  const categoriasDoGrupo = useMemo(() => {
    if (!selectedSubcategoria) return [];
    return categoriasPorSubcategoria[selectedSubcategoria] || [];
  }, [selectedSubcategoria, categoriasPorSubcategoria]);

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

  // File upload handler
  const handleFileUpload = async (file: File, field: 'comprovante' | 'nf' | 'recibo' | 'boleto') => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    setUploadingField(field);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${field}_${Date.now()}.${fileExt}`;
      const filePath = `fiscal/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Erro ao fazer upload: ${uploadError.message}`);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      switch (field) {
        case 'comprovante':
          setComprovanteUrl(publicUrl);
          break;
        case 'nf':
          setNfUrl(publicUrl);
          break;
        case 'recibo':
          setReciboUrl(publicUrl);
          break;
        case 'boleto':
          setBoletoUrl(publicUrl);
          break;
      }

      toast.success("Arquivo enviado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload");
    } finally {
      setUploadingField(null);
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
      setValue("status", movimentacao.status);
      setValue("observacoes", movimentacao.observacoes || "");
      setValue("aeronave", movimentacao.aeronave_registro || "");
      setValue("client_id", movimentacao.client_id || "");
      setValue("client_name", movimentacao.client_name || "");
      setValue("colaborador_id", movimentacao.colaborador_id || "");
      setValue("fornecedores_favoritos_id", movimentacao.fornecedores_favoritos_id || "");
      setIsReembolsavel(movimentacao.reembolsavel || false);
      setTemRateio(movimentacao.tem_rateio || false);

      // Carregar URLs dos arquivos
      setComprovanteUrl(movimentacao.comprovante_url || null);
      setNfUrl(movimentacao.nf_url || null);
      setReciboUrl(movimentacao.recibo_url || null);
      setBoletoUrl(movimentacao.boleto_url || null);

      // Carregar data de vencimento (se houver)
      setValue("data_vencimento", movimentacao.data_vencimento || movimentacao.data || "");

      // Encontrar a subcategoria correspondente
      const cat = allCategorias.find(c => c.nome === movimentacao.categoria);
      if (cat && cat.grupo_categoria) {
        setSelectedSubcategoria(cat.grupo_categoria);
      }
    } else {
      reset();
      setValue("data", getTodayDateString());
      setValue("status", "pago");
      setSelectedSubcategoria(null);
      setIsReembolsavel(false);
      setTemRateio(false);
      setRateioData(null);
      setComprovanteUrl(null);
      setNfUrl(null);
      setReciboUrl(null);
      setBoletoUrl(null);
    }
  }, [movimentacao, setValue, reset, allCategorias]);

  // Atualiza o status quando o tipo de movimento muda
  useEffect(() => {
    if (!movimentacao) {
      setValue("status", tipoMovimento === "entrada" ? "recebido" : "pago");
      setSelectedSubcategoria(null);
      setValue("categoria", "");
      // Resetar reembolso quando trocar para entrada
      if (tipoMovimento === "entrada") {
        setIsReembolsavel(false);
        setTemRateio(false);
        setValue("data_vencimento", getTodayDateString());
      }
    }
  }, [tipoMovimento, movimentacao, setValue]);

  // Atualiza o status para 'aguardando_reembolso' quando seleciona categoria de despesas reembolsáveis
  useEffect(() => {
    if (!movimentacao && tipoMovimento === "saida" && selectedSubcategoria) {
      const isReembolsavelGroup = selectedSubcategoria.toLowerCase().includes("reembolsáve") ||
        selectedSubcategoria.toLowerCase().includes("reembolsave");
      if (isReembolsavelGroup) {
        const currentStatus = watch("status");
        if (currentStatus === "pago" || currentStatus === "pendente") {
          setValue("status", "aguardando_reembolso");
        }
        setIsReembolsavel(true);
      }
    }
  }, [selectedSubcategoria, tipoMovimento, movimentacao, setValue, watch]);

  // Selecionar cliente (para reembolso)
  const handleClienteSelect = (cliente: any) => {
    setValue("client_id", cliente.id);
    setValue("client_name", cliente.company_name || cliente.proprietario || "");
    // NÃO limpar referência ou outros IDs aqui - são campos separados
  };

  // Salvar rateio
  const handleRateioSave = (socios: RateioSocio[], tipo: string) => {
    setRateioData({ socios, tipo });
    setTemRateio(true);
  };

  const onSubmit = async (formData: any) => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    if (!formData.categoria || formData.categoria.trim() === "") {
      toast.error("Categoria é obrigatória");
      return;
    }

    // Validação: se é reembolsável, precisa ter cliente selecionado
    if (isReembolsavel && !formData.client_id) {
      toast.error("Selecione um cliente para despesa reembolsável");
      return;
    }

    try {
      const valor = parseFloat(formData.valor);
      if (isNaN(valor) || valor <= 0) {
        toast.error("Valor deve ser maior que zero");
        return;
      }

      // Encontrar a categoria para pegar o grupo
      const categoriaObj = allCategorias.find(c => c.nome === formData.categoria);
      const grupoCategoria = categoriaObj?.grupo_categoria || selectedSubcategoria || null;

      // Encontrar o ID da categoria
      const categoriaId = categoriaObj?.id;

      if (!categoriaId) {
        toast.error("Categoria não encontrada");
        return;
      }

      // Encontrar aeronave_id pelo registro
      const aeronaveObj = aeronaves?.find(a => a.registration === formData.aeronave);

      const data = {
        data: formData.data,
        data_vencimento: formData.data_vencimento || null,
        tipo_movimento: formData.tipo_movimento,
        categoria_id: categoriaId,
        descricao: formData.descricao,
        valor,
        conta_banco: formData.conta_banco || null,
        numero_documento: formData.numero_documento || null,
        status: formData.status,
        observacoes: formData.observacoes || null,
        aeronave_id: aeronaveObj?.id || null,
        aeronave_registro: formData.aeronave || null,
        client_id: formData.client_id || null,
        client_name: isReembolsavel ? formData.client_name : null,
        colaborador_id: formData.colaborador_id || null,
        fornecedores_favoritos_id: formData.fornecedores_favoritos_id || null,
        reembolsavel: isReembolsavel,
        tem_rateio: temRateio,
        rateio_tipo: rateioData?.tipo || null,
        grupo_categoria: grupoCategoria,
        atualizado_por: user.id,
        comprovante_url: comprovanteUrl,
        nf_url: nfUrl,
        recibo_url: reciboUrl,  // ← CORRIGIDO: era "comprovante_url"
        boleto_url: boletoUrl,
      };

      let lancamentoId: string | null = null;

      if (movimentacao?.id) {
        // Verificar se é uma despesa reembolsável sendo marcada como "recebido"
        // Verifica se o reembolso ainda não foi processado E se o status está/ficou como recebido
        const despesaReembolsavel = movimentacao.reembolsavel === true;
        const ehSaida = movimentacao.tipo_movimento === 'saida';
        const aindaNaoRecebido = movimentacao.reembolso_recebido !== true;
        const statusRecebido = formData.status === 'recebido';
        // Se o status anterior era diferente de recebido OU se nunca foi processado corretamente
        const statusMudouParaRecebido = movimentacao.status !== 'recebido' || aindaNaoRecebido;

        console.log('=== Verificando reembolso ===');
        console.log('despesaReembolsavel:', despesaReembolsavel, '| movimentacao.reembolsavel:', movimentacao.reembolsavel);
        console.log('ehSaida:', ehSaida, '| movimentacao.tipo_movimento:', movimentacao.tipo_movimento);
        console.log('aindaNaoRecebido:', aindaNaoRecebido, '| movimentacao.reembolso_recebido:', movimentacao.reembolso_recebido);
        console.log('statusRecebido:', statusRecebido, '| formData.status:', formData.status);
        console.log('statusMudouParaRecebido:', statusMudouParaRecebido, '| movimentacao.status:', movimentacao.status);

        const isMarkingAsReceived = despesaReembolsavel && ehSaida && aindaNaoRecebido && statusRecebido;
        console.log('isMarkingAsReceived:', isMarkingAsReceived);

        if (isMarkingAsReceived) {
          // Usar função especializada para marcar como recebido e criar entrada
          console.log('Chamando marcarDespesaComoRecebida...');
          const result = await marcarDespesaComoRecebida(
            movimentacao.id,
            formData.data,
            formData.conta_banco || null,
            comprovanteUrl,
            user.id
          );

          console.log('Resultado marcarDespesaComoRecebida:', result);

          if (!result.success) {
            toast.error(result.error || 'Erro ao marcar como recebido');
            return;
          }

          // Invalidar cache para recarregar os dados
          await queryClient.invalidateQueries({ queryKey: ["controle_bancario"] });
          toast.success("Reembolso recebido! Entrada criada no fluxo de caixa.");
          onSuccess();
          return;
        }

        // Atualização normal
        const { error } = await supabase
          .from("controle_bancario")
          .update(data)
          .eq("id", movimentacao.id);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
        lancamentoId = movimentacao.id;
        toast.success("Movimentação atualizada com sucesso!");
      } else {
        const { data: inserted, error } = await supabase
          .from("controle_bancario")
          .insert([{
            ...data,
            criado_por: user.id
          }])
          .select()
          .single();

        if (error) {
          toast.error(`Erro ao criar: ${error.message}`);
          return;
        }
        lancamentoId = inserted?.id;
        toast.success("Movimentação criada com sucesso!");
      }

      // Se tem rateio, salvar os dados de rateio
      if (temRateio && rateioData && lancamentoId && formData.aeronave) {
        // Primeiro deletar rateios existentes
        await fromUntyped("lancamentos_rateio")
          .delete()
          .eq("lancamento_id", lancamentoId);

        // Inserir novos rateios
        const rateiosToInsert = rateioData.socios.map(socio => ({
          lancamento_id: lancamentoId,
          cliente_id: socio.cliente_id || null,
          cliente_nome: socio.cliente_nome,
          aeronave_registro: formData.aeronave,
          percentual: socio.percentual,
          valor_rateado: socio.valor_rateado,
          valor_recebido: 0,
          valor_pendente: socio.valor_rateado,
          status: "pendente",
        }));

        const { error: rateioError } = await fromUntyped("lancamentos_rateio")
          .insert(rateiosToInsert);

        if (rateioError) {
          console.error("Erro ao salvar rateio:", rateioError);
          toast.error("Movimentação salva, mas houve erro ao salvar o rateio");
        }
      }

      // Se é reembolsável e tem cliente, criar conta a receber e entrada no portal
      if (isReembolsavel && formData.client_id && lancamentoId) {
        try {
          // Buscar dados completos do cliente
          const clienteData = clientes.find(c => c.id === formData.client_id);
          const numeroDocumento = `REIMB-${Date.now().toString().slice(-6)}`;

          // Verificar se já existe uma conciliação vinculada a este lançamento (evita duplicatas)
          const { data: existingRecon } = await supabase
            .from('bank_reconciliations')
            .select('id')
            .eq('reference_type', 'controle_bancario')
            .eq('reference_id', lancamentoId)
            .maybeSingle();

          let reconciliationId: string | null = existingRecon?.id || null;

          // Se não existe conciliação, criar (para exibição no portal do cliente)
          if (!reconciliationId) {
            const { data: recon, error: reconciliationError } = await supabase
              .from('bank_reconciliations')
              .insert({
                client_id: formData.client_id,
                aircraft_id: aeronaveObj?.id || null,
                type: 'cliente',
                category: 'Reembolso de Despesa',
                description: `${formData.descricao} - Aguardando reembolso`,
                amount: valor,
                date: formData.data,
                status: 'pendente',
                reference_type: 'controle_bancario',
                reference_id: lancamentoId,
                criado_por: user.id,
                forma_pagamento: 'empresa_paga',
                tipo_documento: 'despesa_viagem',
                afeta_caixa_empresa: true,
              })
              .select('id')
              .maybeSingle();

            if (reconciliationError) {
              console.error('Erro ao criar entrada no portal do cliente:', reconciliationError);
            }

            reconciliationId = recon?.id || reconciliationId;
          }

          // Verificar se já existe conta a receber vinculada a essa conciliação
          let alreadyHasConta = false;
          if (reconciliationId) {
            const { data: existingConta } = await (supabase
              .from('contas_areceber') as any)
              .select('id')
              .eq('banco_conciliacao_id', reconciliationId)
              .maybeSingle();

            alreadyHasConta = !!existingConta;
          }

          // Se não existe, criar conta a receber vinculada (assim aparece na gestão fiscal)
          if (!alreadyHasConta) {
            // A referência é o client_name do controle_bancario (nome do cliente/fornecedor/colaborador)
            const { error: contaReceberError } = await supabase
              .from('contas_areceber')
              .insert({
                numero: numeroDocumento,
                referencia: formData.client_name || clienteData?.company_name || 'Cliente',
                cliente_nome: clienteData?.company_name || formData.client_name || 'Cliente',
                cliente_cnpj: clienteData?.cnpj || '',
                data_criacao: formData.data,
                data_vencimento: formData.data_vencimento || formData.data,
                valor: valor,
                categoria: 'Reembolso de Despesa',
                descricao: formData.descricao,
                status: 'pendente',
                aeronave: formData.aeronave || '',
                criado_por: user.id,
                banco_conciliacao_id: reconciliationId || null
              });

            if (contaReceberError) {
              console.error('Erro ao criar conta a receber:', contaReceberError);
            }
          }
        } catch (err) {
          console.error('Erro ao criar despesa pendente:', err);
        }
      }

      reset();
      setIsReembolsavel(false);
      setTemRateio(false);
      setRateioData(null);
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
        {/* Row 1: Data, Tipo e Valor */}
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
                <SelectItem value="saida">Despesa</SelectItem>
                <SelectItem value="entrada">Receita</SelectItem>
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

        {/* Reembolso e Rateio - Apenas para despesas */}
        {tipoMovimento === "saida" && (
          <Card className="p-4 bg-muted/20 border-border/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={isReembolsavel}
                  onCheckedChange={setIsReembolsavel}
                  id="reembolsavel"
                />
                <Label htmlFor="reembolsavel" className="text-sm font-medium cursor-pointer">
                  É reembolsável?
                </Label>
              </div>
              {isReembolsavel && (
                <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/40">
                  Despesa do Cliente
                </Badge>
              )}
            </div>

            {isReembolsavel && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Cliente *</Label>
                  <Select
                    value={watch("client_id")}
                    onValueChange={(value) => {
                      const cliente = clientes.find(c => c.id === value);
                      if (cliente) handleClienteSelect(cliente);
                    }}
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company_name || c.proprietario}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Aeronave (para rateio)</Label>
                  <Select value={watch("aeronave") || ""} onValueChange={(value) => setValue("aeronave", value)}>
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {aeronaves?.map((aero) => (
                        <SelectItem key={aero.id} value={aero.registration || ""}>
                          {aero.registration}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Data de Vencimento (Reembolso)</Label>
                  <Input
                    id="data_vencimento"
                    type="date"
                    {...register("data_vencimento")}
                    className={`h-9 bg-background`}
                  />
                </div>
              </div>
            )}

            {isReembolsavel && watch("aeronave") && (
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant={temRateio ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRateioDialogOpen(true)}
                  className="gap-2"
                >
                  <Split className="h-4 w-4" />
                  {temRateio ? "Editar Rateio" : "Configurar Rateio"}
                </Button>
                {temRateio && rateioData && (
                  <Badge variant="secondary" className="text-xs">
                    {rateioData.socios.length} sócios
                  </Badge>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Row 2: Categoria Hierárquica e Descrição */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <Label htmlFor="categoria" className="text-sm font-semibold text-foreground mb-2">
              Categoria *
            </Label>
            <Popover open={openCategoriaPopover} onOpenChange={setOpenCategoriaPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-10 w-full justify-between bg-background",
                    !selectedCategoria ? "border-red-500/50" : "",
                    selectedCategoria && selectedSubcategoria
                      ? getSubcategoriaColor(selectedSubcategoria).border
                      : ""
                  )}
                >
                  {selectedCategoria ? (
                    <div className="flex items-center gap-2 overflow-hidden">
                      {selectedSubcategoria && (
                        <Badge
                          variant="outline"
                          className={cn("text-xs shrink-0", getSubcategoriaColor(selectedSubcategoria).badge)}
                        >
                          {selectedSubcategoria}
                        </Badge>
                      )}
                      <span className="truncate">{selectedCategoria}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Selecione uma categoria</span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0 bg-card border-border" align="start">
                <div className="p-3 border-b border-border/50">
                  <p className="text-sm font-medium text-foreground mb-2">
                    {!selectedSubcategoria ? "Selecione o grupo" : `Categorias de: ${selectedSubcategoria}`}
                  </p>
                  {selectedSubcategoria && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSubcategoria(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ← Voltar aos grupos
                    </Button>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2">
                  {!selectedSubcategoria ? (
                    // Mostrar subcategorias/grupos
                    <div className="space-y-1">
                      {subcategorias.map((sub) => {
                        const colors = getSubcategoriaColor(sub);
                        const count = categoriasPorSubcategoria[sub]?.length || 0;
                        return (
                          <Button
                            key={sub}
                            variant="ghost"
                            className={cn(
                              "w-full justify-between h-auto py-3 px-3 rounded-lg transition-all",
                              colors.bg,
                              colors.border,
                              "border hover:opacity-80"
                            )}
                            onClick={() => setSelectedSubcategoria(sub)}
                          >
                            <div className="flex items-center gap-2">
                              <Folder className={cn("h-4 w-4", colors.text)} />
                              <span className={cn("font-medium", colors.text)}>{sub}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {count}
                            </Badge>
                          </Button>
                        );
                      })}
                      {subcategorias.length === 0 && (
                        <p className="text-center py-4 text-muted-foreground text-sm">
                          Nenhum grupo disponível para {tipoMovimento === "saida" ? "despesas" : "receitas"}
                        </p>
                      )}
                    </div>
                  ) : (
                    // Mostrar categorias do grupo selecionado
                    <div className="space-y-1">
                      {categoriasDoGrupo.map((cat) => {
                        const colors = getSubcategoriaColor(selectedSubcategoria);
                        return (
                          <Button
                            key={cat.id}
                            variant="ghost"
                            className={cn(
                              "w-full justify-start h-auto py-2 px-3 rounded-lg",
                              selectedCategoria === cat.nome
                                ? cn(colors.bg, colors.border, "border")
                                : "hover:bg-muted/50"
                            )}
                            onClick={() => {
                              setValue("categoria", cat.nome);
                              setOpenCategoriaPopover(false);
                            }}
                          >
                            <span className={selectedCategoria === cat.nome ? colors.text : "text-foreground"}>
                              {cat.nome}
                            </span>
                          </Button>
                        );
                      })}
                      {categoriasDoGrupo.length === 0 && (
                        <p className="text-center py-4 text-muted-foreground text-sm">
                          Nenhuma categoria neste grupo
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">Selecione o grupo e depois a categoria</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 w-full">
          <div>
            <Label htmlFor="conta_banco" className="text-sm font-semibold text-foreground mb-2">
              Conta
            </Label>
            <Select defaultValue="" onValueChange={(value) => setValue("conta_banco", value)}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent align="start">
                {contasComBanco.map((conta) => (
                  <SelectItem key={conta.nome} value={conta.banco}>
                    {conta.banco}
                  </SelectItem>
                ))}
                {contasComBanco.length === 0 && (
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
              Referência {tipoMovimento === "entrada" ? "(Cliente/Fornecedor)" : ""}
            </Label>
            <Popover open={openReferenciaPopover} onOpenChange={setOpenReferenciaPopover}>
              <PopoverTrigger asChild>
                <div
                  className="relative cursor-pointer"
                  onClick={() => setOpenReferenciaPopover(true)}
                >
                  <Input
                    id="referencia"
                    placeholder={tipoMovimento === "entrada" ? "Ex: Cliente, Fornecedor..." : "Ex: Cliente, Fornecedor, Colaborador..."}
                    value={watch("referencia")}
                    onChange={(e) => {
                      setValue("referencia", e.target.value);
                      setReferenciaSearch(e.target.value);
                      if (e.target.value) {
                        setOpenReferenciaPopover(true);
                      }
                    }}
                    className="h-10 bg-background pr-10 cursor-pointer"
                    readOnly={false}
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
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
                                  setValue("client_id", r.id);
                                  setValue("colaborador_id", "");
                                  setValue("fornecedores_favoritos_id", "");
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
                                  setValue("fornecedores_favoritos_id", r.id);
                                  setValue("client_id", "");
                                  setValue("colaborador_id", "");
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
                                  setValue("colaborador_id", r.id);
                                  setValue("client_id", "");
                                  setValue("fornecedores_favoritos_id", "");
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
                {Array.isArray(aeronaves) && aeronaves.length > 0 ? (
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

        {/* Row 5: Anexos (Opcional) */}
        <Card className="p-4 bg-muted/10 border-border/30">
          <Label className="text-sm font-semibold text-foreground mb-3 block">
            Anexos (Opcional)
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Comprovante de Pagamento */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Comprovante</Label>
              <div className="flex items-center gap-2">
                {comprovanteUrl ? (
                  <div className="flex items-center gap-2 flex-1">
                    <a
                      href={comprovanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-green-400 hover:underline truncate"
                    >
                      <CreditCard className="h-4 w-4 shrink-0" />
                      <span className="truncate">Anexado</span>
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      onClick={() => setComprovanteUrl(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {uploadingField === 'comprovante' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>Anexar</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={uploadingField !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'comprovante');
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Nota Fiscal */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nota Fiscal</Label>
              <div className="flex items-center gap-2">
                {nfUrl ? (
                  <div className="flex items-center gap-2 flex-1">
                    <a
                      href={nfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-400 hover:underline truncate"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">Anexado</span>
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      onClick={() => setNfUrl(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {uploadingField === 'nf' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>Anexar</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.xml"
                      disabled={uploadingField !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'nf');
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Recibo */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Recibo</Label>
              <div className="flex items-center gap-2">
                {reciboUrl ? (
                  <div className="flex items-center gap-2 flex-1">
                    <a
                      href={reciboUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-purple-400 hover:underline truncate"
                    >
                      <Receipt className="h-4 w-4 shrink-0" />
                      <span className="truncate">Anexado</span>
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      onClick={() => setReciboUrl(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {uploadingField === 'recibo' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>Anexar</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={uploadingField !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'recibo');
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Boleto */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Boleto</Label>
              <div className="flex items-center gap-2">
                {boletoUrl ? (
                  <div className="flex items-center gap-2 flex-1">
                    <a
                      href={boletoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-orange-400 hover:underline truncate"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">Anexado</span>
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      onClick={() => setBoletoUrl(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {uploadingField === 'boleto' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>Anexar</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={uploadingField !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'boleto');
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </Card>

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

      {/* Rateio Dialog */}
      <RateioDialog
        open={rateioDialogOpen}
        onOpenChange={setRateioDialogOpen}
        valorTotal={parseFloat(watch("valor") || "0")}
        aeronaveRegistro={watch("aeronave") || ""}
        aeronaveId={aeronaves?.find(a => a.registration === watch("aeronave"))?.id}
        onSave={handleRateioSave}
      />
    </div>
  );
}
