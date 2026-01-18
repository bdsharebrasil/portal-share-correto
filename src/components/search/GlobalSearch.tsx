import { useState, useRef, useEffect } from "react";
import { Search, File, Users, Calendar, DollarSign, Receipt, Plane } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'page' | 'document' | 'contact' | 'task';
  path: string;
  icon: any;
}

const searchData: SearchResult[] = [
  // Páginas principais
  { id: '1', title: 'Conciliação Bancária', description: 'Gestão de movimentações bancárias', type: 'page', path: '/financeiro/conciliacao', icon: DollarSign },
  { id: '2', title: 'Minhas Tarefas', description: 'Gerenciar atividades e pendências', type: 'page', path: '/tarefas', icon: Calendar },
  { id: '3', title: 'Meu Perfil', description: 'Informações pessoais e documentos', type: 'page', path: '/perfil', icon: Users },
  { id: '4', title: 'Agenda', description: 'Contatos, clientes e aniversários', type: 'page', path: '/agenda', icon: Calendar },
  { id: '5', title: 'Recados', description: 'Comunicações internas', type: 'page', path: '/recados', icon: File },
  
  // Financeiro
  { id: '6', title: 'Configuração da Empresa', description: 'Dados da empresa', type: 'page', path: '/financeiro/config', icon: DollarSign },
  { id: '7', title: 'Emissão de Recibo', description: 'Gerar recibos', type: 'page', path: '/financeiro/recibo', icon: Receipt },
  { id: '8', title: 'Relatório de Viagem', description: 'Relatórios de despesas', type: 'page', path: '/financeiro/viagem', icon: Plane },
  { id: '9', title: 'Cobrança', description: 'Gestão de cobranças', type: 'page', path: '/financeiro/cobranca', icon: DollarSign },
  { id: '10', title: 'Solicitação de Compras', description: 'Requisições de materiais', type: 'page', path: '/financeiro/compras', icon: File },
  
  // Cartões
  { id: '11', title: 'Cartão Alimentação', description: 'Saldo e gastos do vale alimentação', type: 'page', path: '/cartao/alimentacao', icon: Receipt },
  { id: '12', title: 'Cartão Refeição', description: 'Saldo e gastos do vale refeição', type: 'page', path: '/cartao/refeicao', icon: Receipt },
  { id: '13', title: 'Cartão Combustível', description: 'Saldo e gastos do cartão combustível', type: 'page', path: '/cartao/combustivel', icon: Receipt },
  
  // Agenda
  { id: '14', title: 'Contatos', description: 'Lista de contatos', type: 'contact', path: '/agenda/contatos', icon: Users },
  { id: '15', title: 'Clientes', description: 'Gestão de clientes', type: 'contact', path: '/agenda/clientes', icon: Users },
  { id: '16', title: 'Aniversários', description: 'Aniversários do mês', type: 'contact', path: '/agenda/aniversarios', icon: Calendar },
];

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length >= 2) {
      const filtered = searchData.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered.slice(0, 8));
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.path);
    setQuery("");
    setIsOpen(false);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'page': return 'text-primary';
      case 'document': return 'text-blue-600';
      case 'contact': return 'text-green-600';
      case 'task': return 'text-orange-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="relative flex-1 max-w-md mx-2 lg:mx-8" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input 
          placeholder="Pesquisar no portal..." 
          className="pl-10 bg-secondary border-border focus:ring-primary" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
        />
      </div>

      {isOpen && results.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto shadow-lg">
          <CardContent className="p-0">
            {results.map((result) => (
              <Button
                key={result.id}
                variant="ghost"
                className="w-full justify-start p-3 h-auto hover:bg-accent"
                onClick={() => handleResultClick(result)}
              >
                <result.icon className={`h-4 w-4 mr-3 ${getTypeColor(result.type)}`} />
                <div className="text-left">
                  <div className="font-medium text-foreground">{result.title}</div>
                  <div className="text-sm text-muted-foreground">{result.description}</div>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}