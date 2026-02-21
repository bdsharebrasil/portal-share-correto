import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Cliente {
  id: string;
  company_name: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  uf: string | null;
  status: string | null;
}

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    company_name: "",
    cnpj: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    uf: "",
    status: "ativo"
  });

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('company_name');

      if (error) {
        console.error('Erro ao buscar clientes:', error);
        throw error;
      }
      setClientes(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao carregar clientes';
      console.error('Erro ao buscar clientes:', errorMessage);
      toast({
        title: "Erro",
        description: `Erro ao carregar clientes: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingCliente) {
        const { error } = await supabase
          .from('clients')
          .update(formData)
          .eq('id', editingCliente.id);
        
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cliente atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([formData]);
        
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cliente criado com sucesso" });
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchClientes();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar cliente",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      company_name: cliente.company_name || "",
      cnpj: cliente.cnpj || "",
      email: cliente.email || "",
      phone: cliente.phone || "",
      address: cliente.address || "",
      city: cliente.city || "",
      uf: cliente.uf || "",
      status: cliente.status || "ativo"
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Sucesso", description: "Cliente excluído com sucesso" });
      fetchClientes();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir cliente",
        variant: "destructive"
      });
    }
  };

  const handleAdd = () => {
    setEditingCliente(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      company_name: "",
      cnpj: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      uf: "",
      status: "ativo"
    });
  };

  const filteredClientes = clientes.filter(cliente => {
    const matchesSearch = 
      (cliente.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (cliente.cnpj?.includes(searchTerm) || false);
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Clientes</h1>
          <p className="text-gray-400 mt-1">Gestão de clientes e relacionamentos</p>
        </div>
        <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Busca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nome, email ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">Empresa</TableHead>
                <TableHead className="text-gray-300">CNPJ</TableHead>
                <TableHead className="text-gray-300">E-mail</TableHead>
                <TableHead className="text-gray-300">Telefone</TableHead>
                <TableHead className="text-gray-300">Cidade/UF</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredClientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredClientes.map((cliente) => (
                  <TableRow key={cliente.id} className="border-gray-700">
                    <TableCell className="text-white font-medium">{cliente.company_name || "-"}</TableCell>
                    <TableCell className="text-gray-300">{cliente.cnpj || "-"}</TableCell>
                    <TableCell className="text-gray-300">{cliente.email || "-"}</TableCell>
                    <TableCell className="text-gray-300">{cliente.phone || "-"}</TableCell>
                    <TableCell className="text-gray-300">
                      {cliente.city && cliente.uf ? `${cliente.city}/${cliente.uf}` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cliente.status === "ativo" ? "default" : "destructive"}>
                        {cliente.status?.toUpperCase() || "ATIVO"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-blue-400 hover:text-blue-300"
                          onClick={() => handleEdit(cliente)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDelete(cliente.id)}
                        >
                          <Trash className="w-4 h-4" />
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCliente ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company_name" className="text-gray-300">Nome da Empresa</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <Label htmlFor="cnpj" className="text-gray-300">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="CNPJ"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-gray-300">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="E-mail"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-gray-300">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Telefone"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="address" className="text-gray-300">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Endereço"
              />
            </div>
            <div>
              <Label htmlFor="city" className="text-gray-300">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Cidade"
              />
            </div>
            <div>
              <Label htmlFor="uf" className="text-gray-300">UF</Label>
              <Input
                id="uf"
                value={formData.uf}
                onChange={(e) => setFormData({...formData, uf: e.target.value})}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="UF"
                maxLength={2}
              />
            </div>
            <div>
              <Label htmlFor="status" className="text-gray-300">Status</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
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
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
              {editingCliente ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
