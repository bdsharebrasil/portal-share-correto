import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Plane
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Layout } from '@/components/layout/Layout';

interface Component {
  id: string;
  category: string;
  type: string;
  componente: string;
  modelo: string;
  numeroSerie: string;
  horasAtuais: number;
  horasApos: number;
  limiteTBO: number;
  limiteTempoAnos?: number;
  vencimentoHoras: number;
  vencimentoData?: string;
  horasDisponiveis: number;
  executante?: string;
  observacoes?: string;
  status?: 'vencido' | 'atencao' | 'ok';
}

const CATEGORIES = [
  'Motor Esquerdo (LH)',
  'Motor Direito (RH)',
  'Componentes - Revisão Geral',
  'Equipamentos de Comunicação',
  'Inspeções Programadas',
  'Itens Especiais - Horas de Voo',
  'Itens Especiais - Calendário'
];

const STORAGE_KEY = 'share_brasil_mapa_componentes';

export default function MapaComponentesPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedAeronave, setSelectedAircraft] = useState('PR-MDL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const { toast } = useToast();

  // Carregar dados do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${selectedAeronave}`);
    if (stored) {
      try {
        setComponents(JSON.parse(stored));
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    } else {
      // Dados de exemplo para PR-MDL
      loadSampleData();
    }
  }, [selectedAeronave]);

  // Salvar no localStorage sempre que components mudar
  useEffect(() => {
    if (components.length > 0) {
      localStorage.setItem(`${STORAGE_KEY}_${selectedAeronave}`, JSON.stringify(components));
    }
  }, [components, selectedAeronave]);

  const loadSampleData = () => {
    const sampleData: Component[] = [
      {
        id: '1',
        category: 'Motor Esquerdo (LH)',
        type: 'Motor',
        componente: 'Motor Continental - LH',
        modelo: 'TSIO-360-RB2',
        numeroSerie: '1007716',
        horasAtuais: 1733.5,
        horasApos: 0,
        limiteTBO: 1800,
        limiteTempoAnos: 12,
        vencimentoHoras: 1800,
        vencimentoData: '2024-12-20',
        horasDisponiveis: 66.5,
        executante: 'J.P. Martins Aviação',
        observacoes: 'Motor novo de fábrica instalado',
        status: 'atencao'
      },
      {
        id: '2',
        category: 'Motor Esquerdo (LH)',
        type: 'Hélice',
        componente: 'Hélice McCauley - LH',
        modelo: '3AF32C522',
        numeroSerie: '020322',
        horasAtuais: 3090.3,
        horasApos: 1140,
        limiteTBO: 2000,
        limiteTempoAnos: 6,
        vencimentoHoras: 3950.3,
        vencimentoData: '2023-07-31',
        horasDisponiveis: 860,
        executante: 'Aerotécnica Vavá',
        observacoes: 'Revisão geral - WO#241958',
        status: 'ok'
      }
    ];
    setComponents(sampleData);
  };

  const calculateStatus = (component: Component): 'vencido' | 'atencao' | 'ok' => {
    const horasRestantes = component.vencimentoHoras - component.horasAtuais;
    
    if (component.vencimentoData) {
      const dataVenc = new Date(component.vencimentoData);
      const hoje = new Date();
      const diasRestantes = Math.floor((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes < 0) return 'vencido';
      if (diasRestantes < 30) return 'atencao';
    }

    if (horasRestantes < 0) return 'vencido';
    if (horasRestantes < 100) return 'atencao';
    return 'ok';
  };

  const filteredComponents = useMemo(() => {
    return components.filter(comp => {
      const matchesSearch = 
        comp.componente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.numeroSerie.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || comp.categoria === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [components, searchTerm, selectedCategory]);

  const handleSaveComponent = (formData: Component) => {
    const status = calculateStatus(formData);
    const componentWithStatus = { ...formData, status };

    if (editingComponent) {
      setComponents(prev => 
        prev.map(comp => comp.id === editingComponent.id ? componentWithStatus : comp)
      );
      toast({
        title: 'Componente atualizado',
        description: 'As informações foram salvas com sucesso.',
      });
    } else {
      setComponents(prev => [...prev, { ...componentWithStatus, id: Date.now().toString() }]);
      toast({
        title: 'Componente adicionado',
        description: 'O novo componente foi registrado.',
      });
    }

    setDialogOpen(false);
    setEditingComponent(null);
  };

  const handleDelete = (id: string) => {
    setComponents(prev => prev.filter(comp => comp.id !== id));
    toast({
      title: 'Componente removido',
      description: 'O componente foi excluído do mapa.',
    });
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(components, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mapa_componentes_${selectedAeronave}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    toast({
      title: 'Exportado com sucesso',
      description: 'O mapa de componentes foi baixado.',
    });
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'vencido':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Vencido
          </Badge>
        );
      case 'atencao':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-600">
            <Clock className="h-3 w-3" />
            Atenção
          </Badge>
        );
      default:
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            OK
          </Badge>
        );
    }
  };

  const statsCards = useMemo(() => {
    const vencidos = components.filter(c => c.situacao === 'vencido').length;
    const atencao = components.filter(c => c.situacao === 'atencao').length;
    const ok = components.filter(c => c.situacao === 'ok').length;
    
    return { vencidos, atencao, ok };
  }, [components]);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-slate-900/80 to-slate-950/80 border-cyan-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plane className="h-8 w-8 text-cyan-400" />
                <div>
                  <CardTitle className="text-2xl">Mapa de Componentes</CardTitle>
                  <CardDescription className="text-slate-400">
                    Controle de componentes aeronáuticos - Share Brasil
                  </CardDescription>
                </div>
              </div>
              <Select value={selectedAeronave} onValueChange={setSelectedAircraft}>
                <SelectTrigger className="w-48 bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PR-MDL">PR-MDL</SelectItem>
                  <SelectItem value="PR-ABC">PR-ABC</SelectItem>
                  <SelectItem value="PR-XYZ">PR-XYZ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-400">Total</p>
                  <p className="text-3xl font-bold">{components.length}</p>
                </div>
                <Plane className="h-10 w-10 text-cyan-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-900 to-red-800 border-red-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-red-200">Vencidos</p>
                  <p className="text-3xl font-bold text-white">{statsCards.vencidos}</p>
                </div>
                <AlertCircle className="h-10 w-10 text-red-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-900 to-yellow-800 border-yellow-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-yellow-200">Atenção</p>
                  <p className="text-3xl font-bold text-white">{statsCards.atencao}</p>
                </div>
                <Clock className="h-10 w-10 text-yellow-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-900 to-green-800 border-green-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-green-200">OK</p>
                  <p className="text-3xl font-bold text-white">{statsCards.ok}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Ações */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Buscar por componente, modelo ou número de série..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-64 bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <ComponentForm
                    component={editingComponent}
                    onSave={handleSaveComponent}
                    onCancel={() => {
                      setDialogOpen(false);
                      setEditingComponent(null);
                    }}
                  />
                </DialogContent>
              </Dialog>

              <Button variant="outline" onClick={handleExport} className="border-slate-700">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Componentes */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead>Status</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Componente</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>N° Série</TableHead>
                    <TableHead className="text-right">Horas Atuais</TableHead>
                    <TableHead className="text-right">Limite TBO</TableHead>
                    <TableHead className="text-right">Horas Disp.</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComponents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                        Nenhum componente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredComponents.map((component) => (
                      <TableRow key={component.id} className="border-slate-800">
                        <TableCell>{getStatusBadge(component.situacao)}</TableCell>
                        <TableCell className="text-xs text-slate-400">{component.categoria}</TableCell>
                        <TableCell className="font-medium">{component.componente}</TableCell>
                        <TableCell className="text-sm text-slate-400">{component.modelo}</TableCell>
                        <TableCell className="text-sm text-slate-400">{component.numeroSerie}</TableCell>
                        <TableCell className="text-right font-mono text-slate-300">{component.horasAtuais.toFixed(1)}h</TableCell>
                        <TableCell className="text-right font-mono text-slate-300">{component.limiteTBO.toFixed(0)}h</TableCell>
                        <TableCell className={cn(
                          "text-right font-mono font-bold",
                          component.horasDisponiveis < 100 ? "text-red-400" : "text-green-400"
                        )}>
                          {component.horasDisponiveis.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-sm text-slate-400">
                          {component.vencimentoData 
                            ? new Date(component.vencimentoData).toLocaleDateString('pt-BR')
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingComponent(component);
                                setDialogOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(component.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

// Formulário de Componente
interface ComponentFormProps {
  component: Component | null;
  onSave: (component: Component) => void;
  onCancel: () => void;
}

const ComponentForm: React.FC<ComponentFormProps> = ({ component, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Component>>(
    component || {
      category: '',
      type: '',
      componente: '',
      modelo: '',
      numeroSerie: '',
      horasAtuais: 0,
      horasApos: 0,
      limiteTBO: 0,
      vencimentoHoras: 0,
      horasDisponiveis: 0,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const horasDisponiveis = (formData.vencimentoHoras || 0) - (formData.horasAtuais || 0);
    
    onSave({
      ...formData,
      horasDisponiveis,
    } as Component);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {component ? 'Editar Componente' : 'Novo Componente'}
        </DialogTitle>
        <DialogDescription>
          Preencha as informações do componente aeronáutico
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Categoria</Label>
          <Select
            value={formData.categoria}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label>Componente</Label>
          <Input
            value={formData.componente}
            onChange={(e) => setFormData({ ...formData, componente: e.target.value })}
            placeholder="Ex: Motor Continental - LH"
            className="bg-slate-800 border-slate-700"
            required
          />
        </div>

        <div>
          <Label>Modelo / P/N</Label>
          <Input
            value={formData.modelo}
            onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
            placeholder="Ex: TSIO-360-RB2"
            className="bg-slate-800 border-slate-700"
            required
          />
        </div>

        <div>
          <Label>Número de Série</Label>
          <Input
            value={formData.numeroSerie}
            onChange={(e) => setFormData({ ...formData, numeroSerie: e.target.value })}
            placeholder="Ex: 1007716"
            className="bg-slate-800 border-slate-700"
            required
          />
        </div>

        <div>
          <Label>Horas Atuais</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.horasAtuais}
            onChange={(e) => setFormData({ ...formData, horasAtuais: parseFloat(e.target.value) || 0 })}
            className="bg-slate-800 border-slate-700"
            required
          />
        </div>

        <div>
          <Label>Horas Após</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.horasApos}
            onChange={(e) => setFormData({ ...formData, horasApos: parseFloat(e.target.value) || 0 })}
            className="bg-slate-800 border-slate-700"
          />
        </div>

        <div>
          <Label>Limite TBO (Horas)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.limiteTBO}
            onChange={(e) => setFormData({ ...formData, limiteTBO: parseFloat(e.target.value) || 0 })}
            className="bg-slate-800 border-slate-700"
            required
          />
        </div>

        <div>
          <Label>Limite Tempo (Anos)</Label>
          <Input
            type="number"
            value={formData.limiteTempoAnos}
            onChange={(e) => setFormData({ ...formData, limiteTempoAnos: parseInt(e.target.value) || undefined })}
            className="bg-slate-800 border-slate-700"
          />
        </div>

        <div>
          <Label>Vencimento (Horas)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.vencimentoHoras}
            onChange={(e) => setFormData({ ...formData, vencimentoHoras: parseFloat(e.target.value) || 0 })}
            className="bg-slate-800 border-slate-700"
            required
          />
        </div>

        <div>
          <Label>Vencimento (Data)</Label>
          <Input
            type="data"
            value={formData.vencimentoData}
            onChange={(e) => setFormData({ ...formData, vencimentoData: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>

        <div className="col-span-2">
          <Label>Executante</Label>
          <Input
            value={formData.executante}
            onChange={(e) => setFormData({ ...formData, executante: e.target.value })}
            placeholder="Ex: J.P. Martins Aviação"
            className="bg-slate-800 border-slate-700"
          />
        </div>

        <div className="col-span-2">
          <Label>Observações</Label>
          <Input
            value={formData.observacoes}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            placeholder="Informações adicionais sobre a troca/revisão"
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="border-slate-700">
          Cancelar
        </Button>
        <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
          Salvar
        </Button>
      </div>
    </form>
  );
};
