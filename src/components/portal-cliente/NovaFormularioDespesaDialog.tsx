import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Calendar, Building2, Tag, X, Check, ChevronsUpDown, Fuel, MapPin, Plane, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

// ID da categoria de combustível aeronave
const COMBUSTIVEL_AERONAVE_CATEGORIA_ID = "e4693f97-73bf-43ad-9a0e-86188e96a439";

interface NovaFormularioDespesaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  aircraftId: string;
  aircraftRegistration: string;
  onSuccess: () => void;
}

interface CategoriaMovimentacao {
  id: string;
  nome: string;
  tipo: string;
  grupo_categoria: string | null;
}

interface FornecedorFavorito {
  id: string;
  nome_completo: string;
  documento?: string;
  categoria?: string;
  apelido?: string;
}

export function NovaFormularioDespesaDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  aircraftId,
  aircraftRegistration,
  onSuccess
}: NovaFormularioDespesaDialogProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoriaMovimentacao[]>([]);
  const [fornecedoresFavoritos, setFornecedoresFavoritos] = useState<FornecedorFavorito[]>([]);
  
  // Form state - Campos básicos
  const [categoriaId, setCategoriaId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorCnpj, setFornecedorCnpj] = useState("");
  const [fornecedorSearchValue, setFornecedorSearchValue] = useState("");
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [notaFiscalFile, setNotaFiscalFile] = useState<File | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);

  // Form state - Campos de Abastecimento
  const [litros, setLitros] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [local, setLocal] = useState("");
  const [trecho, setTrecho] = useState("");
  const [dataAbastecimento, setDataAbastecimento] = useState("");
  const [abastecedor, setAbastecedor] = useState("");
  const [comanda, setComanda] = useState("");
  const [observacao, setObservacao] = useState("");
  const [comandaFile, setComandaFile] = useState<File | null>(null);

  // Verifica se a categoria selecionada é de combustível
  const isCombustivel = useMemo(() => {
    if (!categoriaId) return false;
    const categoria = categories.find(c => c.id === categoriaId);
    return categoria?.nome?.toUpperCase().includes('COMBUSTÍVEL AERONAVE') || 
           categoriaId === COMBUSTIVEL_AERONAVE_CATEGORIA_ID;
  }, [categoriaId, categories]);

  // Calcular valor total automaticamente quando litros ou valor unitário mudar
  useEffect(() => {
    if (isCombustivel && litros && valorUnitario) {
      const litrosNum = parseFloat(litros.replace(',', '.')) || 0;
      const valorUnitarioNum = parseFloat(valorUnitario.replace(',', '.')) || 0;
      const total = litrosNum * valorUnitarioNum;
      if (total > 0) {
        setValor(total.toFixed(2).replace('.', ','));
      }
    }
  }, [litros, valorUnitario, isCombustivel]);

  // Carregar categorias e fornecedores ao abrir o dialog
  useEffect(() => {
    if (open) {
      loadCategories();
      loadFornecedoresFavoritos();
      const today = new Date().toISOString().split('T')[0];
      setDataVencimento(today);
      setDataAbastecimento(today);
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_movimentacao')
        .select('id, nome, tipo, grupo_categoria')
        .eq('ativo', true)
        .or('grupo_categoria.eq.Despesas Aeronave,reembolsavel.eq.true')
        .order('grupo_categoria', { ascending: true })
        .order('nome', { ascending: true });

      if (error) throw error;
      setCategories((data || []) as CategoriaMovimentacao[]);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const loadFornecedoresFavoritos = async () => {
    try {
      const { data, error } = await supabase
        .from('fornecedores_favoritos')
        .select('id, nome_completo, documento, categoria, apelido')
        .eq('categoria', 'share')
        .order('nome_completo', { ascending: true });

      if (error) throw error;
      setFornecedoresFavoritos((data || []) as FornecedorFavorito[]);
    } catch (error) {
      console.error('Erro ao carregar fornecedores favoritos:', error);
      toast.error('Erro ao carregar fornecedores');
    }
  };

  const handleSelectFornecedor = (fornecedor: FornecedorFavorito) => {
    setFornecedorId(fornecedor.id);
    setFornecedorNome(fornecedor.nome_completo);
    setFornecedorCnpj(fornecedor.documento || "");
    setFornecedorSearchValue("");
    setOpenCombobox(false);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 100);
      const fileExt = sanitizedFileName.split('.').pop();
      const fileName = `${folder}/${clientId}/${timestamp}.${fileExt}`;

      const { error } = await supabase.storage
        .from('client-documents')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('client-documents')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!valor || parseFloat(valor.replace(',', '.')) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (!categoriaId) {
      toast.error('Selecione uma categoria');
      return;
    }

    if (!descricao.trim()) {
      toast.error('Informe uma descrição');
      return;
    }

    if (!dataVencimento) {
      toast.error('Informe a data de vencimento');
      return;
    }

    if (!fornecedorNome.trim()) {
      toast.error('Selecione ou informe o fornecedor');
      return;
    }

    // Validações adicionais para abastecimento
    if (isCombustivel) {
      if (!litros || parseFloat(litros.replace(',', '.')) <= 0) {
        toast.error('Informe a quantidade de litros');
        return;
      }
      if (!valorUnitario || parseFloat(valorUnitario.replace(',', '.')) <= 0) {
        toast.error('Informe o valor unitário por litro');
        return;
      }
      if (!local.trim()) {
        toast.error('Informe o local do abastecimento');
        return;
      }
      if (!trecho.trim()) {
        toast.error('Informe o trecho');
        return;
      }
    }

    try {
      setSubmitting(true);

      let boletoUrl = null;
      let notaFiscalUrl = null;
      let comandaUrl = null;

      // Upload files if provided
      if (boletoFile) {
        boletoUrl = await uploadFile(boletoFile, 'boletos');
      }
      if (notaFiscalFile) {
        notaFiscalUrl = await uploadFile(notaFiscalFile, 'notas-fiscais');
      }
      if (comandaFile) {
        comandaUrl = await uploadFile(comandaFile, 'comandas');
      }

      const valorNum = parseFloat(valor.replace(',', '.'));
      const categoria = categories.find(c => c.id === categoriaId);

      // Inserir na tabela de despesas
      const { data: despesaData, error: despesaError } = await (supabase as any)
        .from('despesas_cliente_direto')
        .insert({
          client_id: clientId,
          client_name: clientName,
          aeronave_id: aircraftId || null,
          aeronave_registro: aircraftRegistration || null,
          categoria_id: categoriaId,
          categoria_nome: categoria?.nome || 'Despesa',
          descricao: descricao,
          valor: valorNum,
          data_vencimento: dataVencimento,
          fornecedor_nome: fornecedorNome,
          fornecedor_cnpj: fornecedorCnpj || null,
          status: 'pendente_envio',
          boleto_url: boletoUrl,
          nota_fiscal_url: notaFiscalUrl,
          criado_por: user?.id || null
        } as any)
        .select('id')
        .single();

      if (despesaError) throw despesaError;

      // Se for combustível, inserir também na tabela de abastecimentos
      if (isCombustivel) {
        const litrosNum = parseFloat(litros.replace(',', '.'));
        const valorUnitarioNum = parseFloat(valorUnitario.replace(',', '.'));

        const { error: abastecimentoError } = await supabase
          .from('abastecimentos')
          .insert({
            aeronave_id: aircraftId,
            client_id: clientId,
            data: dataAbastecimento || dataVencimento,
            litros: litrosNum,
            valor_unitario: valorUnitarioNum,
            valor_total: valorNum,
            local: local,
            trecho: trecho,
            abastecedor: abastecedor || fornecedorNome,
            comanda: comanda || null,
            comanda_url: comandaUrl,
            boleto_url: boletoUrl,
            nota_url: notaFiscalUrl,
            observacao: observacao || descricao,
            status_pagamento: 'pendente',
            data_vencimento_boleto: dataVencimento,
            partner_name: `[${clientName}]`
          });

        if (abastecimentoError) {
          console.error('Erro ao inserir abastecimento:', abastecimentoError);
          toast.warning('Despesa criada, mas houve um erro ao registrar o abastecimento');
        }
      }

      toast.success(isCombustivel ? 'Abastecimento cadastrado com sucesso!' : 'Despesa cadastrada com sucesso!');
      
      // Reset form
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao cadastrar despesa:', error);
      toast.error('Erro ao cadastrar despesa');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCategoriaId("");
    setDescricao("");
    setValor("");
    setDataVencimento(new Date().toISOString().split('T')[0]);
    setFornecedorId("");
    setFornecedorNome("");
    setFornecedorCnpj("");
    setFornecedorSearchValue("");
    setBoletoFile(null);
    setNotaFiscalFile(null);
    // Reset campos de abastecimento
    setLitros("");
    setValorUnitario("");
    setLocal("");
    setTrecho("");
    setDataAbastecimento(new Date().toISOString().split('T')[0]);
    setAbastecedor("");
    setComanda("");
    setObservacao("");
    setComandaFile(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Group categories by grupo_categoria
  const groupedCategories = categories.reduce((acc, cat) => {
    const group = cat.grupo_categoria || 'Outras';
    if (!acc[group]) acc[group] = [];
    acc[group].push(cat);
    return acc;
  }, {} as Record<string, CategoriaMovimentacao[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCombustivel ? <Fuel className="h-5 w-5 text-amber-500" /> : <Tag className="h-5 w-5" />}
            {isCombustivel ? 'Novo Abastecimento' : 'Nova Despesa'}
          </DialogTitle>
          <DialogDescription>
            {isCombustivel 
              ? `Registre um novo abastecimento para ${aircraftRegistration}`
              : `Cadastre uma nova despesa para ${clientName}`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Categoria e campos básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {Object.entries(groupedCategories).map(([group, cats]) => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        {group}
                      </div>
                      {cats.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            {cat.nome.toUpperCase().includes('COMBUSTÍVEL') ? (
                              <Fuel className="h-3 w-3 text-amber-500" />
                            ) : (
                              <Tag className="h-3 w-3" />
                            )}
                            {cat.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isCombustivel && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor (R$) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="valor"
                      type="text"
                      placeholder="0,00"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataVencimento">Data Vencimento *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dataVencimento"
                      type="date"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Campos específicos de abastecimento */}
          {isCombustivel && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <Fuel className="h-4 w-4" />
                  <span className="text-sm font-medium">Dados do Abastecimento</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="litros">Litros *</Label>
                    <div className="relative">
                      <Fuel className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="litros"
                        type="text"
                        placeholder="0,00"
                        value={litros}
                        onChange={(e) => setLitros(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valorUnitario">Valor/Litro (R$) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="valorUnitario"
                        type="text"
                        placeholder="0,00"
                        value={valorUnitario}
                        onChange={(e) => setValorUnitario(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valorTotal">Valor Total (R$)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="valorTotal"
                        type="text"
                        placeholder="0,00"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        className="pl-10 bg-muted/50"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dataAbastecimento">Data Abastecimento *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="dataAbastecimento"
                        type="date"
                        value={dataAbastecimento}
                        onChange={(e) => setDataAbastecimento(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="local">Local *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="local"
                        type="text"
                        placeholder="SBGR, SBSP..."
                        value={local}
                        onChange={(e) => setLocal(e.target.value.toUpperCase())}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trecho">Trecho *</Label>
                    <div className="relative">
                      <Plane className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="trecho"
                        type="text"
                        placeholder="SBGR-SBSP"
                        value={trecho}
                        onChange={(e) => setTrecho(e.target.value.toUpperCase())}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="abastecedor">Abastecedor</Label>
                    <Input
                      id="abastecedor"
                      type="text"
                      placeholder="Nome do abastecedor"
                      value={abastecedor}
                      onChange={(e) => setAbastecedor(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comanda">Nº Comanda</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="comanda"
                        type="text"
                        placeholder="Número da comanda"
                        value={comanda}
                        onChange={(e) => setComanda(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacao">Observações</Label>
                  <Textarea
                    id="observacao"
                    placeholder="Observações adicionais..."
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataVencimentoAbast">Data Venc. Boleto *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="dataVencimentoAbast"
                        type="date"
                        value={dataVencimento}
                        onChange={(e) => setDataVencimento(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Comanda (arquivo)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setComandaFile(e.target.files?.[0] || null)}
                        className="flex-1"
                      />
                      {comandaFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setComandaFile(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {comandaFile && (
                      <p className="text-xs text-muted-foreground">{comandaFile.name}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Combobox para Fornecedor */}
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Popover open={openCombobox} onOpenChange={(open) => {
              setOpenCombobox(open);
              if (!open) setFornecedorSearchValue("");
            }}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2 flex-1 text-left">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">
                      {fornecedorNome || "Selecione um fornecedor..."}
                    </span>
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Buscar fornecedor..."
                    className="h-8"
                    value={fornecedorSearchValue}
                    onChange={(e) => setFornecedorSearchValue(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {fornecedoresFavoritos.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum fornecedor encontrado
                    </div>
                  ) : (
                    fornecedoresFavoritos
                      .filter(f =>
                        fornecedorSearchValue === "" ||
                        f.nome_completo.toLowerCase().includes(fornecedorSearchValue.toLowerCase())
                      )
                      .map((fornecedor) => (
                        <button
                          key={fornecedor.id}
                          className={cn(
                            "w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2",
                            fornecedorId === fornecedor.id && "bg-muted"
                          )}
                          onClick={() => handleSelectFornecedor(fornecedor)}
                          type="button"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              fornecedorId === fornecedor.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{fornecedor.nome_completo}</p>
                            {fornecedor.apelido && (
                              <p className="text-xs text-muted-foreground">{fornecedor.apelido}</p>
                            )}
                          </div>
                        </button>
                      ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fornecedorCnpj">CNPJ do Fornecedor</Label>
            <Input
              id="fornecedorCnpj"
              placeholder="00.000.000/0000-00"
              value={fornecedorCnpj}
              onChange={(e) => setFornecedorCnpj(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              placeholder={isCombustivel ? "Descrição do abastecimento..." : "Descrição detalhada da despesa..."}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Boleto (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setBoletoFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {boletoFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setBoletoFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {boletoFile && (
                <p className="text-xs text-muted-foreground">{boletoFile.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nota Fiscal (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setNotaFiscalFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {notaFiscalFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setNotaFiscalFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {notaFiscalFile && (
                <p className="text-xs text-muted-foreground">{notaFiscalFile.name}</p>
              )}
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Salvando...' : (isCombustivel ? 'Registrar Abastecimento' : 'Cadastrar Despesa')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
