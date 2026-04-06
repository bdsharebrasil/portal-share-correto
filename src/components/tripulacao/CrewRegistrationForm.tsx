import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Edit2, Trash2, Plus } from "lucide-react";

interface CrewPerson {
  id: string;
  canac: string;
  nome_completo: string;
  data_nascimento?: string;
  telefone?: string;
  url_avatar?: string;
  situacao: string;
  rg?: string;
  cpf?: string;
  endereco?: string;
  criado_em: string;
  // Backward compatibility
  full_name?: string;
  birth_date?: string;
  phone?: string;
  avatar_url?: string;
  status?: string;
  address?: string;
  created_at?: string;
}

interface FormData {
  canac: string;
  nome_completo: string;
  data_nascimento: string;
  telefone: string;
  rg: string;
  cpf: string;
  endereco: string;
  situacao: string;
  // Backward compatibility
  full_name?: string;
  birth_date?: string;
  phone?: string;
  address?: string;
  status?: string;
}

const INITIAL_FORM_STATE: FormData = {
  canac: "",
  nome_completo: "",
  data_nascimento: "",
  telefone: "",
  rg: "",
  cpf: "",
  endereco: "",
  situacao: "ativo",
};

export function CrewRegistrationForm() {
  const [crewList, setCrewList] = useState<CrewPerson[]>([]);
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
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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

      if (editingId) {
        // Update existing crew
        const { error } = await supabase
          .from("tripulacao")
          .update(formData)
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Tripulante atualizado com sucesso",
        });
      } else {
        // Insert new crew
        const { error } = await supabase
          .from("tripulacao")
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Tripulante cadastrado com sucesso",
        });
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

  const handleEdit = (crew: CrewPerson) => {
    setFormData({
      canac: crew.canac,
      nome_completo: crew.nome_completo,
      data_nascimento: crew.data_nascimento || "",
      telefone: crew.telefone || "",
      rg: crew.rg || "",
      cpf: crew.cpf || "",
      endereco: crew.endereco || "",
      situacao: crew.situacao,
    });
    setEditingId(crew.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este tripulante?")) {
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from("tripulacao")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Tripulante removido com sucesso",
      });

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
      crew.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crew.canac.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cadastro de Tripulantes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre tripulantes que não são membros da Share Brasil
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
          Novo Tripulante
        </Button>
      </div>

      {/* Search Section */}
      <div>
        <Input
          placeholder="Buscar por nome ou CANAC..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Table Section */}
      <Card>
        <CardContent className="p-0">
          {filteredCrew.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? "Nenhum tripulante encontrado" : "Nenhum tripulante cadastrado"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
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
                    <TableCell className="font-medium">{crew.full_name}</TableCell>
                    <TableCell>{crew.canac}</TableCell>
                    <TableCell>{crew.cpf || "-"}</TableCell>
                    <TableCell>{crew.telefone || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={crew.situacao === "ativo" ? "default" : "secondary"}
                      >
                        {crew.situacao === "ativo" ? "Ativo" : "Inativo"}
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
              {editingId ? "Editar Tripulante" : "Novo Tripulante"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange("full_name", e.target.value)}
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
                <Label htmlFor="birth_date">Data de Nascimento</Label>
                <Input
                  id="birth_date"
                  type="data"
                  value={formData.birth_date}
                  onChange={(e) => handleInputChange("birth_date", e.target.value)}
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
              <Label htmlFor="situacao">Status</Label>
              <Select
                value={formData.situacao}
                onValueChange={(value) => handleInputChange("situacao", value)}
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

            {/* Submit Buttons */}
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
