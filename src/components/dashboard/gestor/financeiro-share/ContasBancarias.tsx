import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Search } from "lucide-react";
import { useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { toast } from "sonner";
import type { Conta } from "@/hooks/useCategoriasFinanceiro";

export function ContasBancarias() {
  const { contas, addConta, updateConta, deleteConta } = useCategoriasConta();
  const [showDialog, setShowDialog] = useState(false);
  const [editingConta, setEditingConta] = useState<Conta | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    nome: "",
    numero_conta: "",
    banco: "",
    tipo_conta: "corrente" as "corrente" | "poupanca" | "investimento",
    saldo: 0
  });

  const handleOpenDialog = (conta?: Conta) => {
    if (conta) {
      setEditingConta(conta);
      setFormData({
        nome: conta.nome,
        numero_conta: conta.numero_conta || "",
        banco: conta.banco || "",
        tipo_conta: (conta.tipo_conta as "corrente" | "poupanca" | "investimento") || "corrente",
        saldo: conta.saldo || 0
      });
    } else {
      setEditingConta(null);
      setFormData({
        nome: "",
        numero_conta: "",
        banco: "",
        tipo_conta: "corrente",
        saldo: 0
      });
    }
    setShowDialog(true);
  };

  const handleSaveConta = async () => {
    if (!formData.banco.trim()) {
      toast.error("Nome do banco é obrigatório");
      return;
    }

    try {
      if (editingConta) {
        const success = await updateConta(editingConta.id, {
          nome: formData.nome,
          numero_conta: formData.numero_conta || undefined,
          banco: formData.banco || undefined,
          tipo_conta: formData.tipo_conta,
          saldo: formData.saldo
        });
        if (!success) return;
      } else {
        const success = await addConta({
          id: "",
          nome: formData.nome,
          numero_conta: formData.numero_conta || undefined,
          banco: formData.banco || undefined,
          tipo_conta: formData.tipo_conta,
          saldo: formData.saldo
        });
        if (!success) return;
      }

      setShowDialog(false);
      setFormData({
        nome: "",
        numero_conta: "",
        banco: "",
        tipo_conta: "corrente",
        saldo: 0
      });
      setEditingConta(null);
    } catch (error: any) {
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  };

  const handleDeleteConta = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta conta?")) {
      return;
    }

    try {
      const success = await deleteConta(id);
      if (!success) return;
    } catch (error: any) {
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const filteredContas = contas.filter(conta =>
    conta.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conta.numero_conta?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conta.banco?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Gerenciar Contas Bancárias</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure suas contas bancárias e operacionais
              </p>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, número da conta ou banco..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Contas List */}
          {filteredContas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma conta encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContas.map((conta) => (
                <div
                  key={conta.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground text-lg">
                      {conta.banco || conta.nome}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {conta.numero_conta && (
                        <p className="text-sm text-muted-foreground">
                          Conta: {conta.numero_conta}
                        </p>
                      )}
                      {conta.tipo_conta && (
                        <p className="text-sm text-muted-foreground">
                          Tipo: {conta.tipo_conta === "corrente" ? "Corrente" : conta.tipo_conta === "poupanca" ? "Poupança" : "Investimento"}
                        </p>
                      )}
                      {conta.saldo !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          Saldo: R$ {(conta.saldo || 0).toFixed(2).replace(".", ",")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(conta)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600 h-8 w-8 p-0"
                      onClick={() => handleDeleteConta(conta.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para adicionar/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingConta ? "Editar Conta Bancária" : "Nova Conta Bancária"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="banco">Nome do Banco *</Label>
              <Input
                id="banco"
                placeholder="Ex: Banco do Brasil, Itaú, Bradesco..."
                value={formData.banco}
                onChange={(e) => setFormData(prev => ({ ...prev, banco: e.target.value, nome: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="numero_conta">Número da Conta</Label>
              <Input
                id="numero_conta"
                placeholder="Ex: 123456-7"
                value={formData.numero_conta}
                onChange={(e) => setFormData(prev => ({ ...prev, numero_conta: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tipo_conta">Tipo de Conta</Label>
                <select
                  id="tipo_conta"
                  value={formData.tipo_conta}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipo_conta: e.target.value as "corrente" | "poupanca" | "investimento" }))}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="corrente">Corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="investimento">Investimento</option>
                </select>
              </div>

              <div>
                <Label htmlFor="saldo">Saldo Inicial</Label>
                <Input
                  id="saldo"
                  type="number"
                  placeholder="0.00"
                  value={formData.saldo}
                  onChange={(e) => setFormData(prev => ({ ...prev, saldo: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                  step="0.01"
                />
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveConta}
              className="bg-primary hover:bg-primary/90"
            >
              {editingConta ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
