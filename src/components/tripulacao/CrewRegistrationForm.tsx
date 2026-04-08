import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Edit2, Trash2, Plus } from "lucide-react";

interface FreelanceCrew {
  id: string;
  canac: string;
  nome_completo: string;
  data_nascimento?: string;
  telefone?: string;
  url_avatar?: string;
  rg?: string;
  cpf?: string;
  endereco?: string;
  status: string;
  criado_em: string;
}

interface FormData {
  canac: string;
  nome_completo: string;
  data_nascimento: string;
  telefone: string;
  rg: string;
  cpf: string;
  endereco: string;
  status: string;
}

const INITIAL_FORM_STATE: FormData = {
  canac: "",
  nome_completo: "",
  data_nascimento: "",
  telefone: "",
  rg: "",
  cpf: "",
  endereco: "",
  status: "ativo",
};

export function CrewRegistrationForm() {
  const [crewList, setCrewList] = useState<FreelanceCrew[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_STATE);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadCrew();
  }, []);

  const loadCrew = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("tripulacao")
        .select("*")
        .order("nome_completo", { ascending: true });

      if (error) {
        toast({
          title: "Erro",
          description: "Falha ao carregar tripulantes",
          variant: "destructive",
        });
        return;
      }

      setCrewList(data || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.canac || !formData.nome_completo) {
      toast({
        title: "Validação",
        description: "CANAC e Nome são campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const payload = {
        canac: formData.canac,
        nome_completo: formData.nome_completo,
        data_nascimento: formData.data_nascimento || null,
        telefone: formData.telefone || null,
        rg: formData.rg || null,
        cpf: formData.cpf || null,
        endereco: formData.endereco || null,
        status: formData.status,
      };

      if (editingId) {
        const { error } = await supabase
          .from("tripulacao")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;

        toast({ title: "Sucesso", description: "Tripulante atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from("tripulacao")
          .insert([payload]);

        if (error) throw error;

        toast({ title: "Sucesso", description: "Tripulante cadastrado com sucesso" });
      }

      setIsDialogOpen(false);
      resetForm();
      await loadCrew();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (crew: FreelanceCrew) => {
    setFormData({
      canac: crew.canac,
      nome_completo: crew.nome_completo,
      data_nascimento: crew.data_nascimento || "",
      telefone: crew.telefone || "",
      rg: crew.rg || "",
      cpf: crew.cpf || "",
      endereco: crew.endereco || "",
      status: crew.status,
    });
    setEditingId(crew.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este tripulante?")) return;

    try {
      setIsLoading(true);
      const { error } = await supabase.from("tripulacao").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Tripulante removido com sucesso" });
      await loadCrew();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCrew = crewList.filter(
    (crew) =>
      crew.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crew.canac.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tripulantes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tripulantes externos sem vínculo com a Share Brasil
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo tripulante
        </Button>
      </div>

      {/* Search */}
      <div>
        <Input
          placeholder="Buscar por nome ou CANAC..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Aviso informativo */}
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-400">
        ℹ️ Esta lista contém apenas tripulantes <strong>sem vínculo empregatício</strong>.
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {filteredCrew.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? "Nenhum tripulante encontrado" : "Nenhum tripulante cadastrado"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-55">
                  <TableHead>Nome</TableHead>
                  <TableHead>CANAC</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCrew.map((crew) => (
                  <TableRow key={crew.id}>
                    <TableCell className="font-medium">{crew.nome_completo}</TableCell>
                    <TableCell>{crew.canac}</TableCell>
                    <TableCell>{crew.cpf || "-"}</TableCell>
                    <TableCell>{crew.telefone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={crew.status === "ativo" ? "default" : "secondary"}>
                        {crew.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(crew)}
                        disabled={isLoading}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(crew.id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar" : "Novo Tripulante"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome_completo">Nome Completo *</Label>
                <Input
                  id="nome_completo"
                  value={formData.nome_completo}
                  onChange={(e) => handleInputChange("nome_completo", e.target.value)}
                  placeholder="João Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canac">CANAC *</Label>
                <Input
                  id="canac"
                  value={formData.canac}
                  onChange={(e) => handleInputChange("canac", e.target.value)}
                  placeholder="Ex: 1234567"
                />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => handleInputChange("cpf", e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rg">RG</Label>
                <Input
                  id="rg"
                  value={formData.rg}
                  onChange={(e) => handleInputChange("rg", e.target.value)}
                  placeholder="00.000.000-0"
                />
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <Input
                  id="data_nascimento"
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => handleInputChange("data_nascimento", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange("telefone", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            {/* Row 4 */}
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => handleInputChange("endereco", e.target.value)}
                placeholder="Rua, número, cidade"
              />
            </div>

            {/* Row 5 */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}