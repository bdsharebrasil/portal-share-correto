import React, { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Edit2, Trash2, Filter, Plus, X, DollarSign, Eye } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useClientesComSocios } from "../hooks/useSocioBalanco";
import { useClientPartners, type ClientPartner } from "../hooks/useClientPartners";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Helper functions
function formatCPF(cpf: string) {
  const cleaned = cpf.replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  } catch {
    return "N/A";
  }
}

// Main Component
export default function RelatorioTransacoesSocios() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();
  
  // State
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<ClientPartner | null>(null);
  const [editTarget, setEditTarget] = useState<ClientPartner | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    cpf: "",
    share_percentage: "",
  });

  // Data hooks
  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios();
  const { data: partners = [], isLoading: loadingPartners, refetch: refetchPartners } = useClientPartners(clienteId || null);

  const selectedClientData = useMemo(
    () => clientesComSocios.find((c) => c.id === clienteId),
    [clientesComSocios, clienteId]
  );

  // Filter partners by search term
  const filteredPartners = useMemo(() => {
    if (!searchTerm) return partners;
    const term = searchTerm.toLowerCase();
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.cpf.replace(/\D/g, "").includes(term.replace(/\D/g, ""))
    );
  }, [partners, searchTerm]);

  // Calculate summary stats
  const partnerStats = useMemo(() => {
    const totalPartners = partners.length;
    const totalSharePercentage = partners.reduce(
      (sum, p) => sum + (p.share_percentage || 0),
      0
    );
    const averageSharePercentage = totalPartners > 0 ? totalSharePercentage / totalPartners : 0;

    return {
      totalPartners,
      totalSharePercentage,
      averageSharePercentage,
    };
  }, [partners]);

  // Edit handlers
  const openEdit = (partner: ClientPartner) => {
    setEditTarget(partner);
    setEditForm({
      name: partner.name,
      cpf: partner.cpf,
      share_percentage: partner.share_percentage?.toString() || "",
    });
  };

  const handleEditSave = async () => {
    if (!editTarget || !clienteId) return;

    if (!editForm.name.trim() || !editForm.cpf.trim()) {
      toast.error("Nome e CPF são obrigatórios");
      return;
    }

    try {
      const { error } = await supabase
        .from("client_partners")
        .update({
          name: editForm.name.trim(),
          cpf: editForm.cpf.replace(/\D/g, ""),
          share_percentage: editForm.share_percentage
            ? parseFloat(editForm.share_percentage)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editTarget.id)
        .eq("client_id", clienteId);

      if (error) throw error;

      toast.success("Sócio atualizado com sucesso!");
      setEditTarget(null);
      refetchPartners();
    } catch (err) {
      console.error("[handleEditSave] Erro:", err);
      toast.error("Erro ao atualizar sócio");
    }
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !clienteId) return;

    try {
      const { error } = await supabase
        .from("client_partners")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("client_id", clienteId);

      if (error) throw error;

      toast.success("Sócio removido com sucesso!");
      setDeleteTarget(null);
      refetchPartners();
    } catch (err) {
      console.error("[handleDeleteConfirm] Erro:", err);
      toast.error("Erro ao remover sócio");
    }
  };

  // Loading state
  if (loadingClientes) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin">
            <Users className="h-8 w-8 text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  // Not found state
  if (!selectedClientData) {
    return (
      <Layout>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-12 pb-12 text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">Cliente não encontrado</h3>
            <Button onClick={() => navigate("/socios")} className="mt-4">
              ← Voltar
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sócios e Parceiros</h1>
              <p className="text-sm text-muted-foreground">
                {selectedClientData?.company_name || selectedClientData?.proprietario} •{" "}
                {selectedClientData?.cnpj}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/socios")}
              size="sm"
            >
              ← Voltar
            </Button>
            <Button
              onClick={() =>
                navigate(`/agenda/clientes?edit=${clienteId}`, { state: { scrollToPartners: true } })
              }
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Gerenciar Sócios
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    Total de Sócios
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {partnerStats.totalPartners}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Percentual Total
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {partnerStats.totalSharePercentage.toFixed(2)}%
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                    Média por Sócio
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {partnerStats.averageSharePercentage.toFixed(2)}%
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Buscar Sócios</h3>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="search" className="text-sm font-medium">
                  Nome ou CPF
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="search"
                    type="text"
                    placeholder="Digite o nome ou CPF do sócio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searchTerm && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setSearchTerm("")}
                      title="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {searchTerm && (
                <div className="text-xs text-muted-foreground">
                  Mostrando {filteredPartners.length} de {partners.length} sócios
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Partners Table */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">
              Sócios e Parceiros
              <span className="text-muted-foreground font-normal ml-2 text-sm">
                ({filteredPartners.length} de {partners.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPartners ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            ) : filteredPartners.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  {searchTerm ? "Nenhum sócio encontrado" : "Nenhum sócio cadastrado"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {!searchTerm && (
                    <>
                      Clique em "Gerenciar Sócios" para adicionar sócios a este cliente.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        CPF
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                        Percentual de Participação
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Data de Criação
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Última Atualização
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartners.map((partner, index) => (
                      <tr
                        key={partner.id}
                        className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${
                          index % 2 === 0 ? "bg-muted/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {partner.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                          {formatCPF(partner.cpf)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {partner.share_percentage !== null ? (
                            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                              {partner.share_percentage.toFixed(2)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(partner.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(partner.updated_at)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-1.5 rounded hover:bg-primary/20 transition-colors text-primary"
                              title="Editar"
                              onClick={() => openEdit(partner)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-destructive/20 transition-colors text-destructive"
                              title="Excluir"
                              onClick={() => setDeleteTarget(partner)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              Editar Sócio
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
                className="mt-1"
                placeholder="Nome completo"
              />
            </div>

            <div>
              <Label htmlFor="edit-cpf">CPF</Label>
              <Input
                id="edit-cpf"
                value={editForm.cpf}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, cpf: e.target.value }))
                }
                className="mt-1"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <Label htmlFor="edit-share">
                Percentual de Participação (%)
              </Label>
              <Input
                id="edit-share"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={editForm.share_percentage}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    share_percentage: e.target.value,
                  }))
                }
                className="mt-1"
                placeholder="Ex: 50.00"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
            >
              Cancelar
            </Button>
            <Button onClick={handleEditSave}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Sócio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              da lista de sócios?
              <br />
              <span className="text-destructive text-xs mt-2 block">
                Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
