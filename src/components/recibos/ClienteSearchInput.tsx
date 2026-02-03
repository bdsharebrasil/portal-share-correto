import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, Check, Info, Edit } from "lucide-react";

interface ClienteData {
  id: string;
  company_name: string;
  cnpj?: string;
  address?: string;
  city?: string;
  uf?: string;
}

interface ClienteSearchInputProps {
  value: {
    clienteId: string;
    nome: string;
    documento: string;
    endereco: string;
    cidade: string;
    uf: string;
    useFromDatabase: boolean;
  };
  onChange: (data: ClienteSearchInputProps["value"]) => void;
  required?: boolean;
  disabled?: boolean;
}

export function ClienteSearchInput({
  value,
  onChange,
  required = false,
  disabled = false,
}: ClienteSearchInputProps) {
  const [clientesAtivos, setClientesAtivos] = useState<ClienteData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredClientes, setFilteredClientes] = useState<ClienteData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingClientes, setIsLoadingClientes] = useState(false);

  // Carrega clientes ativos
  useEffect(() => {
    const loadClientes = async () => {
      setIsLoadingClientes(true);
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("status", "ativo")
          .order("company_name");

        if (error) throw error;
        setClientesAtivos(data || []);
      } catch (err) {
        console.error("Erro ao carregar clientes:", err);
      } finally {
        setIsLoadingClientes(false);
      }
    };

    loadClientes();
  }, []);

  // Filtra clientes conforme o usuário digita
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredClientes([]);
      setShowSuggestions(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = clientesAtivos.filter(
      (c) =>
        c.company_name.toLowerCase().includes(query) ||
        c.cnpj?.includes(query.replace(/\D/g, ""))
    );

    setFilteredClientes(filtered);
    setShowSuggestions(true);
  }, [searchQuery, clientesAtivos]);

  const handleSelectCliente = (cliente: ClienteData) => {
    onChange({
      clienteId: cliente.id,
      nome: cliente.company_name || "",
      documento: cliente.cnpj || "",
      endereco: cliente.address || "",
      cidade: cliente.city || "",
      uf: cliente.uf || "",
      useFromDatabase: true,
    });
    setSearchQuery("");
    setShowSuggestions(false);
  };

  const handleManualChange = (field: string, val: string) => {
    onChange({
      ...value,
      [field]: val,
      clienteId: "", // Limpa o ID quando entramos em modo manual
      useFromDatabase: false,
    });
  };

  const handleClear = () => {
    onChange({
      clienteId: "",
      nome: "",
      documento: "",
      endereco: "",
      cidade: "",
      uf: "",
      useFromDatabase: false,
    });
    setSearchQuery("");
  };

  const isClienteSelected = value.clienteId || (value.nome && !value.useFromDatabase);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search" className="rounded-[10px] overflow-hidden mx-12 border border-blue-600/90">
            <Search className="h-4 w-4 mr-2" />
            Buscar Cliente
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-[9px] overflow-hidden mx-12 gap-1 border border-blue-600/90">
            <Edit className="h-4 w-4 mr-2" />
            Entrada Manual
          </TabsTrigger>
        </TabsList>

        {/* TAB: BUSCAR CLIENTE */}
        <TabsContent value="search" className="space-y-3 mt-4">
          <div>
            <Label>Buscar Cliente Cadastrado</Label>
            <div className="relative">
              <Input
                placeholder="Digite o nome ou CNPJ do cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={disabled}
                className="w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Sugestões de clientes */}
          {showSuggestions && (
            <div className="border border-border rounded-lg p-3 bg-muted/30 max-h-60 overflow-y-auto space-y-2">
              {isLoadingClientes && (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              )}

              {!isLoadingClientes && filteredClientes.length > 0 ? (
                filteredClientes.map((cliente) => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => handleSelectCliente(cliente)}
                    className="w-full text-left p-3 border border-border rounded hover:bg-accent transition-colors"
                  >
                    <div className="font-medium text-sm">{cliente.company_name}</div>
                    {cliente.cnpj && (
                      <div className="text-xs text-muted-foreground">
                        CNPJ: {cliente.cnpj}
                      </div>
                    )}
                    {(cliente.city || cliente.uf) && (
                      <div className="text-xs text-muted-foreground">
                        {cliente.city}
                        {cliente.city && cliente.uf ? ", " : ""}
                        {cliente.uf}
                      </div>
                    )}
                  </button>
                ))
              ) : !isLoadingClientes ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum cliente encontrado
                </p>
              ) : null}
            </div>
          )}

          {/* Cliente selecionado */}
          {isClienteSelected && (
            <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm">{value.nome}</span>
                  </div>
                  {value.documento && (
                    <div className="text-xs text-muted-foreground">
                      Documento: {value.documento}
                    </div>
                  )}
                  {value.cidade && (
                    <div className="text-xs text-muted-foreground">
                      {value.cidade}
                      {value.cidade && value.uf ? ", " : ""}
                      {value.uf}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-xs"
                >
                  Alterar
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB: ENTRADA MANUAL */}
        <TabsContent value="manual" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome da Empresa *</Label>
              <Input
                value={value.nome}
                onChange={(e) => handleManualChange("nome", e.target.value)}
                placeholder="Razão social ou nome da empresa"
                disabled={disabled}
                required={required}
              />
            </div>

            <div>
              <Label>CNPJ/CPF</Label>
              <Input
                value={value.documento}
                onChange={(e) => handleManualChange("documento", e.target.value)}
                placeholder="00.000.000/0000-00"
                disabled={disabled}
              />
            </div>
          </div>

          <div>
            <Label>Endereço</Label>
            <Input
              value={value.endereco}
              onChange={(e) => handleManualChange("endereco", e.target.value)}
              placeholder="Rua, número, complemento"
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Cidade</Label>
              <Input
                value={value.cidade}
                onChange={(e) => handleManualChange("cidade", e.target.value)}
                placeholder="São Paulo"
                disabled={disabled}
              />
            </div>

            <div>
              <Label>UF</Label>
              <Input
                value={value.uf}
                onChange={(e) =>
                  handleManualChange("uf", e.target.value.toUpperCase().slice(0, 2))
                }
                placeholder="SP"
                disabled={disabled}
                maxLength={2}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Info className="h-4 w-4 text-amber-600" />
            <p className="text-xs text-amber-800">
              Os dados preenchidos aqui serão usados apenas para este recibo e não
              serão salvos como novo cliente.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
