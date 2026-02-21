import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Plus, Edit, Trash } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Funcionario {
  id: string;
  full_name: string;
  phone?: string | null;
  position?: string | null;
  cpf?: string | null;
  salary?: number | null;
  admission_date?: string | null;
  email?: string | null;
  employment_status?: string | null;
}

export function CentroCustos() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [editingFuncionario, setEditingFuncionario] = useState<Funcionario | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    position: "",
    cpf: "",
    salary: 0,
    admission_date: "",
    email: "",
    employment_status: "ativo"
  });

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  const fetchFuncionarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('tipo', 'colaborador')
        .order('full_name');

      if (error) {
        console.error('Erro ao buscar funcionários:', error);
        throw error;
      }
      setFuncionarios(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao carregar funcionários';
      console.error('Erro ao buscar funcionários:', errorMessage);
      toast({
        title: "Erro",
        description: `Erro ao carregar funcionários: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string | null | undefined) => {
    return status === "ativo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  };

  const handleEdit = (funcionario: Funcionario) => {
    setEditingFuncionario(funcionario);
    setFormData({
      full_name: funcionario.full_name || "",
      phone: funcionario.phone || "",
      position: funcionario.position || "",
      cpf: funcionario.cpf || "",
      salary: funcionario.salary || 0,
      admission_date: funcionario.admission_date || "",
      email: funcionario.email || "",
      employment_status: funcionario.employment_status || "ativo"
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingFuncionario(null);
    setFormData({
      full_name: "",
      phone: "",
      position: "",
      cpf: "",
      salary: 0,
      admission_date: "",
      email: "",
      employment_status: "ativo"
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingFuncionario) {
        const { error } = await supabase
          .from('user_profiles')
          .update(formData)
          .eq('id', editingFuncionario.id);
        
        if (error) throw error;
        toast({ title: "Sucesso", description: "Funcionário atualizado com sucesso" });
      } else {
        toast({ 
          title: "Info", 
          description: "Para adicionar novos funcionários, use o cadastro de usuários" 
        });
        setIsDialogOpen(false);
        return;
      }
      
      setIsDialogOpen(false);
      fetchFuncionarios();
    } catch (error) {
      console.error('Erro ao salvar funcionário:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar funcionário",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    toast({
      title: "Info",
      description: "Exclusão de funcionários não permitida por aqui",
      variant: "destructive"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Cadastro de Funcionários</h1>
          <p className="text-gray-400 mt-1">Informações completas dos funcionários da Share Brasil</p>
        </div>
      </div>

      {/* Tabela de Funcionários */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Lista de Funcionários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">Nome</TableHead>
                <TableHead className="text-gray-300">CPF</TableHead>
                <TableHead className="text-gray-300">Cargo</TableHead>
                <TableHead className="text-gray-300">Telefone</TableHead>
                <TableHead className="text-gray-300">Salário</TableHead>
                <TableHead className="text-gray-300">Data Admissão</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : funcionarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400">
                    Nenhum funcionário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                funcionarios.map((funcionario) => (
                  <TableRow key={funcionario.id} className="border-gray-700">
                    <TableCell className="font-medium text-white">{funcionario.full_name}</TableCell>
                    <TableCell className="text-gray-300">{funcionario.cpf || "-"}</TableCell>
                    <TableCell className="text-gray-300">{funcionario.position || "-"}</TableCell>
                    <TableCell className="text-gray-300">{funcionario.phone || "-"}</TableCell>
                    <TableCell className="font-medium text-white">
                      {funcionario.salary 
                        ? `R$ ${funcionario.salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {funcionario.admission_date 
                        ? new Date(funcionario.admission_date).toLocaleDateString('pt-BR')
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getStatusColor(funcionario.employment_status)}`}>
                        {funcionario.employment_status?.toUpperCase() || "ATIVO"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(funcionario)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para Editar Funcionário */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingFuncionario ? "Editar Funcionário" : "Adicionar Novo Funcionário"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name" className="text-gray-300">Nome Completo</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="Nome completo do funcionário"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="cpf" className="text-gray-300">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                placeholder="CPF do funcionário"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="position" className="text-gray-300">Cargo</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({...formData, position: e.target.value})}
                placeholder="Cargo do funcionário"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-gray-300">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="Telefone de contato"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-gray-300">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="E-mail"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="salary" className="text-gray-300">Salário</Label>
              <Input
                id="salary"
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({...formData, salary: Number(e.target.value)})}
                placeholder="Salário"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="admission_date" className="text-gray-300">Data de Admissão</Label>
              <Input
                id="admission_date"
                type="date"
                value={formData.admission_date}
                onChange={(e) => setFormData({...formData, admission_date: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="employment_status" className="text-gray-300">Status</Label>
              <select
                id="employment_status"
                value={formData.employment_status}
                onChange={(e) => setFormData({...formData, employment_status: e.target.value})}
                className="w-full h-10 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {editingFuncionario ? "Salvar Alterações" : "Adicionar Funcionário"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumo de Funcionários */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Resumo de Funcionários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-700/50 rounded-lg">
              <p className="text-2xl font-bold text-white">{funcionarios.length}</p>
              <p className="text-sm text-gray-400">Total de Funcionários</p>
            </div>
            <div className="text-center p-4 bg-green-900/30 rounded-lg">
              <p className="text-2xl font-bold text-green-400">
                {funcionarios.filter(f => f.employment_status === "ativo").length}
              </p>
              <p className="text-sm text-gray-400">Ativos</p>
            </div>
            <div className="text-center p-4 bg-red-900/30 rounded-lg">
              <p className="text-2xl font-bold text-red-400">
                {funcionarios.filter(f => f.employment_status === "inativo").length}
              </p>
              <p className="text-sm text-gray-400">Inativos</p>
            </div>
            <div className="text-center p-4 bg-blue-900/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-400">
                R$ {funcionarios.reduce((acc, f) => acc + (f.salary || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-400">Folha Total</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
